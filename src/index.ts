#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenAIRetrieval } from './openai-retrieval-fixed.js';

// Helper functions for logging to stderr to avoid interfering with MCP protocol
function log(message: string) {
  process.stderr.write(message + '\n');
}

function logError(message: string, error?: any) {
  let errorMsg = message;
  if (error) {
    if (error.message) errorMsg += ` ${error.message}`;
    else errorMsg += ` ${error}`;
  }
  process.stderr.write(`ERROR: ${errorMsg}\n`);
}

// Redirect console output to stderr to avoid interfering with MCP protocol
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleError = console.error;
console.log = (...args) => {
  process.stderr.write(args.join(' ') + '\n');
};
console.info = (...args) => {
  process.stderr.write(args.join(' ') + '\n');
};
console.error = (...args) => {
  process.stderr.write('ERROR: ' + args.join(' ') + '\n');
};

// Parse command line arguments
const args = process.argv.slice(2);
const argMap: Record<string, string> = {};

// Process command line arguments
args.forEach(arg => {
  if (arg === '--stdio' || arg === '--help') {
    argMap[arg.substring(2)] = 'true';
  } else if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    if (key && value) {
      argMap[key] = value;
    }
  }
});

// Show help if requested
if (argMap.help) {
  log(`
MCP-Svelte-Docs - A Model Context Protocol server for Svelte 5 documentation

Usage:
  npx @ronangrant/mcp-svelte-docs [options]

Options:
  --stdio                      Use stdio for MCP communication (default)
  --openai-api-key=<key>       OpenAI API key
  --help                       Show this help message

Environment Variables:
  OPENAI_API_KEY               OpenAI API key

Examples:
  npx @ronangrant/mcp-svelte-docs --openai-api-key=sk-...
  npx @ronangrant/mcp-svelte-docs --stdio --openai-api-key=sk-...
  `);
  process.exit(0);
}

// Environment variables for configuration, with command line args taking precedence
const OPENAI_API_KEY = argMap['openai-api-key'] || process.env.OPENAI_API_KEY;

// Print startup information (will be visible when running with npx)
log('Starting MCP-Svelte-Docs server...');

// Check if OpenAI API key is provided
if (!OPENAI_API_KEY) {
  logError('OpenAI API key is required. Please set the OPENAI_API_KEY environment variable or use --openai-api-key=<key>');
  process.exit(1);
}

/**
 * Interface representing a chunk of documentation
 */
interface DocumentChunk {
  text: string;
  url: string;
  title: string;
  timestamp: string;
}

/**
 * Extended interface for document chunks with type information
 */
interface DocumentPayload extends DocumentChunk {
  _type: 'DocumentChunk';
  [key: string]: unknown;
}

/**
 * Main server class for the Svelte5 documentation MCP server
 */
class Svelte5DocsServer {
  private server: Server;
  private openaiRetrieval: OpenAIRetrieval;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-svelte-docs',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Initialize OpenAI Retrieval with the API key
    this.openaiRetrieval = new OpenAIRetrieval(OPENAI_API_KEY as string);
    
    // Error handling
    this.server.onerror = (error) => logError('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Clean up resources when shutting down
   */
  private async cleanup() {
    await this.server.close();
  }

  /**
   * Initialize the server and set up tool handlers
   */
  private async init() {
    try {
      // Initialize OpenAI Retrieval
      await this.openaiRetrieval.initialize();
      log('OpenAI Retrieval initialized successfully');
      
      this.setupToolHandlers();
    } catch (error) {
      logError('Failed to initialize OpenAI Retrieval:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to initialize OpenAI Retrieval: ${error}`
      );
    }
  }

  /**
   * Set up the MCP tool handlers
   */
  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_svelte_docs',
          description: 'Search through Svelte 5 documentation',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 5,
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search_svelte_docs':
          return this.handleSearchDocumentation(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  /**
   * Handle the search_svelte_docs tool request
   * @param args Tool arguments
   */
  private async handleSearchDocumentation(args: any) {
    if (!args.query || typeof args.query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Query is required');
    }

    const limit = args.limit || 5;

    try {
      // Use OpenAI Retrieval API
      const searchResults = await this.openaiRetrieval.search(args.query, limit);
      
      if (!searchResults.data || searchResults.data.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No results found in Svelte 5 documentation.',
            },
          ],
        };
      }
      
      const formattedResults = searchResults.data.map((result: any, index: number) => {
        // Extract text content from the result
        let content = '';
        if (result.content && Array.isArray(result.content)) {
          content = result.content.map((c: any) => c.text).join('\n');
        } else if (result.text) {
          content = result.text;
        } else {
          content = JSON.stringify(result);
        }
        
        const score = result.score ? result.score.toFixed(2) : 'N/A';
        return `Result ${index + 1} (Score: ${score}):\n${content}\n`;
      }).join('\n---\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Search results for "${args.query}":\n\n${formattedResults}`,
          },
        ],
      };
    } catch (error: any) {
      logError('Search error:', error);
      
      // Format the error message for better user experience
      let errorMessage = 'Search failed: ';
      
      if (error instanceof McpError) {
        errorMessage += error.message;
      } else if (error.response && error.response.data && error.response.data.error) {
        // Handle OpenAI API error format
        errorMessage += error.response.data.error.message || error.message;
      } else {
        errorMessage += error.message || String(error);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Start the MCP server
   */
  async run() {
    try {
      await this.init();
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      log('Svelte Docs MCP server running on stdio');
    } catch (error) {
      logError('Failed to initialize server:', error);
      process.exit(1);
    }
  }
}

// Create and run the server
const server = new Svelte5DocsServer();
server.run().catch(console.error);
