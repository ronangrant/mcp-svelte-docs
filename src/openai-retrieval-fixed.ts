import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Vector store name for Svelte documentation
const VECTOR_STORE_NAME = 'svelte5-documentation';
const DEFAULT_DOCS_URL = 'https://svelte.dev/docs/svelte/llms.txt';
const DOCS_FILENAME = 'svelte5-docs.txt';

/**
 * Class for interacting with OpenAI's Retrieval API
 * Handles vector store creation, document processing, and semantic search
 */
export class OpenAIRetrieval {
  private client: OpenAI;
  private vectorStoreId: string | null = null;
  private initialized = false;
  private apiKey: string;
  private docsUrl: string;

  /**
   * Create a new OpenAIRetrieval instance
   * @param apiKey OpenAI API key
   * @param customDocsUrl Optional custom documentation URL
   */
  constructor(apiKey: string, customDocsUrl?: string) {
    if (!apiKey) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'OpenAI API key is required'
      );
    }
    
    // Validate API key format
    if (!apiKey.startsWith('sk-')) {
      console.warn('Warning: The provided OpenAI API key does not start with "sk-". This may not be a valid OpenAI API key.');
    }
    
    this.apiKey = apiKey;
    this.docsUrl = customDocsUrl || DEFAULT_DOCS_URL;
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Validate the API key by making a simple API call
   */
  private async validateApiKey(): Promise<void> {
    try {
      await this.client.models.list();
    } catch (error: any) {
      console.error('API key validation error:', error.status, error.message);
      
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
      // Make a simple request to check access by listing vector stores
      await (this.client.beta as any).vectorStores.list();
    } catch (error: any) {
      console.error('Retrieval API access check error:', error.status, error.message);
      
      if (error.status === 401) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid OpenAI API key. Please check your API key and try again.'
        );
      } else if (error.status === 403) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Your OpenAI account does not have permission to use the Retrieval API. This feature may require a specific account tier or beta access.'
        );
      } else if (error.status === 404) {
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
      
      // List vector stores using the SDK
      const vectorStores = await (this.client.beta as any).vectorStores.list();
      
      const existingStore = vectorStores.data.find((store: { name: string }) => store.name === VECTOR_STORE_NAME);
      
      if (existingStore) {
        console.log(`Found existing vector store: ${existingStore.id}`);
        this.vectorStoreId = existingStore.id;
      } else {
        console.log(`Creating new vector store: ${VECTOR_STORE_NAME}`);
        // Create a new vector store using the SDK
        const vectorStore = await (this.client.beta as any).vectorStores.create({
          name: VECTOR_STORE_NAME
        });
        
        this.vectorStoreId = vectorStore.id;
        
        // Download and process the documentation
        await this.downloadAndProcessDocs();
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize OpenAI vector store:', error);
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
      
      // Download the documentation from the configured URL
      console.log(`Downloading documentation from ${this.docsUrl}`);
      try {
        const response = await axios.get(this.docsUrl);
        fs.writeFileSync(filePath, response.data);
      } catch (error: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to download documentation: ${error.message || error}`
        );
      }
      
      // Upload to OpenAI
      console.log('Uploading documentation to OpenAI');
      
      try {
        // Upload file directly to the vector store
        console.log(`Uploading file to vector store ${this.vectorStoreId}`);
        
        // Use the uploadAndPoll method from the SDK
        await (this.client.beta as any).vectorStores.files.uploadAndPoll(
          this.vectorStoreId,
          fs.createReadStream(filePath)
        );
        
        console.log('Documentation successfully added to vector store');
      } catch (error: any) {
        if (error.status === 401) {
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
      console.error('Failed to process documentation:', error);
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
      console.error('Search failed:', error.response?.status, error.message);
      
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
      console.error('Failed to list files:', error.response?.status, error.message);
      
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