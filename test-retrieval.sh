#!/bin/bash

# Run the JavaScript test script with the OpenAI API key
# Make sure to set your OpenAI API key as an environment variable before running this script
# Example: export OPENAI_API_KEY="your-api-key"
# You can also set a custom documentation URL (optional):
# Example: export CUSTOM_DOCS_URL="https://your-custom-docs-url.com/docs.txt"

if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY environment variable not set"
  echo "Please set it before running this script:"
  echo "export OPENAI_API_KEY=\"your-api-key\""
  exit 1
fi

# Display custom docs URL info if set
if [ ! -z "$CUSTOM_DOCS_URL" ]; then
  echo "Using custom documentation URL: $CUSTOM_DOCS_URL"
fi

node test-retrieval.js 