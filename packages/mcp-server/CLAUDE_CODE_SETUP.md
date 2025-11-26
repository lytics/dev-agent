# Claude Code MCP Setup Guide

This guide shows how to integrate dev-agent with Claude Code for seamless AI-powered code assistance.

## Quick Setup (Recommended)

The easiest way to set up dev-agent with Cursor:

```bash
# 1. Install dev-agent globally
npm install -g dev-agent

# 2. Index your repository
cd /path/to/your/repository
dev index .

# 3. Install MCP integration for Claude Code (one command!)
dev mcp install
```

That's it! **Restart Claude Code** and dev-agent tools will be available.

## What You Get

Once installed, Claude Code gains access to these powerful tools:

### `dev_search` - Semantic Code Search
Search your codebase using natural language.

```
Find authentication middleware that handles JWT tokens
```

**Parameters:**
- `query` (required): Natural language search query
- `format`: `compact` (default) or `verbose`
- `limit`: Number of results (1-50, default: 10)
- `scoreThreshold`: Minimum relevance (0-1, default: 0)

### `dev_status` - Repository Status
Get indexing status and repository health information.

```
Show me the repository status
```

**Parameters:**
- `section`: `summary`, `repo`, `indexes`, `github`, `health` (default: `summary`)
- `format`: `compact` (default) or `verbose`

### `dev_explore` - Code Exploration
Explore code patterns, find similar code, analyze relationships.

```
Find code similar to src/auth/middleware.ts
```

**Actions:**
- `pattern`: Search by concept/pattern
- `similar`: Find similar code to a file
- `relationships`: Map dependencies

**Parameters:**
- `action`: Exploration type (required)
- `query`: Search query or file path (required)
- `threshold`: Similarity threshold (0-1, default: 0.7)
- `limit`: Number of results (default: 10)
- `fileTypes`: Filter by extensions (e.g., `[".ts", ".js"]`)

### `dev_plan` - Generate Implementation Plans
Create actionable implementation plans from GitHub issues.

```
Generate a plan for GitHub issue #42
```

**Parameters:**
- `issue` (required): GitHub issue number
- `detailLevel`: `simple` (4-8 tasks) or `detailed` (10-15 tasks, default)
- `useExplorer`: Use semantic search for relevant code (default: true)
- `format`: `compact` (default) or `verbose`

### `dev_gh` - GitHub Issue/PR Search
Search GitHub issues and pull requests with semantic understanding.

```
Find issues related to authentication bugs
```

**Actions:**
- `search`: Semantic search across issues/PRs
- `context`: Get full context for an issue/PR
- `related`: Find related issues/PRs

**Parameters:**
- `action` (required): Search action
- `query`: Search query (for `search` action)
- `number`: Issue/PR number (for `context`/`related` actions)
- `type`: Filter by `issue` or `pull_request`
- `state`: Filter by `open`, `closed`, or `merged`
- `labels`: Filter by labels (e.g., `["bug", "enhancement"]`)
- `limit`: Number of results (default: 10)

**Note:** Automatically reloads when you run `dev gh index` to update GitHub data.

### `dev_health` - Server Health Check
Check the health of dev-agent MCP server and its components.

```
Check server health
```

**Parameters:**
- `verbose`: Include detailed diagnostics (default: false)

**Checks:**
- Vector storage (indexed code)
- Repository accessibility
- GitHub index status and age

## Management Commands

```bash
# List configured MCP servers in Claude Code
dev mcp list

# Uninstall dev-agent from Claude Code
dev mcp uninstall
```

## Repository-Specific Configuration

Dev-agent supports multiple repository setups:

- **Global Config:** Configure once in `~/.config/claude/claude_desktop_config.json`
- **Project Config:** Use `.claude.json` in each repository root for project-specific settings
- **Clean Processes:** Proper cleanup when Claude Code exits

**Recommendation:** Use the global config (created by `dev mcp install`) for simplicity, or project-specific configs for custom settings.

## GitHub Integration

To enable GitHub issue/PR search:

```bash
# Index GitHub issues and PRs
cd /path/to/your/repository
dev gh index

# The dev_gh tool will automatically pick up new data
```

**Auto-Reload:** The MCP server detects changes to the GitHub index and reloads automatically - no restart needed!

## Manual Configuration (Advanced)

If you prefer manual setup, the CLI creates this configuration in Claude Code's config:

**Location:**
- **macOS/Linux**: `~/.config/claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "dev-agent-your-repo": {
      "command": "/usr/local/bin/dev",
      "args": ["mcp", "start"],
      "env": {
        "REPOSITORY_PATH": "/absolute/path/to/your/repository",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Note:** The CLI automatically generates unique server names for each repository.

## Verification

After setup and Claude Code restart:

1. Open a file in your repository
2. Try a search: `Find database connection logic`
3. Check status: `Show repository status`
4. Check health: `Check server health`

You should see semantic search results and repository information.

## Troubleshooting

### Server Not Starting

1. **Check Repository is Indexed:**
   ```bash
   cd /path/to/your/repository
   dev index .
   ```

2. **Verify MCP Installation:**
   ```bash
   dev mcp list
   ```
   Should show `dev-agent` entry.

3. **Check Claude Code Logs:**
   - Open Claude Code CLI
   - Check system logs for MCP errors
   - Look for connection issues

4. **Try Verbose Mode:**
   Edit `mcp.json` and set:
   ```json
   "env": {
     "LOG_LEVEL": "debug"
   }
   ```

### No Search Results

**Cause:** Repository not indexed or stale index.

**Solution:**
```bash
cd /path/to/your/repository
dev index .
```

### GitHub Tools Not Working

**Cause:** GitHub data not indexed.

**Solution:**
```bash
cd /path/to/your/repository
dev gh index
```

The `dev_gh` tool will automatically reload the new data.

### Zombie Processes

If you notice multiple `dev` processes:

**Solution:**
- Restart Claude Code
- The latest version includes robust process cleanup

**Verification:**
```bash
ps aux | grep "dev mcp start"
```

Should show one process for Claude Code.

### Rate Limiting

If you see "Rate limit exceeded" errors:

**Cause:** Too many requests in short time (default: 100 requests/minute per tool).

**Solution:**
- Wait for the specified `retryAfterMs` period
- Check health: `Check server health`
- Rate limits reset automatically

### Health Check Issues

Run `dev_health` tool to diagnose:

```
Check server health with verbose details
```

**Common Issues:**
- **Vector storage warning:** Run `dev index .`
- **GitHub index stale (>24h):** Run `dev gh index`
- **Repository not accessible:** Check paths and permissions

## Production Features

Dev-agent includes production-ready stability features:

- **Memory Management:** Circular buffers prevent memory leaks
- **Rate Limiting:** Token bucket algorithm (100 req/min burst, configurable)
- **Retry Logic:** Exponential backoff with jitter for transient failures
- **Health Monitoring:** Proactive component health checks
- **Graceful Shutdown:** Proper cleanup, no zombie processes

## Multiple Repositories

For multiple repositories, you have two options:

**Option 1: Multiple Server Entries** (Recommended)
```bash
cd /path/to/project-a
dev mcp install

cd /path/to/project-b  
dev mcp install
```

The CLI generates unique server names (`dev-agent-project-a`, `dev-agent-project-b`) in `claude_desktop_config.json`.

**Option 2: Project-Specific Configs**

Create `.claude.json` in each repository root:
```json
{
  "mcpServers": {
    "dev-agent": {
      "command": "dev",
      "args": ["mcp", "start"],
      "env": {
        "REPOSITORY_PATH": "."
      }
    }
  }
}
```

## Updating

When updating dev-agent:

```bash
# Update globally
npm update -g dev-agent

# Rebuild indexes (recommended)
cd /path/to/your/repository
dev index .
dev gh index

# Restart Claude Code
```

No need to reinstall MCP integration - it automatically uses the latest version.

## Performance Tips

1. **Index Incrementally:** Run `dev index .` after major changes
2. **GitHub Index:** Update periodically with `dev gh index`
3. **Health Checks:** Use `dev_health` to monitor component status
4. **Verbose Only When Needed:** Keep `LOG_LEVEL: info` for production

## Next Steps

- See [README.md](./README.md) for MCP server architecture
- See [../../docs/WORKFLOW.md](../../docs/WORKFLOW.md) for development workflow
- See [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) for detailed troubleshooting

## Need Help?

- Check logs: `LOG_LEVEL: debug` in `mcp.json`
- Run health check: `dev_health` tool
- File an issue: https://github.com/your-org/dev-agent/issues

---

**Last Updated:** 2025-11-26  
**Version:** 0.1.0  
**Status:** Production-ready with comprehensive stability features
