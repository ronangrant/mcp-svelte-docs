# MCP-Svelte-Docs

A Model Context Protocol (MCP) server that enables semantic search of Svelte 5 documentation using OpenAI's Retrieval API. This server allows AI assistants like Claude and Cursor to search through Svelte 5 documentation using natural language queries.

## Features

- Semantic search through complete Svelte 5 documentation
- Automatic documentation retrieval and vectorization using the full Svelte docs
- Integration with Claude Desktop, Cursor, and other MCP hosts
- Reuse of existing vector stores for efficiency

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
   git clone https://github.com/ronangrant/mcp-svelte-docs.git
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
# Using environment variables
OPENAI_API_KEY="your-openai-api-key" npm start

# Using command-line arguments
npx @ronangrant/mcp-svelte-docs --openai-api-key=your-openai-api-key
```

### Integration with Cursor

For Cursor integration, add a new MCP tool with the following command:

```
npx -y @ronangrant/mcp-svelte-docs --openai-api-key=your-openai-api-key
```

#### Cursor Rules for Svelte 5 Documentation

To make sure Cursor remembers to use the MCP when working with Svelte 5, you can create a Cursor Rule:

1. Open Cursor and navigate to the command palette with `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows/Linux) and name the file
2. Type and select "New Cursor Rule"
3. Add the following information:
   - **Rule Name**: `when-to-use-svelte-mcp`
   - **Description**:
     ```markdown
     # Svelte 5 Documentation MCP Rule

     ## How to use:
     Use the MCP to search Svelte 5 documentation instead of guessing. This ensures accuracy and prevents hallucinations.

     ## When to use it:
     - When writing Svelte and unsure about changes from version 4 to 5.
     - When encountering errors or unexpected behavior, even if you think you know the cause.
     - Whenever a clarification is needed regarding Svelte 5 syntax, API, or best practices.

     **Do not guess. Always verify with the MCP.**
     ```
4. Press the "Globe" icon to make it global and apply to every prompt

This rule reminds Cursor to use the MCP for accurate Svelte 5 information rather than relying on potentially outdated knowledge.

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
           "OPENAI_API_KEY": "your-openai-api-key"
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
           "OPENAI_API_KEY": "your-openai-api-key"
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

## Available Tools

The MCP server provides the following tool to AI assistants:

1. `search_svelte_docs`
   - Search through Svelte 5 documentation
   - Parameters:
     - `query`: Search query
     - `limit` (optional): Maximum number of results to return (default: 5)

## How It Works

1. The server initializes and checks if a vector store for Svelte 5 documentation already exists in your OpenAI account.
2. If it doesn't exist, it creates a new vector store, downloads the Svelte 5 documentation, and adds it to the vector store.
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

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
