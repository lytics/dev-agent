# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **⚠️ IMPORTANT: Before starting any implementation work, read [`WORKFLOW.md`](./WORKFLOW.md) for the development workflow, including branch naming, commit format, PR process, and testing standards.**

## Project Overview

Dev-Agent is a local-first repository context provider for AI tools like Claude Code. It helps AI tools understand codebases without hallucinations by providing semantic search, code analysis, and GitHub integration through a monorepo architecture.

## Development Commands

### Essential Commands
```bash
# Install dependencies (required first)
pnpm install

# Build all packages (required before typecheck)
pnpm build

# Run tests (from root using centralized vitest config)
pnpm test
pnpm test:watch
pnpm test:coverage

# Linting and formatting
pnpm lint
pnpm format

# Type checking (run AFTER build)
pnpm typecheck

# Development mode
pnpm dev

# Clean all build outputs
pnpm clean

# Release management
pnpm changeset
pnpm version
pnpm release
```

### Package-specific Commands
```bash
# Build specific package
pnpm -F "@lytics/dev-agent-core" build

# Development watch mode for specific package
pnpm -F "@lytics/dev-agent-core" dev
```

## Architecture

### Monorepo Structure
- **packages/core**: Repository scanning, vector storage, GitHub integration, context API
- **packages/cli**: Command-line interface using Commander.js
- **packages/subagents**: Subagent system (coordinator, planner, explorer, PR subagent)
- **packages/integrations**: Tool integrations (Claude Code, VS Code)
- **packages/logger**: Centralized logging system (@lytics/kero)
- **packages/mcp-server**: MCP (Model Context Protocol) server implementation

### Key Technologies
- TypeScript Compiler API & ts-morph for TypeScript/JS analysis
- tree-sitter WASM for Go analysis (extensible to Python/Rust)
- LanceDB for vector storage (replaced Chroma DB for better performance)
- @xenova/transformers for local embeddings (all-MiniLM-L6-v2)
- remark for Markdown parsing
- GitHub CLI for metadata integration
- Turborepo for build orchestration
- Biome for linting/formatting
- Vitest for testing (1500+ tests)
- MCP (Model Context Protocol) for AI tool integration
- Token Bucket algorithm for rate limiting
- Exponential backoff for retry logic

**Supported Languages:** TypeScript, JavaScript, Go, Markdown

### Core Components
- **Scanner**: Uses ts-morph (TS/JS) and tree-sitter (Go) to extract components and relationships
- **Vector Storage**: Semantic search with LanceDB and @xenova/transformers embeddings
- **GitHub Integration**: Metadata extraction and semantic search for issues/PRs using GitHub CLI
- **Subagent System**: Specialized agents for planning, exploration, and PR management
- **MCP Server**: Model Context Protocol server for AI tool integration
- **Logger**: Centralized logging with multiple transports and formatters (@lytics/kero)
- **Rate Limiting**: Token bucket algorithm prevents abuse (configurable per-tool)
- **Retry Logic**: Exponential backoff with jitter for transient failures
- **Health Monitoring**: Component health checks for diagnostics

## Build Dependencies

Critical build order due to package interdependencies:
1. `@lytics/kero` (logger - no dependencies)
2. `@lytics/dev-agent-core` (depends on logger)
3. `@lytics/dev-agent-cli` (depends on core)
4. `@lytics/dev-agent-subagents` (depends on core)
5. `@lytics/dev-agent-mcp-server` (depends on core, subagents)
6. `@lytics/dev-agent-integrations` (depends on multiple packages)

Always run `pnpm build` before `pnpm typecheck` since TypeScript needs built `.d.ts` files.

## Testing

- Tests use centralized Vitest configuration at root
- Test pattern: `packages/**/*.{test,spec}.ts`
- Run from root only: `pnpm test` (NOT `turbo test`)
- Package aliases configured in vitest.config.ts for cross-package imports
- Coverage reporting with v8 provider
- Integration tests included for complex components

## Package Management

- Use workspace protocol for internal dependencies: `"@lytics/dev-agent-core": "workspace:*"`
- All packages currently private (`"private": true`)
- Package scoped as `@lytics/dev-agent-*` and `@lytics/kero`
- Changeset-based release management
- Node.js version requirement: >=22
- PNPM package manager required

## Development Workflow

