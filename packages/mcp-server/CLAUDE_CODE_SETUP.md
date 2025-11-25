# Claude Code MCP Setup Guide

This guide shows how to integrate the dev-agent MCP server with Claude Code CLI.

## Prerequisites

1. **Build the MCP server:**
   ```bash
   cd /path/to/dev-agent
   pnpm install
   pnpm build
   ```

2. **Initialize and index your repository:**
   ```bash
   # Initialize dev-agent
   node packages/cli/dist/cli.js init
   
   # Index the repository
   node packages/cli/dist/cli.js index
   
   # Verify indexing
   node packages/cli/dist/cli.js storage info
   ```

## Claude Code Configuration

### Option 1: Using claude_desktop_config.json (Recommended)

Claude Code uses the same configuration as Claude Desktop. Create or update:

**macOS/Linux:** `~/.config/claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dev-agent": {
      "command": "node",
      "args": [
        "/absolute/path/to/dev-agent/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "REPOSITORY_PATH": "/absolute/path/to/your/repository",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Option 2: Project-specific .claude.json

For project-specific integration, create `.claude.json` in your repository root:

```json
{
  "mcpServers": {
    "dev-agent": {
      "command": "node",
      "args": [
        "/absolute/path/to/dev-agent/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "REPOSITORY_PATH": ".",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Important:** Replace paths with your actual absolute paths.

## Testing the Integration

### 1. Verify MCP Server Works Standalone

Test the server manually first:

```bash
# Test server startup
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | \
  node /path/to/dev-agent/packages/mcp-server/dist/index.js
```

You should see an initialization response.

### 2. Test with Claude Code

Start a new Claude Code session and try:

```
Can you search for "authentication" in the codebase using dev_search?
```

Or use specific tool syntax:
```
Use dev_search tool with query "user authentication logic" and format "compact"
```

## Available Tools

### 🔍 `dev_search` - Semantic Code Search
**Description:** Search codebase with natural language queries

**Parameters:**
- `query` (required): Natural language search query
- `format` (optional): `compact` (default) or `verbose` 
- `limit` (optional): Results limit (1-50, default: 10)
- `scoreThreshold` (optional): Min relevance (0-1, default: 0)

**Example Usage:**
```
Search for "error handling middleware" in the codebase
Find files that handle user authentication
Look for database connection setup code
```

### 📊 `dev_status` - Repository Health
**Description:** Show repository indexing status and health

**Example Usage:**
```
What's the status of the repository indexing?
Show me the dev-agent health dashboard
```

### 📋 `dev_plan` - Implementation Planning  
**Description:** Generate development plans from GitHub issues

**Parameters:**
- `issue` (required): GitHub issue URL or number
- `format` (optional): `compact` or `verbose`

**Example Usage:**
```
Create a development plan for GitHub issue #42
Analyze issue https://github.com/user/repo/issues/123
```

### 🧭 `dev_explore` - Pattern Discovery
**Description:** Explore code patterns and relationships

**Parameters:**
- `query` (required): Pattern to explore
- `type` (optional): `pattern`, `similar`, `relationships`
- `format` (optional): `compact` or `verbose`

**Example Usage:**
```
Explore error handling patterns in the codebase
Find similar components to UserCard
Show relationships for the auth module
```

### 🐙 `dev_gh` - GitHub Integration
**Description:** Search GitHub issues and PRs semantically

**Parameters:**
- `query` (required): Search query
- `type` (optional): `issues`, `prs`, or `all` (default)
- `format` (optional): `compact` or `verbose`
- `limit` (optional): Results limit (1-50, default: 10)

**Example Usage:**
```
Search GitHub issues related to "database performance"
Find PRs about authentication improvements
Show recent issues tagged with "bug"
```

## Guided Workflow Prompts

The MCP server includes 8 guided workflow prompts:

1. **`analyze-issue`** - Full issue analysis with implementation plan
2. **`find-pattern`** - Search codebase for specific patterns  
3. **`repo-overview`** - Comprehensive repository health dashboard
4. **`find-similar`** - Find code similar to a file
5. **`search-github`** - Search issues/PRs by topic
6. **`explore-relationships`** - Analyze file dependencies
7. **`create-plan`** - Generate detailed task breakdown
8. **`quick-search`** - Fast semantic code search

## Token Cost Awareness

All tools include automatic token cost footers (🪙) for real-time cost tracking:

```
## Search Results
...results here...

🪙 ~109 tokens
```

**Format Strategy:**
- **Compact**: ~30-150 tokens (summaries, lists)
- **Verbose**: ~150-500 tokens (full details, metadata)

## Troubleshooting

### MCP Server Not Loading

1. **Check Claude Code logs:**
   ```bash
   # Enable debug logging
   LOG_LEVEL=debug claude --help
   ```

2. **Verify paths in config are absolute and correct**

3. **Test server manually:**
   ```bash
   REPOSITORY_PATH=/path/to/repo node packages/mcp-server/dist/index.js
   ```

### No Search Results

1. **Ensure repository is indexed:**
   ```bash
   node packages/cli/dist/cli.js storage info
   ```

2. **Re-index if needed:**
   ```bash
   node packages/cli/dist/cli.js index --force
   ```

### Permission Issues

Ensure Claude Code has read access to:
- The MCP server binary
- The repository directory
- The storage directory (`~/.dev-agent/indexes/`)

### Debug Mode

Enable debug logging in your configuration:

```json
{
  "mcpServers": {
    "dev-agent": {
      "command": "node",
      "args": ["/path/to/dev-agent/packages/mcp-server/dist/index.js"],
      "env": {
        "REPOSITORY_PATH": "/path/to/repo",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Example Claude Code Workflow

Here's a typical workflow using dev-agent with Claude Code:

```
1. "What's the current state of the repository?"
   → Uses dev_status to show health dashboard

2. "Find all authentication-related code"  
   → Uses dev_search with query "authentication"

3. "Show me issues related to user login"
   → Uses dev_gh to search GitHub issues

4. "Create a plan for implementing 2FA"
   → Uses dev_plan to generate implementation plan

5. "Find components similar to LoginForm"
   → Uses dev_explore to find similar code patterns
```

## Performance Tips

- Use **compact format** for exploration and quick searches
- Use **verbose format** only when you need full context details  
- Monitor token footers to optimize costs
- Set appropriate `scoreThreshold` to filter low-relevance results
- Use `limit` parameter to control result size

## Multiple Repositories

To work with multiple repositories, add multiple server configurations:

```json
{
  "mcpServers": {
    "dev-agent-frontend": {
      "command": "node",
      "args": ["/path/to/dev-agent/packages/mcp-server/dist/index.js"],
      "env": {
        "REPOSITORY_PATH": "/path/to/frontend-repo"
      }
    },
    "dev-agent-backend": {
      "command": "node", 
      "args": ["/path/to/dev-agent/packages/mcp-server/dist/index.js"],
      "env": {
        "REPOSITORY_PATH": "/path/to/backend-repo"
      }
    }
  }
}
```

## Next Steps

- Try the example workflow above
- Explore the guided prompts for complex tasks
- Integrate into your daily development workflow
- Share feedback for improvements!

## References

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Dev-Agent MCP Server README](./README.md)
- [Dev-Agent Architecture](../../ARCHITECTURE.md)