# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Production hardening improvements (memory management, rate limiting, health checks)

## [0.1.0] - 2025-11-26

### Added

#### Core Features
- **MCP Server** with 5 specialized adapters for AI tool integration
  - `dev_search` - Semantic code search with type-aware understanding
  - `dev_status` - Repository health and statistics
  - `dev_plan` - Implementation planning from GitHub issues
  - `dev_inspect` - File analysis (similarity + pattern checking)
  - `dev_gh` - GitHub issue/PR search with offline caching
- **Multi-language Support** - TypeScript, JavaScript, Go, Python, Rust, Markdown
- **Local-first Architecture** - All embeddings and indexing run locally
- **Subagent System** - Coordinator with Explorer, Planner, and PR agents
- **Event Bus** - Async pub/sub communication between components
- **Observability** - Request tracking, structured logging, p50/p95/p99 metrics

#### Developer Experience
- **CLI** - Complete command-line interface with Commander.js
- **Cursor Integration** - One-command setup (`dev mcp install --cursor`)
- **Claude Code Integration** - MCP server configuration for Claude Desktop
- **Centralized Storage** - Indexes stored globally in `~/.dev-agent/indexes/`
- **Auto-reload** - GitHub index automatically reloads on changes
- **Token Estimation** - Real-time cost tracking (<1% error rate)

#### Infrastructure
- **Circular Buffers** - Prevent memory leaks in long-running processes
- **Type Safety** - TypeScript strict mode enabled throughout
- **Testing** - 1012 tests passing with comprehensive coverage
- **CI/CD** - GitHub Actions for linting, testing, and releases
- **Monorepo** - Turborepo + pnpm workspaces for efficient builds

### Changed
- Message history uses circular buffer (max 1000 messages)
- Response times use circular buffer (max 1000 entries)
- Improved error messages with actionable suggestions

### Fixed
- Memory leaks from unbounded array growth
- Zombie MCP server processes when Cursor closes
- GitHub index not reloading after `dev github index`
- STDIO transport not handling stdin closure properly

### Security
- Input validation on all MCP tool adapters
- Rate limiting per tool (100 requests/minute)
- Graceful error handling without exposing internals
- Memory bounds to prevent resource exhaustion
- No telemetry or cloud dependencies - fully local

### Performance
- Response times < 2s for most operations
- Memory-bounded data structures prevent leaks
- Lazy loading for GitHub indexer
- Efficient vector search with LanceDB

### Documentation
- Comprehensive README with examples
- Architecture documentation (ARCHITECTURE.md)
- Contribution guidelines (CONTRIBUTING.md)
- Agent and workflow documentation (AGENTS.md, CLAUDE.md)
- MCP setup guides for Cursor and Claude Code

### Known Limitations
- STDIO transport only (HTTP planned for v0.2.0)
- Sequential tool execution (parallel planned for v0.2.0)
- No built-in caching layer (planned for v0.2.0)
- English language content optimized (multilingual improvements planned)

## [0.0.1] - 2025-11-20

### Added
- Initial development setup
- Core repository scanner with ts-morph
- Vector storage with LanceDB
- Basic CLI commands

---

## Upgrade Guides

### Upgrading to 0.1.0

**From Development Versions:**

1. Install globally:
   ```bash
   npm install -g dev-agent
   ```

2. Re-index your repositories:
   ```bash
   cd /path/to/repo
   dev index .
   dev github index  # If using GitHub integration
   ```

3. Reinstall MCP integration:
   ```bash
   dev mcp install --cursor
   # or
   dev mcp install  # for Claude Code
   ```

4. Restart your IDE (Cursor/Claude Desktop)

**Breaking Changes:**
- None (first public release)

**Deprecations:**
- None

---

## Release Notes

### v0.1.0 Release Highlights

This is the first public release of dev-agent! 🎉

**What makes dev-agent special:**
- **100% Local** - No API keys, no cloud dependencies
- **Deep Understanding** - AST-based analysis + semantic search
- **Action-Capable** - Not just search, but planning and automation
- **MCP-Native** - First-class integration with Claude and Cursor
- **Production-Grade** - Memory-bounded, rate-limited, well-tested

**Use Cases:**
- Semantic code search across large codebases
- Implementation planning from GitHub issues
- Code pattern discovery and analysis
- Offline GitHub issue/PR search
- Repository health monitoring

**Next Steps:**
- Try the examples in `examples/`
- Read the setup guides for Cursor or Claude Code
- Join discussions and provide feedback
- Contribute! See CONTRIBUTING.md

---

## Support

- **Issues**: [GitHub Issues](https://github.com/lytics/dev-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/lytics/dev-agent/discussions)
- **Security**: See [SECURITY.md](SECURITY.md)

[unreleased]: https://github.com/lytics/dev-agent/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lytics/dev-agent/releases/tag/v0.1.0
[0.0.1]: https://github.com/lytics/dev-agent/releases/tag/v0.0.1

