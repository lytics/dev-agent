# Cursor MCP Setup Guide

This guide shows how to integrate the dev-agent MCP server with Cursor IDE.

## Prerequisites

1. Build the MCP server:
   ```bash
   cd /path/to/dev-agent
   pnpm install
   pnpm build
   ```

2. Ensure the repository is indexed:
   ```bash
   pnpm dev scan
   ```

## Configuration

### 1. Locate Cursor's MCP Config

The MCP configuration file is located at:
- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/mcp.json`
- **Linux**: `~/.config/Cursor/User/globalStorage/mcp.json`
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\mcp.json`

### 2. Add dev-agent MCP Server

Create or update the `mcp.json` file with the following configuration:

```json
{
  "mcpServers": {
    "dev-agent": {
      "command": "node",
      "args": [
        "/absolute/path/to/dev-agent/packages/mcp-server/dist/bin/dev-agent-mcp.js"
      ],
      "env": {
        "REPOSITORY_PATH": "/absolute/path/to/your/repository",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Important:** Replace the paths with your actual absolute paths.

### 3. Restart Cursor

After updating the configuration, restart Cursor to load the MCP server.

## Verification

1. Open Cursor
2. Try using the `dev_search` tool in a chat:
   ```
   Search for "authentication middleware" in the codebase
   ```

3. The MCP server should respond with semantic search results

## Available Tools

### `dev_search`

Semantic code search across your repository.

**Parameters:**
- `query` (required): Natural language search query
- `format` (optional): `compact` (default) or `verbose`
- `limit` (optional): Number of results (1-50, default: 10)
- `scoreThreshold` (optional): Minimum relevance score (0-1, default: 0)

**Example:**
```
dev_search:
  query: "user authentication logic"
  format: compact
  limit: 5
```

## Troubleshooting

### Server Not Starting

1. Check Cursor's logs (Help > Show Logs)
2. Verify the paths in `mcp.json` are absolute and correct
3. Ensure the server builds successfully: `pnpm build`
4. Test the server manually:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | \
     node /path/to/dev-agent/packages/mcp-server/dist/bin/dev-agent-mcp.js
   ```

### Repository Not Indexed

If searches return no results:
```bash
cd /path/to/your/repository
/path/to/dev-agent/packages/cli/dist/index.js scan
```

### Logs

Set `LOG_LEVEL` to `debug` in the env section of `mcp.json` for more verbose logging:
```json
"env": {
  "REPOSITORY_PATH": "/path/to/repo",
  "LOG_LEVEL": "debug"
}
```

## Multiple Repositories

To use dev-agent with multiple repositories, add multiple server configurations:

```json
{
  "mcpServers": {
    "dev-agent-project-a": {
      "command": "node",
      "args": ["/path/to/dev-agent/packages/mcp-server/dist/bin/dev-agent-mcp.js"],
      "env": {
        "REPOSITORY_PATH": "/path/to/project-a"
      }
    },
    "dev-agent-project-b": {
      "command": "node",
      "args": ["/path/to/dev-agent/packages/mcp-server/dist/bin/dev-agent-mcp.js"],
      "env": {
        "REPOSITORY_PATH": "/path/to/project-b"
      }
    }
  }
}
```

## Next Steps

- See [README.md](./README.md) for general MCP server documentation
- See [../../docs/WORKFLOW.md](../../docs/WORKFLOW.md) for the dev-agent workflow

