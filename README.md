# MCP-Svelte-Docs

A Model Context Protocol (MCP) server that enables semantic search of Svelte 5 documentation using OpenAI's Retrieval API. This server allows AI assistants like Claude to search through Svelte 5 documentation using natural language queries.

## Features

- Semantic search through Svelte 5 documentation
- Automatic documentation retrieval and vectorization
- Integration with Claude Desktop and other MCP hosts
- Reuse of existing vector stores for efficiency
- Support for custom documentation URLs

## Requirements

- Node.js 16 or higher
- OpenAI API key with access to the Retrieval API

## Installation

You can install this package globally using npm:

```bash
npm install -g @ronangrant/mcp-svelte-docs
```

Or run it directly with npx:

```bash
npx @ronangrant/mcp-svelte-docs
```

If you want to clone and build from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/ronangrant/mcp-svelte-docs2.git
   cd mcp-svelte-docs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Running Directly

You can run the MCP server directly for testing:

```bash
OPENAI_API_KEY="your-openai-api-key" npm start
```

To use a custom documentation URL:

```bash
OPENAI_API_KEY="your-openai-api-key" CUSTOM_DOCS_URL="https://your-custom-docs-url.com/docs.txt" npm start
```

### Integration with Claude Desktop

1. Edit your Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the following configuration:
   ```json
   {
     "mcpServers": {
       "svelte5docs": {
         "command": "/usr/local/bin/node",
         "args": [
           "/path/to/your/mcp-svelte-docs/build/index.js"
         ],
         "env": {
           "OPENAI_API_KEY": "your-openai-api-key",
           "CUSTOM_DOCS_URL": "https://your-custom-docs-url.com/docs.txt" // Optional
         }
       }
     }
   }
   ```

   Or, if you installed the package globally:
   ```json
   {
     "mcpServers": {
       "svelte5docs": {
         "command": "npx",
         "args": [
           "-y",
           "@ronangrant/mcp-svelte-docs"
         ],
         "env": {
           "OPENAI_API_KEY": "your-openai-api-key",
           "CUSTOM_DOCS_URL": "https://your-custom-docs-url.com/docs.txt" // Optional
         }
       }
     }
   }
   ```

3. Restart Claude Desktop

### Integration with Other MCP Hosts

For other MCP hosts, consult their documentation for how to configure external MCP servers. The general approach is to provide:

- The command to run the server (`node /path/to/build/index.js`)
- The necessary environment variables:
  - `OPENAI_API_KEY` (required)
  - `CUSTOM_DOCS_URL` (optional)

## Available Tools

The MCP server provides the following tools to AI assistants:

1. `search_svelte_docs`
   - Search through Svelte 5 documentation
   - Parameters:
     - `query`: Search query
     - `limit` (optional): Maximum number of results to return (default: 5)

2. `list_docs_sources`
   - List all Svelte 5 documentation sources

## How It Works

1. The server initializes and checks if a vector store for Svelte 5 documentation already exists in your OpenAI account.
2. If it doesn't exist, it creates a new vector store, downloads the Svelte 5 documentation (from the default URL or a custom URL if provided), and adds it to the vector store.
3. When you search, it uses OpenAI's Retrieval API to find the most relevant documentation based on your query.
4. The results are returned with their relevance scores.

## Troubleshooting

### Common Issues

1. **OpenAI API Key Issues**
   - Make sure you're using a valid OpenAI API key (starts with `sk-`)
   - Check that your API key has not expired or been revoked

2. **Retrieval API Access Issues**
   - The Retrieval API is in beta and may require specific account access
   - Check your OpenAI account dashboard to see if you have access to the Retrieval API

3. **Configuration Path Issues**
   - Ensure paths in your configuration are absolute and correct
   - Verify the Node.js path is correct (use `which node` to find it)

4. **Custom Documentation URL Issues**
   - Ensure the URL points to a valid text file
   - The text file should be formatted in a way that's compatible with OpenAI's Retrieval API
   - Check that the URL is accessible from your server

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
