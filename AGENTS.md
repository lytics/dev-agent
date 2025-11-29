# AGENTS.md

This file provides guidance to AI agents (Claude, Cursor, etc.) when working with the dev-agent codebase.

## Project Overview

**Dev-Agent** is a local-first repository context provider for AI tools. It provides semantic code search, GitHub integration, and development planning capabilities through the Model Context Protocol (MCP).

**Mission:** Enable AI tools to understand codebases without hallucinations by providing accurate, semantic context.

**Tech Stack:**

- Language: TypeScript (strict mode)
- Package Manager: pnpm 8.15.4
- Build System: Turborepo  
- Linter/Formatter: Biome
- Testing: Vitest (1100+ tests)
- Vector Storage: LanceDB
- Embeddings: @xenova/transformers (all-MiniLM-L6-v2)
- AI Integration: MCP (Model Context Protocol)
- CI/CD: GitHub Actions
- Node.js: >= 22 (LTS)

## Repository Structure

```
packages/
├── core/          # Repository scanning, vector storage, GitHub integration
├── cli/           # Command-line interface (Commander.js)
├── subagents/     # Coordinator, planner, explorer, PR agents
├── mcp-server/    # MCP server with built-in adapters
├── integrations/  # Claude Code, VS Code integrations
└── logger/        # Centralized logging (@lytics/kero)

docs/              # Architecture, workflow documentation
examples/          # Real-world usage examples
scripts/           # Development utilities
```

## Setup Commands

```bash
# Install dependencies (required first step)
pnpm install

# Build all packages (required before typecheck)
pnpm build

# Run all tests (1100+ tests)
pnpm test
pnpm test:watch
pnpm test:coverage

# Linting and formatting
pnpm lint
pnpm format

# Type checking (run AFTER build)
pnpm typecheck

# Development mode (watch)
pnpm dev

# Clean all build outputs
pnpm clean

# Release management
pnpm changeset
pnpm version
pnpm release
```

## Build Order

Critical build dependencies (Turborepo handles automatically):

1. **@lytics/kero** (logger) - No dependencies
2. **@lytics/dev-agent-core** - Depends on logger
3. **@lytics/dev-agent-cli** - Depends on core
4. **@lytics/dev-agent-subagents** - Depends on core
5. **@lytics/dev-agent-mcp** - Depends on core, subagents
6. **@lytics/dev-agent-integrations** - Depends on multiple packages

**Critical:** Always run `pnpm build` before `pnpm typecheck` because TypeScript needs built `.d.ts` files.

## Testing Strategy

Tests use centralized Vitest configuration at root (`vitest.config.ts`):

- **Test Pattern:** `packages/**/*.{test,spec}.ts`
- **Run Command:** `pnpm test` (NOT `turbo test`)
- **Coverage:** v8 provider with comprehensive reporting
- **Test Count:** 1100+ tests (unit + integration)
- **Package Aliases:** Configured in `vitest.config.ts` for cross-package imports

**When Adding Tests:**

1. Place test files next to source files: `src/myModule.test.ts`
2. Import from source: `import { MyClass } from './myModule'`
3. Run `pnpm test` from root to verify
4. For integration tests, use descriptive names: `*.integration.test.ts`

## Code Style

- **TypeScript:** Strict mode enabled, no `any` types (except tests)
- **Linter:** Biome (config in `biome.json`)
- **Formatter:** Biome with auto-fix on save
- **Commits:** Conventional Commits via Commitlint
- **Pre-commit:** Husky hooks run typecheck

**Commit Message Format:**

```
type(scope): description

Examples:
feat(mcp): add health check adapter
fix(core): resolve vector search timeout
docs: update CLAUDE.md with new tools
chore: update dependencies
```

**Allowed Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

## CI/CD Workflows

### CI Workflow (`.github/workflows/ci.yml`)

- **Triggers:** Push to main OR Pull Request to main
- **Node Version:** 22.x (LTS)
- **Steps:** Install → Lint → Build → Typecheck → Test
- **Important:** Build runs BEFORE typecheck (required for `.d.ts` files)

