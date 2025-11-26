# @lytics/dev-agent

**Deep code intelligence + AI subagents via MCP**

Local-first semantic code search, GitHub integration, and development planning for AI tools like Cursor and Claude Code.

## Quick Start

```bash
# Install globally
npm install -g @lytics/dev-agent

# Index your repository
cd /path/to/your/repo
dev index .

# Install MCP integration
dev mcp install --cursor  # For Cursor IDE
dev mcp install           # For Claude Code

# Start using dev-agent in your AI tool!
```

## Features

- 🔍 **Semantic Code Search** - Natural language queries across your codebase
- 🐙 **GitHub Integration** - Search issues/PRs with semantic understanding
- 📋 **Implementation Planning** - Generate plans from GitHub issues with code context
- 🔎 **Code Exploration** - Discover patterns, find similar code, analyze relationships
- 💚 **Health Monitoring** - Check component status and system health
- 📊 **Repository Status** - View indexing progress and statistics

## MCP Tools

When integrated with Cursor or Claude Code, you get 6 powerful tools:

- `dev_search` - Semantic code search
- `dev_status` - Repository status and health
- `dev_explore` - Code pattern discovery
- `dev_plan` - Implementation planning from issues
- `dev_gh` - GitHub issue/PR search
- `dev_health` - Component health checks

## Requirements

- Node.js >= 22 (LTS)
- For GitHub integration: [GitHub CLI](https://cli.github.com/)

## Production Features

- 🛡️ Rate limiting (100 req/min burst per tool)
- 🔄 Automatic retry with exponential backoff
- 💚 Health checks for all components
- 🧹 Memory-safe (circular buffers, proper cleanup)
- 🔌 Graceful shutdown (no zombie processes)

## Documentation

- **Full Documentation:** https://github.com/lytics/dev-agent
- **Troubleshooting:** https://github.com/lytics/dev-agent/blob/main/TROUBLESHOOTING.md
- **Cursor Setup:** https://github.com/lytics/dev-agent/blob/main/packages/mcp-server/CURSOR_SETUP.md
- **Claude Code Setup:** https://github.com/lytics/dev-agent/blob/main/packages/mcp-server/CLAUDE_CODE_SETUP.md

## CLI Commands

```bash
# Indexing
dev index .                    # Index current repository
dev gh index                   # Index GitHub issues/PRs

# MCP Server Integration
dev mcp install --cursor       # Install for Cursor
dev mcp install                # Install for Claude Code
dev mcp uninstall [--cursor]   # Remove integration
dev mcp list [--cursor]        # List installed servers
dev mcp start [--verbose]      # Start MCP server manually

# Help
dev --help                     # Show all commands
dev <command> --help           # Help for specific command
```

## How It Works

1. **Index** - Scans your TypeScript/JavaScript codebase and builds semantic vectors
2. **Search** - Uses local embeddings (all-MiniLM-L6-v2) for semantic understanding
3. **Store** - LanceDB vector storage, all data stays on your machine
4. **Integrate** - MCP protocol connects to Cursor/Claude Code
5. **Query** - AI tools can now understand your codebase semantically

## Local-First

All processing happens on your machine:
- ✅ No cloud services required
- ✅ No API keys needed
- ✅ Your code never leaves your computer
- ✅ Works completely offline (after initial model download)

## Technology

- **Analysis:** TypeScript Compiler API + ts-morph
- **Embeddings:** @xenova/transformers (all-MiniLM-L6-v2)
- **Vector Storage:** LanceDB
- **GitHub:** GitHub CLI for local metadata
- **Protocol:** Model Context Protocol (MCP)

## Examples

```bash
# Find authentication-related code
dev_search: "JWT token validation middleware"

# Plan implementation from GitHub issue
dev_plan: issue #42

# Find similar code patterns
dev_explore: similar src/auth/middleware.ts

# Search GitHub issues semantically
dev_gh: search "memory leak in vector storage"

# Check system health
dev_health: verbose
```

## Support

- **GitHub Issues:** https://github.com/lytics/dev-agent/issues
- **Discussions:** https://github.com/lytics/dev-agent/discussions

## License

MIT

---

**Status:** Production-ready v0.1.0 | **Tests:** 1100+ passing | **Node:** >=22 LTS

