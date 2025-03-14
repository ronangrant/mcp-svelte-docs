#!/usr/bin/env node

import { OpenAIRetrieval } from './build/openai-retrieval-fixed.js';

// Get API key from environment variable
const apiKey = process.env.OPENAI_API_KEY;
const customDocsUrl = process.env.CUSTOM_DOCS_URL;

if (!apiKey) {
  console.error('Error: OPENAI_API_KEY environment variable not set');
  process.exit(1);
}

async function testRetrieval() {
  console.log(`Testing OpenAI Retrieval API with key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
  if (customDocsUrl) {
    console.log(`Using custom documentation URL: ${customDocsUrl}`);
  }
  
  try {
    // Initialize the OpenAI Retrieval client
    const retrieval = new OpenAIRetrieval(apiKey, customDocsUrl);
    
    // Initialize (this will create a vector store if needed)
    console.log('\n1. Initializing OpenAI Retrieval...');
    await retrieval.initialize();
    console.log('✅ Successfully initialized OpenAI Retrieval');
    
    // List files in the vector store
    console.log('\n2. Listing files in the vector store...');
    const files = await retrieval.listFiles();
    console.log(`✅ Found ${files.data.length} files in the vector store`);
    
    // Search the vector store
    console.log('\n3. Searching the vector store...');
    const query = 'What are runes in Svelte 5?';
    const results = await retrieval.search(query, 3);
    console.log(`✅ Search successful. Found ${results.data.length} results.`);
    
    // Print search results
    if (results.data && results.data.length > 0) {
      console.log('\nSearch Results:');
      results.data.forEach((result, i) => {
        console.log(`\nResult ${i+1} (Score: ${result.score}):`);
        if (result.content) {
          result.content.forEach(content => {
            console.log(`- ${content.text.substring(0, 150)}...`);
          });
        }
      });
    } else {
      console.log('No search results found.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testRetrieval(); 