### Release Workflow (`.github/workflows/release.yml`)

- **Triggers:** After CI succeeds on main branch
- **Tool:** Changesets for version management
- **Status:** Currently disabled (packages are private)
- **Future:** Enable when ready for npm publishing

## Core Packages

### @lytics/dev-agent-core

Repository scanning, vector storage, GitHub integration, utilities.

**Key Components:**
- **Scanner:** TypeScript Compiler API for code analysis
- **Indexer:** Semantic indexing with LanceDB
- **Vector Store:** @xenova/transformers embeddings
- **GitHub:** Issue/PR indexing and search
- **Utils:** Retry logic, circular buffers

**Test Coverage:** Extensive unit and integration tests

### @lytics/dev-agent-cli

Command-line interface for repository indexing and MCP setup.

**Commands:**
- `dev index <path>` - Index repository
- `dev mcp install [--cursor]` - Install MCP integration
- `dev mcp uninstall [--cursor]` - Remove MCP integration
- `dev mcp list [--cursor]` - List MCP servers
- `dev gh index` - Index GitHub issues/PRs

### @lytics/dev-agent-subagents

Specialized agents for development tasks.

**Agents:**
- **ExplorerAgent:** Code exploration and pattern analysis
- **PlannerAgent:** Generate implementation plans from GitHub issues
- **PrAgent:** PR management and review assistance

**Coordinator:** Routes tasks to appropriate agents with context management.

### @lytics/dev-agent-mcp

MCP server with built-in adapters for AI tools.

**Adapters (9 tools):**
- **SearchAdapter:** Semantic code search (`dev_search`)
- **RefsAdapter:** Relationship queries - callers/callees (`dev_refs`)
- **MapAdapter:** Codebase structure with change frequency (`dev_map`)
- **HistoryAdapter:** Semantic git commit search (`dev_history`)
- **StatusAdapter:** Repository status (`dev_status`)
- **PlanAdapter:** Context assembly for issues (`dev_plan`)
- **ExploreAdapter:** Code exploration (`dev_explore`)
- **GitHubAdapter:** Issue/PR search (`dev_gh`)
- **HealthAdapter:** Server health checks (`dev_health`)

**Features:**
- Rate limiting (token bucket, 100 req burst)
- Retry logic (exponential backoff with jitter)
- Auto-reload for GitHub index changes
- Graceful shutdown (no zombie processes)

### @lytics/kero

Centralized logging system with multiple transports and formatters.

**Features:**
- Multiple log levels (debug, info, warn, error)
- Console and file transports
- JSON and pretty formatters
- Structured logging with metadata

## MCP Integration

Dev-Agent integrates with AI tools via Model Context Protocol:

**Supported Tools:**
- Claude Code (via `dev mcp install`)
- Cursor IDE (via `dev mcp install --cursor`)

**Dynamic Workspace Detection:**
- Cursor: Uses `WORKSPACE_FOLDER_PATHS` env var
- Single server config works across all projects
- Automatic context switching

**Transport:**
- STDIO for direct AI tool communication
- Robust stdin closure detection
- Graceful process cleanup

## Production Features

### Memory Management

- **Circular Buffers:** Prevent unbounded growth in history/metrics
- **Max History Size:** Configurable (default: 1000 messages)
- **Event Cleanup:** Proper listener removal on shutdown

### Rate Limiting

- **Algorithm:** Token bucket with refill
- **Default:** 100 requests burst, configurable per-tool
- **Error:** Returns HTTP 429 with `retryAfterMs`

### Retry Logic

- **Algorithm:** Exponential backoff with jitter
- **Default Retries:** 3 attempts
- **Retriable Errors:** ETIMEDOUT, ECONNRESET, rate limits
- **Jitter:** Prevents thundering herd problem

### Health Checks

- **Tool:** `dev_health` available to AI assistants
- **Components:** Vector storage, repository, GitHub index
- **Status:** healthy, degraded, unhealthy
- **Granularity:** pass/warn/fail per component

## Common Tasks

