import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import FormData from 'form-data';

// Vector store name for Svelte documentation
const VECTOR_STORE_NAME = 'svelte5-documentation';
const DOCS_URL = 'https://svelte.dev/llms-full.txt';
const DOCS_FILENAME = 'svelte5-docs.txt';

/**
 * Helper function to log to stderr to avoid interfering with MCP protocol
 */
function log(message: string) {
  process.stderr.write(message + '\n');
}

/**
 * Helper function for error logging to stderr
 */
function logError(message: string, error?: any) {
  let errorMsg = message;
  if (error) {
    if (error.status) errorMsg += ` ${error.status}`;
    if (error.message) errorMsg += ` ${error.message}`;
    else errorMsg += ` ${error}`;
  }
  process.stderr.write(`ERROR: ${errorMsg}\n`);
}

/**
 * Class for interacting with OpenAI's Retrieval API
 * Handles vector store creation, document processing, and semantic search
 */
export class OpenAIRetrieval {
  private client: OpenAI;
  private vectorStoreId: string | null = null;
  private initialized = false;
  private apiKey: string;

  /**
   * Create a new OpenAIRetrieval instance
   * @param apiKey OpenAI API key
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'OpenAI API key is required'
      );
    }
    
    // Validate API key format
    if (!apiKey.startsWith('sk-')) {
      log('Warning: The provided OpenAI API key does not start with "sk-". This may not be a valid OpenAI API key.');
    }
    
    this.apiKey = apiKey;
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Validate the API key by making a simple API call
   */
  private async validateApiKey(): Promise<void> {
    try {
      await this.client.models.list();
    } catch (error: any) {
      logError('API key validation error:', error);
      
      if (error.status === 401) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid OpenAI API key. Please check your API key and try again.'
        );
      } else if (error.status === 403) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Your OpenAI account does not have permission to use this API. Please check your account permissions.'
        );
      } else {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to validate OpenAI API key: ${error.message || error}`
        );
      }
    }
  }

  /**
   * Check if the API key has access to the Retrieval API
   */
  private async checkRetrievalApiAccess(): Promise<void> {
    try {
      // Use direct axios call since the SDK method might not be available
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      await axios.get(
        'https://api.openai.com/v1/vector_stores',
        { headers }
      );
    } catch (error: any) {
      logError('Retrieval API access check error:', error.response?.status ? { status: error.response.status, message: error.message } : error);
      
      if (error.response?.status === 401) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid OpenAI API key. Please check your API key and try again.'
        );
      } else if (error.response?.status === 403) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Your OpenAI account does not have permission to use the Retrieval API. This feature may require a specific account tier or beta access.'
        );
      } else if (error.response?.status === 404) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'The Retrieval API endpoint was not found. This feature may not be available yet for your account or is in beta.'
        );
      } else {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to access Retrieval API: ${error.message || error}`
        );
      }
    }
  }

  /**
   * Initialize the vector store - either find existing or create new
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // First, validate the API key
      await this.validateApiKey();
      
      // Then check if the API key has access to the Retrieval API
      await this.checkRetrievalApiAccess();
      
      // Use direct axios call to list vector stores
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      const vectorStoresResponse = await axios.get(
        'https://api.openai.com/v1/vector_stores',
        { headers }
      );
      
      const vectorStores = vectorStoresResponse.data;
      
      const existingStore = vectorStores.data.find((store: { name: string }) => store.name === VECTOR_STORE_NAME);
      
      if (existingStore) {
        log(`Found existing vector store: ${existingStore.id}`);
        this.vectorStoreId = existingStore.id;
      } else {
        log(`Creating new vector store: ${VECTOR_STORE_NAME}`);
        // Create a new vector store using direct API call
        const createResponse = await axios.post(
          'https://api.openai.com/v1/vector_stores',
          { name: VECTOR_STORE_NAME },
          { headers }
        );
        
        const vectorStore = createResponse.data;
        this.vectorStoreId = vectorStore.id;
        
        // Download and process the documentation
        await this.downloadAndProcessDocs();
      }
      
      this.initialized = true;
    } catch (error) {
      logError('Failed to initialize OpenAI vector store:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to initialize OpenAI vector store: ${error}`
      );
    }
  }

  /**
   * Download documentation and add to vector store
   */
  private async downloadAndProcessDocs(): Promise<void> {
    if (!this.vectorStoreId) {
      throw new McpError(
        ErrorCode.InternalError,
        'Vector store ID not available'
      );
    }

    try {
      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      const filePath = path.join(tempDir, DOCS_FILENAME);
      
      // Download the documentation from the Svelte docs URL
      log(`Downloading documentation from ${DOCS_URL}`);
      try {
        const response = await axios.get(DOCS_URL);
        fs.writeFileSync(filePath, response.data);
      } catch (error: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to download documentation: ${error.message || error}`
        );
      }
      
      // Upload to OpenAI
      log('Uploading documentation to OpenAI');
      
      try {
        // Upload file directly to the vector store
        log(`Uploading file to vector store ${this.vectorStoreId}`);
        
        // Use direct API call to upload file
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('purpose', 'vector_store');
        
        const headers = {
          'Authorization': `Bearer ${this.apiKey}`,
          // Content-Type is set automatically by FormData
        };
        
        // First, upload the file to OpenAI
        const fileUploadResponse = await axios.post(
          'https://api.openai.com/v1/files',
          formData,
          { headers }
        );
        
        const fileId = fileUploadResponse.data.id;
        
        // Then, add the file to the vector store
        await axios.post(
          `https://api.openai.com/v1/vector_stores/${this.vectorStoreId}/files`,
          { file_id: fileId },
          { 
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        log('Documentation successfully added to vector store');
      } catch (error: any) {
        if (error.response?.status === 401) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Your OpenAI API key does not have access to the Files API or Retrieval API.'
          );
        } else {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to process documentation: ${error.message || error}`
          );
        }
      }
    } catch (error) {
      logError('Failed to process documentation:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to process documentation: ${error}`
      );
    }
  }

  /**
   * Search the vector store with a query
   * @param query Search query
   * @param limit Maximum number of results to return
   */
  async search(query: string, limit: number = 5): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.vectorStoreId) {
      throw new McpError(
        ErrorCode.InternalError,
        'Vector store not initialized'
      );
    }

    try {
      // Use direct axios call since the SDK method is not working
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      const searchResponse = await axios.post(
        `https://api.openai.com/v1/vector_stores/${this.vectorStoreId}/search`,
        {
          query,
          max_num_results: limit,
          rewrite_query: true
        },
        { headers }
      );
      
      return searchResponse.data;
    } catch (error: any) {
      logError('Search failed:', error.response?.status ? { status: error.response.status, message: error.message } : error);
      
      if (error.response?.status === 401) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid OpenAI API key. Please check your API key and try again.'
        );
      } else if (error.response?.status === 404) {
        throw new McpError(
          ErrorCode.InternalError,
          'Vector store not found. It may have been deleted or is not accessible.'
        );
      } else {
        throw new McpError(
          ErrorCode.InternalError,
          `Search failed: ${error.message || error}`
        );
      }
    }
  }

  /**
   * List all files in the vector store
   */
  async listFiles(): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.vectorStoreId) {
      throw new McpError(
        ErrorCode.InternalError,
        'Vector store not initialized'
      );
    }

    try {
      // Use direct axios call since the SDK method is not working
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      const filesResponse = await axios.get(
        `https://api.openai.com/v1/vector_stores/${this.vectorStoreId}/files`,
        { headers }
      );
      
      return filesResponse.data;
    } catch (error: any) {
      logError('Failed to list files:', error.response?.status ? { status: error.response.status, message: error.message } : error);
      
      if (error.response?.status === 401) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid OpenAI API key. Please check your API key and try again.'
        );
      } else if (error.response?.status === 404) {
        throw new McpError(
          ErrorCode.InternalError,
          'Vector store not found. It may have been deleted or is not accessible.'
        );
      } else {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list files: ${error.message || error}`
        );
      }
    }
  }
} 