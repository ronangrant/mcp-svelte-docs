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

// Environment variables for configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Add support for additional environment variables
const CUSTOM_DOCS_URL = process.env.CUSTOM_DOCS_URL; // Optional custom documentation URL

// Print startup information (will be visible when running with npx)
console.log('Starting MCP-Svelte5-Docs server...');
if (CUSTOM_DOCS_URL) {
  console.log(`Using custom documentation URL: ${CUSTOM_DOCS_URL}`);
}

// Check if OpenAI API key is provided
if (!OPENAI_API_KEY) {
  console.error('OpenAI API key is required. Please set the OPENAI_API_KEY environment variable.');
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
        name: 'mcp-svelte5-docs',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Initialize OpenAI Retrieval with the API key and custom docs URL if provided
    this.openaiRetrieval = new OpenAIRetrieval(OPENAI_API_KEY as string, CUSTOM_DOCS_URL);
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
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
      console.log('OpenAI Retrieval initialized successfully');
      
      this.setupToolHandlers();
    } catch (error) {
      console.error('Failed to initialize OpenAI Retrieval:', error);
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
        {
          name: 'list_docs_sources',
          description: 'List all Svelte 5 documentation sources',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search_svelte_docs':
          return this.handleSearchDocumentation(request.params.arguments);
        case 'list_docs_sources':
          return this.handleListSources();
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
      console.error('Search error:', error);
      
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
   * Handle the list_docs_sources tool request
   */
  private async handleListSources() {
    try {
      // Use OpenAI Retrieval API
      const files = await this.openaiRetrieval.listFiles();
      
      if (!files.data || files.data.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No Svelte 5 documentation sources found.',
            },
          ],
        };
      }
      
      const sourcesList = files.data.map((file: any) => {
        const filename = file.filename || file.name || file.id;
        return `- ${filename} (ID: ${file.id})`;
      }).join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Svelte 5 Documentation Sources:\n\n${sourcesList}`,
          },
        ],
      };
    } catch (error: any) {
      console.error('List sources error:', error);
      
      // Format the error message for better user experience
      let errorMessage = 'Failed to list sources: ';
      
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
      console.log('Svelte5 Docs MCP server running on stdio');
    } catch (error) {
      console.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }
}

// Create and run the server
const server = new Svelte5DocsServer();
server.run().catch(console.error);