### Adding a New Adapter

1. Create adapter in `packages/mcp-server/src/adapters/built-in/`
2. Extend `ToolAdapter` class
3. Implement `getToolDefinition()` and `execute()`
4. Add comprehensive tests in `__tests__/`
5. Register in `bin/dev-agent-mcp.ts`
6. Export from `built-in/index.ts`
7. Update documentation (README, CLAUDE.md)

### Running Package-Specific Commands

```bash
# Build specific package
pnpm -F "@lytics/dev-agent-core" build

# Watch mode for development
pnpm -F "@lytics/dev-agent-core" dev

# Run package tests
cd packages/core && pnpm test:watch
```

### Creating Changesets

```bash
# Document changes
pnpm changeset

# Select packages and version bump type
# Commit the changeset file
git add .changeset/*.md
git commit -m "chore: add changeset for feature X"
```

## Troubleshooting

### TypeScript Errors

**Problem:** Missing types for dependencies

**Solution:**
```bash
pnpm build  # Generate .d.ts files
pnpm typecheck
```

### Build Failures

**Problem:** Dependency order issues

**Solution:**
```bash
pnpm clean
pnpm install
pnpm build
```

### Test Failures

**Problem:** Tests not found or failing

**Solution:**
- Ensure test pattern matches: `**/*.{test,spec}.ts`
- Run from root: `pnpm test`
- Check package aliases in `vitest.config.ts`

### MCP Server Issues

**Problem:** Server not starting or zombie processes

**Solution:**
- Check repository is indexed: `dev index .`
- Verify storage paths: `~/.dev-agent/indexes/`
- Restart AI tool (Cursor/Claude Code)
- Check logs: Use `--verbose` flag

### Rate Limiting

**Problem:** Tool returns 429 errors

**Solution:**
- Wait for `retryAfterMs` period
- Check rate limit status via `dev_health`
- Adjust limits in `AdapterRegistry` config if needed

## Security

- **Local-First:** All data stays on your machine
- **No Cloud:** No data sent to external services
- **Secrets:** Never commit `.env` files or tokens
- **NPM Token:** Stored as GitHub secret (not in code)
- **Private Packages:** All packages default to private

## Contributing

1. Follow conventional commit format
2. Add tests for new features
3. Run `pnpm lint` and `pnpm typecheck` before committing
4. Use `pnpm changeset` to document changes
5. Ensure all 1100+ tests pass
6. Update documentation (README, CLAUDE.md, AGENTS.md)

## Resources

- **Architecture:** See `ARCHITECTURE.md`
- **Workflow:** See `docs/WORKFLOW.md`
- **Examples:** See `examples/` directory
- **Troubleshooting:** See `TROUBLESHOOTING.md` (coming soon)
- **Contributing:** See `CONTRIBUTING.md`

## Version Strategy

- **Repository Level:** Semantic Versioning 2.0.0
- **Current Version:** 0.1.0 (pre-release)
- **Git Tags:** `vMAJOR.MINOR.PATCH`
- **Package Versions:** Follow repository version

**Version Bumps:**
- **MAJOR:** Breaking changes
- **MINOR:** New features (backward compatible)
- **PATCH:** Bug fixes, documentation updates

## Quick Reference

```bash
# Common workflows
pnpm install && pnpm build && pnpm test  # Full setup
pnpm dev                                  # Watch mode
pnpm lint && pnpm typecheck              # Quality checks
dev index .                              # Index repository
dev mcp install --cursor                 # Install for Cursor
dev gh index                             # Index GitHub

# Debugging
dev mcp start --verbose                  # Verbose MCP server
pnpm test:coverage                       # Check test coverage
pnpm clean && pnpm build                 # Clean rebuild

# Release (when ready)
pnpm changeset                           # Document changes
pnpm version                             # Bump versions
pnpm release                             # Publish packages
```

---

**Last Updated:** 2025-11-26  
**Codebase Status:** Production-ready with comprehensive stability features
**Test Coverage:** 1100+ tests passing
**AI Integration:** Claude Code & Cursor via MCP
