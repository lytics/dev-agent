# Troubleshooting Guide

This guide covers common issues and solutions when using dev-agent.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Indexing Problems](#indexing-problems)
- [MCP Server Issues](#mcp-server-issues)
- [Search & Query Issues](#search--query-issues)
- [GitHub Integration](#github-integration)
- [Performance Issues](#performance-issues)
- [Error Messages](#error-messages)

---

## Installation Issues

### `npm install -g dev-agent` fails

**Symptoms:**
- Permission denied errors
- EACCES errors

**Solutions:**

1. **Use sudo (not recommended):**
   ```bash
   sudo npm install -g dev-agent
   ```

2. **Fix npm permissions (recommended):**
   ```bash
   # Use nvm or configure npm prefix
   npm config set prefix ~/.npm-global
   export PATH=~/.npm-global/bin:$PATH
   npm install -g dev-agent
   ```

3. **Use npx instead:**
   ```bash
   npx dev-agent index .
   npx dev-agent mcp install
   ```

### `dev: command not found`

**Cause:** Global npm bin directory not in PATH

**Solution:**
```bash
# Find where npm installs global binaries
npm config get prefix

# Add to your shell profile (.bashrc, .zshrc, etc.)
export PATH="$(npm config get prefix)/bin:$PATH"

# Reload shell
source ~/.zshrc  # or ~/.bashrc
```

### Package conflicts or version errors

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npm install -g dev-agent

# Verify installation
dev --version
```

---

## Indexing Problems

### `dev index .` fails with "No source files found"

**Causes:**
- Running in wrong directory
- Repository has no supported files
- Files are in .gitignore

**Solutions:**

1. **Verify you're in repository root:**
   ```bash
   pwd
   ls -la  # Should see .git directory
   ```

2. **Check for supported files:**
   ```bash
   find . -name "*.ts" -o -name "*.js" -o -name "*.tsx" | head -20
   ```

3. **Check .gitignore:**
   Files in .gitignore are not indexed by default.

### Indexing is very slow

**Expected Performance:**
- Small repos (<100 files): 5-10 seconds
- Medium repos (100-1000 files): 30-60 seconds  
- Large repos (>1000 files): 2-5 minutes

**If slower:**

1. **Check file count:**
   ```bash
   find . -type f -name "*.ts" -o -name "*.js" | wc -l
   ```

2. **Exclude directories:**
   Add to `.gitignore`:
   ```
   node_modules/
   dist/
   build/
   .next/
   coverage/
   ```

3. **Check disk space:**
   ```bash
   df -h ~/.dev-agent/
   ```

### "Vector storage initialization failed"

**Cause:** Storage directory permissions or disk space

**Solutions:**

1. **Check permissions:**
   ```bash
   ls -la ~/.dev-agent/indexes/
   ```

2. **Verify disk space:**
   ```bash
   df -h ~
   ```

3. **Clear and rebuild:**
   ```bash
   rm -rf ~/.dev-agent/indexes/*
   dev index .
   ```

### Index appears empty or outdated

**Solution:**
```bash
# Force re-index
dev index .

# Verify with status
dev mcp start &
# Then use dev_status tool
```

---

## MCP Server Issues

### Server won't start in Cursor/Claude Code

**Diagnosis:**
```bash
# Check if repository is indexed
ls -la ~/.dev-agent/indexes/

# Verify MCP installation
dev mcp list --cursor  # for Cursor
dev mcp list           # for Claude Code

# Test server manually
dev mcp start --verbose
```

**Common Causes:**

1. **Repository not indexed:**
   ```bash
   dev index .
   ```

2. **Wrong repository path:**
   - Cursor: Uses `WORKSPACE_FOLDER_PATHS` automatically
   - Claude Code: Verify with `dev mcp list`

3. **Server already running:**
   ```bash
   ps aux | grep "dev mcp start"
   killall dev  # If needed
   ```

### "Repository not indexed" error in Cursor

**Cause:** Cursor is passing workspace path but repository not indexed

**Solution:**
```bash
# Index the current workspace
dev index .

# Restart Cursor
```

**Verification:**
```bash
# Check what's indexed
ls -la ~/.dev-agent/indexes/
```

### Zombie processes accumulating

**Symptoms:**
```bash
ps aux | grep "dev mcp start"
# Shows multiple dev processes
```

**Solution:**
```bash
# Kill all dev-agent processes
killall dev

# Restart AI tool (Cursor/Claude Code)
```

**Prevention:**
- Update to latest version (includes robust cleanup)
- Restart AI tool when switching projects

### Rate limit errors (429)

**Symptoms:**
- "Rate limit exceeded" errors
- `retryAfterMs` in error message

**Cause:** Exceeded 100 requests/minute per tool

**Solutions:**

1. **Wait for retry period:**
   The error includes `retryAfterMs` - wait that long

2. **Check health:**
   ```
   Use dev_health tool to see rate limit status
   ```

3. **If persistent:**
   - Restart MCP server
   - Check for request loops in your code

### Verbose logging

**Enable debug logs:**

For Cursor, edit server config in `mcp.json`:
```json
"env": {
  "LOG_LEVEL": "debug"
}
```

For Claude Code:
```bash
claude mcp add --env LOG_LEVEL=debug dev-agent -- dev mcp start
```

---

## Search & Query Issues

### `dev_search` returns no results

**Diagnosis:**

1. **Check index status:**
   ```
   Use dev_status tool
   ```

2. **Verify repository is indexed:**
   ```bash
   dev index .
   ```

3. **Try different queries:**
   ```
   # Too specific
   "exact function name getUserProfileById"
   
   # Better
   "user profile retrieval logic"
   ```

**Tips for better searches:**
- Use natural language
- Describe what the code does, not exact names
- Avoid overly specific queries
- Try different phrasings

### Search results are not relevant

**Cause:** Score threshold too low or query too broad

**Solutions:**

1. **Increase score threshold:**
   ```
   dev_search:
     query: "authentication middleware"
     scoreThreshold: 0.3  # Higher = more strict
   ```

2. **Be more specific:**
   ```
   # Too broad
   "utility functions"
   
   # Better
   "date formatting utility functions"
   ```

3. **Use verbose mode:**
   ```
   dev_search:
     query: "your query"
     format: verbose
   ```

### "Vector storage not initialized"

**Cause:** Repository not indexed

**Solution:**
```bash
dev index .
```

---

## GitHub Integration

### `dev gh index` fails

**Common causes:**

1. **Not a git repository:**
   ```bash
   git remote -v  # Should show GitHub remote
   ```

2. **GitHub CLI not configured:**
   ```bash
   gh auth status
   # If not logged in:
   gh auth login
   ```

3. **No issues/PRs:**
   Repository might not have any issues/PRs yet.

### `dev_gh` tool not finding issues

**Diagnosis:**

1. **Check if GitHub is indexed:**
   ```
   Use dev_status tool - should show GitHub section
   ```

2. **Verify state file exists:**
   ```bash
   ls -la ~/.dev-agent/indexes/*/github-state.json
   ```

3. **Re-index:**
   ```bash
   dev gh index
   ```

**Note:** The `dev_gh` tool automatically reloads when you run `dev gh index` - no restart needed!

### GitHub index is stale

**Check age:**
```
Use dev_health tool - warns if GitHub index >24h old
```

**Solution:**
```bash
dev gh index
```

**Automation (optional):**
```bash
# Add to crontab for daily updates
0 9 * * * cd /path/to/repo && dev gh index
```

---

## Performance Issues

### Slow response times

**Expected:**
- `dev_search`: 100-500ms
- `dev_status`: 50-100ms
- `dev_explore`: 200-800ms
- `dev_plan`: 5-15 seconds
- `dev_gh`: 100-300ms

**If slower:**

1. **Check system resources:**
   ```bash
   top  # Look for high CPU/memory usage
   ```

2. **Check index size:**
   ```bash
   du -sh ~/.dev-agent/indexes/*
   ```

3. **Reduce result limit:**
   ```
   dev_search:
     query: "your query"
     limit: 5  # Instead of default 10
   ```

4. **Use compact format:**
   ```
   dev_search:
     query: "your query"
     format: compact  # Faster than verbose
   ```

### High memory usage

**Cause:** Large repositories or many concurrent requests

**Solutions:**

1. **Check repository size:**
   ```bash
   dev_status  # Shows file count and index size
   ```

2. **Restart MCP server:**
   - Restart Cursor/Claude Code

3. **Monitor health:**
   ```
   dev_health --verbose
   ```

---

## Error Messages

### "ETIMEDOUT" or "ECONNRESET"

**Cause:** Network issues or system resources

**Solution:**
- These are automatically retried (3 attempts with exponential backoff)
- If persistent, check system resources
- Restart MCP server

### "Tool execution failed"

**Diagnosis:**
```
Use dev_health tool to check component status
```

**Common causes:**
1. Vector storage not accessible
2. Repository path changed
3. GitHub state corrupted

**Solution:**
```bash
# Re-index everything
dev index .
dev gh index

# Restart MCP server
```

### "Invalid arguments" or "Validation error"

**Cause:** Incorrect tool parameters

**Solution:**
Check the tool's input schema:
- `dev_search`: Requires `query` (string)
- `dev_explore`: Requires `action` and `query`
- `dev_plan`: Requires `issue` (number)
- `dev_gh`: Requires `action`

### "Adapter not found"

**Cause:** MCP server not properly initialized

**Solution:**
1. Verify installation:
   ```bash
   dev mcp list --cursor  # or without --cursor for Claude Code
   ```

2. Restart AI tool

3. Check server health:
   ```
   dev_health
   ```

---

## Platform-Specific Issues

### macOS: "Operation not permitted"

**Cause:** SIP (System Integrity Protection) or permissions

**Solution:**
```bash
# Check permissions
ls -la ~/.dev-agent/

# Fix permissions
chmod -R 755 ~/.dev-agent/
```

### Windows: Path issues

**Symptoms:**
- Backslash vs forward slash errors
- "Path not found" errors

**Solution:**
- Use forward slashes in configuration: `C:/Users/...` not `C:\Users\...`
- Or use double backslashes: `C:\\Users\\...`

### Linux: npm global install permissions

**Solution:**
```bash
# Option 1: Use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
npm install -g dev-agent

# Option 2: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

---

## Advanced Diagnostics

### Enable verbose logging

**Cursor:**
Edit `~/.cursor/mcp.json` or Cursor's globalStorage `mcp.json`:
```json
"env": {
  "LOG_LEVEL": "debug"
}
```

**Claude Code:**
```bash
claude mcp add --env LOG_LEVEL=debug dev-agent -- dev mcp start
```

### Check component health

```
Use dev_health tool with verbose flag:

dev_health --verbose

Shows:
- Vector storage status
- Repository accessibility
- GitHub index age
- Uptime
- Detailed diagnostics
```

### Manual server testing

Test the MCP server directly:

```bash
# Start server manually
dev mcp start --verbose

# In another terminal, send test message
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | dev mcp start

# Should list all 9 tools: dev_search, dev_refs, dev_map, dev_history, dev_status, dev_plan, dev_explore, dev_gh, dev_health
```

### Inspect storage

```bash
# Check storage location
ls -la ~/.dev-agent/indexes/

# Each repository has its own hash
# Example: ~/.dev-agent/indexes/a1b2c3d4e5f6/

# Check what's inside
ls -la ~/.dev-agent/indexes/*/

# Files:
# - vectors/ - LanceDB vector storage
# - indexer-state.json - Repository indexing metadata
# - github-state.json - GitHub issues/PRs data
# - metadata.json - Repository metadata
```

### Clear all data and start fresh

```bash
# Backup (optional)
cp -r ~/.dev-agent/indexes ~/.dev-agent/indexes.backup

# Clear all indexes
rm -rf ~/.dev-agent/indexes/*

# Re-index your repositories
cd /path/to/your/repo
dev index .
dev gh index

# Reinstall MCP
dev mcp install --cursor  # or without --cursor for Claude Code
```

---

## Getting Help

### Check version

```bash
dev --version
```

### Run tests (for development)

```bash
cd /path/to/dev-agent
pnpm test
```

### File an issue

If you encounter a bug:

1. **Gather information:**
   ```bash
   dev --version
   node --version
   npm --version
   uname -a  # or ver on Windows
   ```

2. **Get diagnostics:**
   ```
   Use dev_health --verbose
   ```

3. **Enable debug logs:**
   Set `LOG_LEVEL=debug` and reproduce issue

4. **File issue:** https://github.com/lytics/dev-agent/issues

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Version info
- Diagnostic output
- Relevant logs

---

## Common Workflows

### After updating dev-agent

```bash
# Update global installation
npm update -g dev-agent

# Re-index repositories (recommended)
cd /path/to/your/repo
dev index .
dev gh index

# Restart AI tool
```

### Switching between repositories

**Cursor:**
- Automatically detects workspace changes
- Single MCP config works for all repos
- No action needed!

**Claude Code:**
- Each repository needs separate `dev mcp install`
- Or use project-specific `.mcp.json`

### When repository changes significantly

```bash
# Re-index after major changes
dev index .

# Check status
dev_status

# Verify health
dev_health
```

### Debugging search quality

1. **Use verbose mode:**
   ```
   dev_search:
     query: "your query"
     format: verbose
     scoreThreshold: 0.2
   ```

2. **Check indexed components:**
   ```
   dev_status --section indexes
   ```

3. **Try different queries:**
   - Describe what code does
   - Use domain terminology
   - Avoid exact variable names

---

## Known Limitations

### Vector Search

- **Context window:** Limited by LLM context window (queries must fit)
- **Language support:** Best for TypeScript/JavaScript, good for Python, basic for others
- **Binary files:** Not indexed
- **Generated files:** In dist/, build/, etc. are skipped

### GitHub Integration

- **Requires gh CLI:** Must have GitHub CLI installed and authenticated
- **Public repos only:** Private repos require authentication
- **Rate limits:** GitHub API has rate limits (handled with retry logic)

### MCP Protocol

- **STDIO only:** Currently uses STDIO transport (not HTTP)
- **Single client:** One AI tool at a time per server instance
- **No streaming:** Results are batched, not streamed

---

## Performance Optimization

### For large repositories

1. **Index incrementally:**
   ```bash
   # Only index changed files (future feature)
   # For now, full re-index is fast enough
   dev index .
   ```

2. **Exclude large directories:**
   Add to `.gitignore`:
   ```
   vendor/
   third_party/
   node_modules/
   ```

3. **Use compact format:**
   - Faster than verbose
   - Sufficient for most use cases

### For many repositories

1. **Centralized storage:**
   - Already done! (`~/.dev-agent/indexes/`)
   - Each repo has its own hash-based directory

2. **Cursor dynamic workspace:**
   - Single MCP config for all repos
   - Automatic switching

3. **Selective indexing:**
   - Only index repos you actively work on
   - GitHub index optional (only if using `dev_gh`)

---

## Edge Cases

### Monorepo with multiple projects

**Solution:**
- Index at monorepo root
- Search works across all projects
- Use `dev_explore` to find related code

### Non-git repositories

**Impact:**
- Still works! Git is not required
- GitHub integration won't work
- Repository health check shows warning

**Solution:**
```bash
# Index works normally
dev index .

# Skip GitHub indexing
# Just use dev_search, dev_status, dev_explore, dev_plan
```

### Very large files (>10MB)

**Behavior:**
- Large files may be skipped during indexing
- Binary files are always skipped

**Solution:**
- This is expected and by design
- Generated files should be in .gitignore anyway

### Symlinks and junctions

**Behavior:**
- Symlinks are followed by default
- May cause duplicate indexing

**Solution:**
- Add symlink targets to `.gitignore` if problematic

---

## Health Check Guide

The `dev_health` tool provides comprehensive diagnostics:

### Interpreting Health Status

**✅ Healthy:**
- Vector storage has data
- Repository is accessible and is a Git repo
- GitHub index exists and is recent (<24h)

**⚠️ Degraded:**
- Vector storage is empty (not indexed)
- Repository is not a Git repo (but accessible)
- GitHub index is stale (>24h old)

**❌ Unhealthy:**
- Vector storage not accessible
- Repository not accessible
- Critical failures

### Health Check Actions

**Vector Storage Warning:**
```bash
dev index .
```

**GitHub Index Stale:**
```bash
dev gh index
```

**Repository Not Accessible:**
- Check paths and permissions
- Verify repository hasn't moved

---

## FAQ

### Q: Can I use dev-agent with private repositories?

**A:** Yes! It's local-first - all data stays on your machine. For GitHub integration with private repos, ensure `gh` CLI is authenticated.

### Q: Does dev-agent send data to the cloud?

**A:** No! Everything runs locally. Vector embeddings, indexing, and search all happen on your machine.

### Q: How much disk space does indexing use?

**A:** Typically 10-50MB per repository, depending on size. Check with:
```bash
du -sh ~/.dev-agent/indexes/
```

### Q: Can I delete the indexes?

**A:** Yes, safely delete `~/.dev-agent/indexes/` anytime. Just re-run `dev index .` to rebuild.

### Q: How often should I re-index?

**A:** 
- After major code changes (adding features, refactoring)
- Weekly for active projects
- Monthly for stable projects
- Use `dev_health` to check if index is stale

### Q: Can multiple AI tools use dev-agent simultaneously?

**A:** Each tool gets its own MCP server instance. Cursor and Claude Code can run simultaneously with separate configs.

### Q: What happens if I move my repository?

**Cursor:** Automatically detects new location (uses workspace path)

**Claude Code:** Re-run `dev mcp install` in new location

---

## Still Having Issues?

1. **Check docs:**
   - [README.md](./README.md) - Overview and features
   - [CURSOR_SETUP.md](./packages/mcp-server/CURSOR_SETUP.md) - Cursor setup
   - [CLAUDE_CODE_SETUP.md](./packages/mcp-server/CLAUDE_CODE_SETUP.md) - Claude Code setup

2. **Use health check:**
   ```
   dev_health --verbose
   ```

3. **Enable debug logging:**
   Set `LOG_LEVEL=debug` in your MCP config

4. **File an issue:**
   https://github.com/lytics/dev-agent/issues

Include:
- `dev --version`
- `dev_health --verbose` output
- Steps to reproduce
- Expected vs actual behavior
- Debug logs (if applicable)

---

**Last Updated:** 2025-11-26  
**Version:** 0.1.0  
**Need help?** File an issue or check our [documentation](./README.md)