- Husky pre-commit hooks for code quality
- Commitlint for conventional commit messages
- Biome for fast linting and formatting
- Turborepo for efficient monorepo builds
- Coverage tracking with comprehensive reporting

## MCP Server

The MCP server provides AI tools with structured access to repository context through:
- Adapter pattern for tool integration
- Built-in adapters for search, exploration, planning, GitHub integration, health monitoring
- Configurable formatters (compact/verbose)
- STDIO transport for AI tool communication
- Rate limiting (100 req burst, configurable per-tool with token bucket algorithm)
- Retry logic with exponential backoff for transient failures
- Health checks for proactive monitoring
- Comprehensive test coverage (1100+ tests including integration tests)

## Claude Code Integration

Dev-Agent provides seamless integration with Claude Code through the Model Context Protocol (MCP). This enables Claude Code to access repository context, semantic search, and development planning tools.

### Quick Setup

For end users (streamlined workflow):
```bash
# Install dev-agent globally
npm install -g dev-agent

# Index your repository
cd /path/to/your/repo
dev index .

# Install MCP integration in Claude Code (one command!)
dev mcp install
```

That's it! Claude Code now has access to all dev-agent capabilities.

### Available Tools in Claude Code & Cursor (9 tools)

Once installed, AI tools gain access to:

- **`dev_search`** - Semantic code search (USE THIS FIRST for conceptual queries)
- **`dev_refs`** - Find callers/callees of functions (for specific symbols)
- **`dev_map`** - Codebase structure with component counts and change frequency
- **`dev_history`** - Semantic search over git commits (who changed what and why)
- **`dev_plan`** - Assemble context for GitHub issues (code + history + patterns)
- **`dev_inspect`** - Inspect files (compare similar implementations, check patterns)
- **`dev_gh`** - Search GitHub issues/PRs semantically
- **`dev_status`** - Repository indexing status
- **`dev_health`** - Server health checks

### MCP Command Reference

```bash
# Start MCP server (usually automated)
dev mcp start [--verbose] [--transport stdio|http]

# Install dev-agent in Claude Code
dev mcp install [--repository /path/to/repo]

# Install dev-agent in Cursor
dev mcp install --cursor [--repository /path/to/repo]

# Remove dev-agent from Claude Code/Cursor
dev mcp uninstall [--cursor]

# List all configured MCP servers
dev mcp list [--cursor]
```

### Cursor Integration

Dev-Agent seamlessly integrates with Cursor IDE through MCP:

```bash
# Install for Cursor (one command!)
dev mcp install --cursor

# List Cursor MCP servers
dev mcp list --cursor

# Uninstall from Cursor
dev mcp uninstall --cursor
```

**Features:**
- Dynamic workspace detection (`WORKSPACE_FOLDER_PATHS`)
- Single server config works across all projects
- Automatic context switching when changing workspaces
- Graceful process cleanup (no zombie processes)
- Robust stdin closure detection

### Manual Configuration

For advanced users or development, you can manually configure the MCP server:

1. **Server Configuration**: The MCP server runs with full feature set including:
   - Subagent coordinator with explorer, planner, and PR agents
   - All 9 adapters (search, refs, map, history, status, plan, explore, github, health)
   - STDIO transport for direct AI tool communication
   - Rate limiting (100 req/min default, configurable per-tool)
   - Retry logic with exponential backoff
   - Auto-reload for GitHub index changes

2. **Storage**: Uses centralized storage at `~/.dev-agent/indexes/` for cross-project sharing

3. **Requirements**: Repository must be indexed first with `dev index .`

4. **Production Features**:
   - Memory leak prevention (circular buffers for history/metrics)
   - Graceful shutdown (proper event listener cleanup)
   - Health monitoring (`dev_health` tool)
   - Comprehensive logging with @lytics/kero

5. **Performance Configuration**:
   - Configurable concurrency via environment variables
   - Auto-detection based on system resources (CPU/memory)
   - Environment variables:
     - `DEV_AGENT_CONCURRENCY` - global concurrency setting
     - `DEV_AGENT_TYPESCRIPT_CONCURRENCY` - TypeScript file processing
     - `DEV_AGENT_INDEXER_CONCURRENCY` - vector embedding batches
   - Example: `export DEV_AGENT_CONCURRENCY=10` before running `dev index .`