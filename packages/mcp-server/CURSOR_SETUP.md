# Cursor MCP Setup Guide

This guide shows how to integrate dev-agent with Cursor IDE for seamless AI-powered code assistance.

## Quick Setup (Recommended)

The easiest way to set up dev-agent with Cursor:

```bash
# 1. Install dev-agent globally
npm install -g dev-agent

# 2. Index your repository
cd /path/to/your/repository
dev index .

# 3. Install MCP integration for Cursor (one command!)
dev mcp install --cursor
```

That's it! **Restart Cursor** and dev-agent tools will be available.

## What You Get

Once installed, Cursor gains access to these powerful tools:

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

### `dev_inspect` - File Analysis
Inspect specific files, compare implementations, validate patterns.

```
Compare src/auth/middleware.ts with similar implementations
```

**Actions:**
- `compare`: Find similar code implementations
- `validate`: Check pattern consistency (coming soon)

**Parameters:**
- `action`: Inspection type (required)
- `query`: File path to inspect (required)
- `threshold`: Similarity threshold (0-1, default: 0.7)
- `limit`: Number of results (default: 10, for compare action)
- `format`: Output format (`compact` or `verbose`)

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

**Note:** Automatically reloads when you run `dev github index` to update GitHub data.

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
# List configured MCP servers in Cursor
dev mcp list --cursor

# Uninstall dev-agent from Cursor
dev mcp uninstall --cursor
```

## Dynamic Workspace Detection

Dev-agent intelligently detects your current workspace:

- **Single Config:** One MCP server works for all your projects
- **Auto-Switch:** Automatically adapts when you open different repositories
- **Clean Processes:** No zombie processes when closing workspaces

**How it works:** Cursor sets `WORKSPACE_FOLDER_PATHS` environment variable, which dev-agent uses to determine the active repository.

## GitHub Integration

To enable GitHub issue/PR search:

```bash
# Index GitHub issues and PRs
cd /path/to/your/repository
dev github index

# The dev_gh tool will automatically pick up new data
```

**Auto-Reload:** The MCP server detects changes to the GitHub index and reloads automatically - no restart needed!

## Manual Configuration (Advanced)

If you prefer manual setup, the CLI creates this configuration in Cursor's `mcp.json`:

**Location:**
- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/mcp.json`
- **Linux**: `~/.config/Cursor/User/globalStorage/mcp.json`
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\mcp.json`

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

After setup and Cursor restart:

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
   dev mcp list --cursor
   ```
   Should show `dev-agent-your-repo` entry.

3. **Check Cursor Logs:**
   - Open Cursor
   - Help > Show Logs
   - Look for MCP server errors

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
dev github index
```

The `dev_gh` tool will automatically reload the new data.

### Zombie Processes

If you notice multiple `dev` processes:

**Solution:**
- Restart Cursor
- The latest version includes robust process cleanup

**Verification:**
```bash
ps aux | grep "dev mcp start"
```

Should show one process per open Cursor window.

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
- **GitHub index stale (>24h):** Run `dev github index`
- **Repository not accessible:** Check paths and permissions

## Production Features

Dev-agent includes production-ready stability features:

- **Memory Management:** Circular buffers prevent memory leaks
- **Rate Limiting:** Token bucket algorithm (100 req/min burst, configurable)
- **Retry Logic:** Exponential backoff with jitter for transient failures
- **Health Monitoring:** Proactive component health checks
- **Graceful Shutdown:** Proper cleanup, no zombie processes

## Multiple Repositories

Dev-agent's dynamic workspace detection means:

- **No Need for Multiple Configs:** One server works for all repos
- **Automatic Switching:** Changes context when you switch workspaces
- **Clean Processes:** Each workspace gets its own server instance

If you prefer explicit configurations:

```bash
cd /path/to/project-a
dev mcp install --cursor

cd /path/to/project-b  
dev mcp install --cursor
```

The CLI generates unique server names (`dev-agent-project-a`, `dev-agent-project-b`).

## Updating

When updating dev-agent:

```bash
# Update globally
npm update -g dev-agent

# Rebuild indexes (recommended)
cd /path/to/your/repository
dev index .
dev github index

# Restart Cursor
```

No need to reinstall MCP integration - it automatically uses the latest version.

## Performance Tips

1. **Index Incrementally:** Run `dev index .` after major changes
2. **GitHub Index:** Update periodically with `dev github index`
3. **Health Checks:** Use `dev_health` to monitor component status
4. **Verbose Only When Needed:** Keep `LOG_LEVEL: info` for production

## Next Steps

- See [README.md](./README.md) for MCP server architecture
- See [../../WORKFLOW.md](../../WORKFLOW.md) for development workflow
- See [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) for detailed troubleshooting

## Need Help?

- Check logs: `LOG_LEVEL: debug` in `mcp.json`
- Run health check: `dev_health` tool
- File an issue: https://github.com/your-org/dev-agent/issues

---

**Last Updated:** 2025-11-26  
**Version:** 0.1.0  
**Status:** Production-ready with comprehensive stability features
