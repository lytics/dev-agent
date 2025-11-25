# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- TypeScript Compiler API for repository analysis
- Chroma DB for vector storage
- TensorFlow.js for embeddings
- Express.js for context API server
- GitHub CLI for metadata integration
- Turborepo for build orchestration
- Biome for linting/formatting
- Vitest for testing
- MCP (Model Context Protocol) for AI tool integration

### Core Components
- **Scanner**: Uses TypeScript Compiler API to extract components and relationships
- **Vector Storage**: Semantic search with Chroma DB and TensorFlow.js embeddings
- **Context API**: HTTP server providing repository context to AI tools
- **GitHub Integration**: Metadata extraction using GitHub CLI
- **Subagent System**: Specialized agents for planning, exploration, and PR management
- **MCP Server**: Model Context Protocol server for AI tool integration
- **Logger**: Centralized logging with multiple transports and formatters

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
- Built-in adapters for search, exploration, planning, GitHub integration
- Configurable formatters (compact/verbose)
- STDIO transport for AI tool communication
- Comprehensive test coverage with integration tests

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

### Available Tools in Claude Code

Once installed, Claude Code gains access to these powerful tools:

- **`dev_search`** - Semantic code search across indexed repositories
- **`dev_status`** - Repository indexing status and health information  
- **`dev_plan`** - Generate implementation plans from GitHub issues
- **`dev_explore`** - Explore code patterns, find similar code, analyze relationships
- **`dev_gh`** - Search GitHub issues and pull requests with semantic context

### MCP Command Reference

```bash
# Start MCP server (usually automated)
dev mcp start [--verbose] [--transport stdio|http]

# Install dev-agent in Claude Code
dev mcp install [--repository /path/to/repo]

# Remove dev-agent from Claude Code  
dev mcp uninstall

# List all configured MCP servers
dev mcp list
```

### Manual Configuration

For advanced users or development, you can manually configure the MCP server:

1. **Server Configuration**: The MCP server runs with full feature set including:
   - Subagent coordinator with explorer, planner, and PR agents
   - All 5 adapters (search, status, plan, explore, github)
   - STDIO transport for direct Claude Code communication

2. **Storage**: Uses centralized storage at `~/.dev-agent/indexes/` for cross-project sharing

3. **Requirements**: Repository must be indexed first with `dev index .`