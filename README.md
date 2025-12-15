# dev-agent

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15.4-orange.svg)](https://pnpm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Local semantic code search for Cursor and Claude Code via MCP.**

## What it does

dev-agent indexes your codebase and provides 9 MCP tools to AI assistants. Instead of AI tools grepping through files, they can ask conceptual questions like "where do we handle authentication?"

- `dev_search` — Semantic code search by meaning
- `dev_refs` — Find callers/callees of functions  
- `dev_map` — Codebase structure with change frequency
- `dev_history` — Semantic search over git commits
- `dev_plan` — Assemble context for GitHub issues
- `dev_inspect` — Inspect files (compare similar code, check patterns)
- `dev_gh` — Search GitHub issues/PRs semantically
- `dev_status` / `dev_health` — Monitoring

## Measured results

We benchmarked dev-agent against baseline Claude Code across 5 task types:

| Metric | Baseline | With dev-agent | Change |
|--------|----------|----------------|--------|
| Cost | $1.82 | $1.02 | **-44%** |
| Time | 14.1 min | 11.5 min | **-19%** |
| Tool calls | 69 | 40 | **-42%** |

**Trade-offs:** Faster but sometimes less thorough. Best for implementation tasks and codebase exploration. For deep debugging, baseline Claude may read more files.

## When to use it

**Good fit:**
- Large or unfamiliar codebases
- Implementation tasks ("add a feature like X")
- Exploring how code works
- Reducing AI API costs

**Less useful:**
- Small codebases you already know well
- Deep debugging sessions
- When thoroughness matters more than speed

## Quick Start

```bash
# Install globally
npm install -g dev-agent

# Index your repository (initial indexing can take 5-10 minutes for large codebases)
cd /path/to/your/repo
dev index .

# Install MCP integration
dev mcp install --cursor  # For Cursor IDE
dev mcp install           # For Claude Code

# Keep index up to date (fast incremental updates)
dev update

# That's it! AI tools now have access to dev-agent capabilities.
```

## MCP Tools

When integrated with Cursor or Claude Code, dev-agent provides 9 powerful tools:

### `dev_search` - Semantic Code Search
Natural language search with rich results including code snippets, imports, and relationships.

```
Find authentication middleware that handles JWT tokens
```

**Features:**
- Code snippets included (not just file paths)
- Import statements for context
- Caller/callee hints
- Progressive disclosure based on token budget

### `dev_refs` - Relationship Queries ✨ New in v0.3
Query what calls what and what is called by what.

```
Find all callers of the authenticate function
Find what functions validateToken calls
```

**Features:**
- Bidirectional queries (callers/callees)
- File paths and line numbers
- Relevance scoring

### `dev_map` - Codebase Overview ✨ Enhanced in v0.4
Get a high-level view of repository structure with change frequency.

```
Show me the codebase structure with depth 3
Focus on the packages/core directory
Show hot areas with recent changes
```

**Features:**
- Directory tree with component counts
- **Hot Paths:** Most referenced files
- **Change Frequency:** 🔥 Hot (5+ commits/30d), ✏️ Active (1-4/30d), 📝 Recent (90d)
- **Smart Depth:** Adaptive expansion based on density
- **Signatures:** Function/class signatures in exports

**Example output:**
```markdown
# Codebase Map

## Hot Paths (most referenced)
1. `packages/core/src/indexer/index.ts` (RepositoryIndexer) - 47 refs
2. `packages/core/src/vector/store.ts` (LanceDBVectorStore) - 32 refs

## Directory Structure

└── packages/ (195 components)
    ├── 🔥 core/ (45 components) — 12 commits in 30d
    │   └── exports: function search(query): Promise<Result[]>, class RepositoryIndexer
    ├── ✏️ mcp-server/ (28 components) — 3 commits in 30d
    │   └── exports: class MCPServer, function createAdapter(config): Adapter
```

### `dev_history` - Git History Search ✨ New in v0.4
Semantic search over git commit history.

```
Find commits about authentication token fixes
Show history for src/auth/middleware.ts
```

**Features:**
- **Semantic search:** Find commits by meaning, not just text
- **File history:** Track changes with rename detection
- **Issue/PR refs:** Extracted from commit messages
- **Token-budgeted output**

### `dev_plan` - Context Assembly ✨ Enhanced in v0.4
Assemble rich context for implementing GitHub issues.

```
Assemble context for issue #42
```

**Returns:**
- Full issue with comments
- Relevant code snippets from semantic search
- **Related commits** from git history (new in v0.4)
- Detected codebase patterns (test naming, locations)
- Metadata (tokens, timing)

**Note:** This tool no longer generates task breakdowns. It provides comprehensive context so the AI assistant can create better plans.

### `dev_inspect` - File Analysis
Inspect files for pattern analysis. Finds similar code and compares patterns (error handling, type coverage, imports, testing).

```
Inspect src/auth/middleware.ts for patterns
Check how src/hooks/useAuth.ts compares to similar hooks
```

**Pattern Categories:**
- Import style (ESM vs CJS)
- Error handling (throw vs result types)
- Type coverage (full, partial, none)
- Test coverage (co-located test files)
- File size relative to similar code

### `dev_status` - Repository Status
View indexing status, component health, and repository information.

### `dev_gh` - GitHub Search
Search issues and PRs with semantic understanding.

```
Find authentication-related bugs
Search for performance issues in closed PRs
```

### `dev_health` - Health Monitoring
Check MCP server and component health.

## Key Features

### Local-First
- 📦 Works 100% offline
- 🔐 Your code never leaves your machine
- ⚡ Fast local embeddings with all-MiniLM-L6-v2

### Production Ready
- 🛡️ Rate limiting (100 req/min burst)
- 🔄 Retry logic with exponential backoff
- ⚡ Incremental indexing (only processes changed files)
- 💚 Health monitoring
- 🧹 Memory-safe (circular buffers)
- ✅ 1300+ tests

### Token Efficient
- 🪙 Progressive disclosure based on budget
- 📊 Token estimation in results
- 🎯 Smart depth for codebase maps

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v22 LTS or higher
- [pnpm](https://pnpm.io/) v8.15.4 or higher
- [GitHub CLI](https://cli.github.com/) (for GitHub features)

### Global Install (Recommended)

```bash
npm install -g dev-agent
```

### From Source

```bash
git clone https://github.com/lytics/dev-agent.git
cd dev-agent
pnpm install
pnpm build
cd packages/dev-agent
npm link
```

## CLI Commands

```bash
# Index everything (code, git history, GitHub) - can take 5-10 min for large codebases
dev index .
dev index . --no-github               # Skip GitHub indexing

# Incremental updates (only changed files) - much faster, typically seconds
dev update                            # Fast incremental reindexing
dev update -v                         # Verbose output showing what changed

# Semantic search
dev search "how do agents communicate"
dev search "error handling" --threshold 0.3

# Git history search
dev git search "authentication fix"   # Semantic search over commits
dev git stats                         # Show indexed commit count

# GitHub integration
dev github index                          # Index issues and PRs (also done by dev index)
dev github search "authentication bug"    # Semantic search

# View statistics
dev stats

# MCP management
dev mcp install --cursor              # Install for Cursor
dev mcp install                       # Install for Claude Code
dev mcp list                          # List configured servers
```

## Configuration

### Performance Tuning

Control scanning and indexing performance using environment variables:

```bash
# Global concurrency setting (applies to all operations)
export DEV_AGENT_CONCURRENCY=10

# Language-specific concurrency settings
export DEV_AGENT_TYPESCRIPT_CONCURRENCY=20  # TypeScript file processing
export DEV_AGENT_INDEXER_CONCURRENCY=5      # Vector embedding batches

# Index with custom settings
dev index .
```

**Auto-detection:** If no environment variables are set, dev-agent automatically detects optimal concurrency based on your system's CPU and memory.

**Recommended settings:**

| System Type | Global | TypeScript | Indexer | Notes |
|-------------|--------|------------|---------|-------|
| Low memory (<4GB) | 5 | 5 | 2 | Prevents OOM errors |
| Standard (4-8GB) | 15 | 15 | 3 | Balanced performance |
| High-end (8GB+, 8+ cores) | 30 | 30 | 5 | Maximum speed |

### Language Support

Current language support:

- **TypeScript/JavaScript**: Full support (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`)
- **Go**: Full support (`.go`)

To add new languages, see [LANGUAGE_SUPPORT.md](LANGUAGE_SUPPORT.md).

### Troubleshooting

**Indexing too slow:**
```bash
# Note: Initial indexing can take 5-10 minutes for mature codebases (4k+ files)
# Try increasing concurrency (if you have enough memory)
export DEV_AGENT_CONCURRENCY=20
dev index .
```

**Out of memory errors:**
```bash
# Reduce concurrency
export DEV_AGENT_CONCURRENCY=5
export DEV_AGENT_TYPESCRIPT_CONCURRENCY=5
export DEV_AGENT_INDEXER_CONCURRENCY=2
dev index .
```

**Search results are outdated:**
```bash
# Update index with recent file changes
dev update
# Or do a full reindex if needed
dev index .
```

**Go scanner not working:**
```bash
# Check if WASM files are bundled (after installation/build)
ls -la ~/.local/share/dev-agent/dist/wasm/tree-sitter-go.wasm
# If missing, try reinstalling or rebuilding from source
```

## Project Structure

```
dev-agent/
├── packages/
│   ├── core/           # Scanner, vector storage, indexer
│   ├── cli/            # Command-line interface
│   ├── subagents/      # Planner, explorer, PR agents
│   ├── mcp-server/     # MCP protocol server + adapters
│   └── integrations/   # Claude Code, VS Code
├── docs/               # Documentation
└── website/            # Documentation website
```

## Supported Languages

| Language | Scanner | Features |
|----------|---------|----------|
| **TypeScript/JavaScript** | ts-morph | Functions, classes, interfaces, JSDoc |
| **Go** | tree-sitter | Functions, methods, structs, interfaces, generics |
| **Markdown** | remark | Documentation sections, code blocks |

## Technology Stack

- **TypeScript** (strict mode)
- **ts-morph** / TypeScript Compiler API (TypeScript/JS analysis)
- **tree-sitter** WASM (Go analysis, extensible to Python/Rust)
- **LanceDB** (embedded vector storage)
- **@xenova/transformers** (local embeddings)
- **MCP** (Model Context Protocol)
- **Turborepo** (monorepo builds)
- **Vitest** (1500+ tests)

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm format

# Type check
pnpm typecheck
```

## Version History

- **v0.6.0** - Go Language Support & Performance Improvements
  - Go scanner with tree-sitter WASM (functions, methods, structs, interfaces, generics)
  - Configurable concurrency via environment variables (`DEV_AGENT_*_CONCURRENCY`)
  - Auto-detection of optimal performance settings based on system resources
  - Enhanced error handling and user feedback across all scanners
  - Improved Go scanner with runtime WASM validation and better error messages
  - Parallel processing optimizations for TypeScript scanning and indexing
  - Indexer logging with `--verbose` flag and progress spinners
  - Go-specific exclusions (*.pb.go, *.gen.go, mocks/, testdata/)
  - Comprehensive language support documentation (`LANGUAGE_SUPPORT.md`)
  - Build-time validation to prevent silent WASM dependency failures
  - Infrastructure for future Python/Rust support
- **v0.4.0** - Intelligent Git History release
  - New `dev_history` tool for semantic commit search
  - Enhanced `dev_map` with change frequency indicators (🔥 hot, ✏️ active)
  - Enhanced `dev_plan` with related commits from git history
  - New `GitIndexer` and `LocalGitExtractor` in core
- **v0.3.0** - Context Quality release
  - New `dev_refs` tool for relationship queries
  - Enhanced `dev_map` with hot paths, smart depth, signatures
  - Refactored `dev_plan` to context assembly
- **v0.2.0** - Richer search results with snippets and imports
- **v0.1.0** - Initial release

## Contributing

Contributions welcome! Please follow conventional commit format and include tests.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
