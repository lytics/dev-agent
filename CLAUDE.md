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

# Linting and formatting
pnpm lint
pnpm format

# Type checking (run AFTER build)
pnpm typecheck

# Development mode
pnpm dev

# Clean all build outputs
pnpm clean
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

### Key Technologies
- TypeScript Compiler API for repository analysis
- Chroma DB for vector storage
- TensorFlow.js for embeddings
- Express.js for context API server
- GitHub CLI for metadata integration
- Turborepo for build orchestration
- Biome for linting/formatting

### Core Components
- **Scanner**: Uses TypeScript Compiler API to extract components and relationships
- **Vector Storage**: Semantic search with Chroma DB and TensorFlow.js embeddings
- **Context API**: HTTP server providing repository context to AI tools
- **GitHub Integration**: Metadata extraction using GitHub CLI
- **Subagent System**: Specialized agents for planning, exploration, and PR management

## Build Dependencies

Critical build order due to package interdependencies:
1. `@lytics/dev-agent-core` (no dependencies)
2. `@lytics/dev-agent-cli` (depends on core)
3. `@lytics/dev-agent-subagents` (depends on core)  
4. `@lytics/dev-agent-integrations` (depends on multiple packages)

Always run `pnpm build` before `pnpm typecheck` since TypeScript needs built `.d.ts` files.

## Testing

- Tests use centralized Vitest configuration at root
- Test pattern: `packages/**/*.{test,spec}.ts`
- Run from root only: `pnpm test` (NOT `turbo test`)
- Package aliases configured in vitest.config.ts for cross-package imports

## Package Management

- Use workspace protocol for internal dependencies: `"@lytics/dev-agent-core": "workspace:*"`
- All packages currently private (`"private": true`)
- Package scoped as `@lytics/dev-agent-*`