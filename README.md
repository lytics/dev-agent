# dev-agent

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15.4-orange.svg)](https://pnpm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Deep code intelligence + specialized AI subagents, exposed via MCP protocol.**

## What is dev-agent?

dev-agent combines two powerful capabilities:

1. **🧠 Deep Code Intelligence** - Multi-language AST analysis, semantic search, type-aware understanding
2. **🤖 Specialized Subagents** - Action-capable AI agents for planning, exploring, and automating code workflows

Unlike generic code search tools or agent platforms, dev-agent specializes in **understanding and acting on codebases**.

### Key Features

**Intelligence Layer:**
- 🌍 **Multi-language analysis** - TypeScript, JavaScript, Go, Python, Rust, Markdown
- 🔍 **Semantic + structural search** - Combine vector embeddings with AST relationships
- 📊 **Type-aware** - Deep integration with TypeScript types, future Go modules
- 📦 **Local-first** - Works 100% offline with local embeddings

**Subagent Layer:**
- 📋 **Planner** - Breaks down GitHub issues into actionable tasks using code context
- 🔎 **Explorer** - Discovers patterns and relationships across your codebase
- 🔧 **PR Manager** - Automates PR creation with AI-generated, context-aware descriptions
- 🎯 **Coordinator** - Orchestrates multi-agent workflows

**Integration:**
- 🔌 **MCP-native** - Works with Cursor, Claude Code, VS Code, or any MCP-compatible tool
- 🐙 **GitHub-integrated** - Native issue, PR, and branch workflows via GitHub CLI

## Project Structure

```
dev-agent/
├── packages/
│   ├── core/                 # Core context provider
│   │   ├── src/
│   │   │   ├── scanner/      # Repository scanning
│   │   │   ├── vector/       # Vector storage
│   │   │   ├── github/       # GitHub integration
│   │   │   ├── context/      # Context provider
│   │   │   └── api/          # HTTP API server
│   │
│   ├── cli/                  # Command-line interface
│   │   ├── src/
│   │   │   ├── commands/     # CLI commands
│   │   │   ├── ui/           # Terminal UI
│   │   │   └── index.ts      # Main CLI entry
│   │
│   ├── subagents/            # Subagent system
│   │   ├── src/
│   │   │   ├── coordinator/  # Subagent coordinator
│   │   │   ├── planner/      # Planner subagent
│   │   │   ├── explorer/     # Explorer subagent
│   │   │   └── pr/           # PR subagent
│   │
│   └── integrations/         # Tool integrations
│       ├── claude/           # Claude Code integration
│       ├── vscode/           # VS Code extension
│
├── examples/                 # Example projects and usage
├── docs/                     # Documentation
└── PLAN.md                   # Implementation plan
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22 LTS or higher)
- [PNPM](https://pnpm.io/) (v8 or higher)

## Technology Stack

**Core:**
- TypeScript (strict mode)
- Node.js >= 22 LTS
- pnpm 8.15.4 (package management)
- Turborepo (monorepo build orchestration)

**Intelligence Layer:**
- tree-sitter (universal multi-language parsing)
- ts-morph (enhanced TypeScript analysis)
- remark (Markdown documentation parsing)
- @xenova/transformers (local embeddings with all-MiniLM-L6-v2)
- LanceDB (embedded vector storage)

**Subagent Layer:**
- Message-based agent coordination (inspired by claude-flow patterns)
- GitHub CLI (native GitHub integration)

**Tooling:**
- Biome (linting & formatting)
- Vitest (testing)
- GitHub Actions (CI/CD)

## Philosophy

**Built for personal productivity first.** Not chasing GitHub stars or trying to be everything to everyone.

### Why CLI-First?
- ⚡ **Fast**: Instant feedback, no waiting for UIs to load
- 🎨 **Beautiful**: Terminal output can be elegant (see examples below)
- 🔧 **Scriptable**: JSON mode for automation and CI/CD
- 🌍 **Universal**: Works anywhere, integrations come later

### Why This Exists?
Tired of:
- ❌ Grepping through codebases to understand patterns
- ❌ Breaking down GitHub issues manually
- ❌ Writing PR descriptions from scratch
- ❌ Tools that don't understand multi-language repos

Want:
- ✅ Semantic search that actually understands code
- ✅ AI agents that can plan and explore codebases
- ✅ Something that works locally (no API keys required)
- ✅ A tool I'll actually use daily

### What Makes It Different?

**vs Code Search Tools:** Adds action-capable subagents (planner, explorer)  
**vs Agent Platforms:** Specializes in deep code understanding  
**vs IDE Extensions:** CLI-first, works anywhere, add integrations later

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design decisions.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22 LTS or higher)
- [PNPM](https://pnpm.io/) (v8.15.4 or higher)
- [GitHub CLI](https://cli.github.com/) (for GitHub integration features)

### Installation

```bash
# Clone the repository
git clone https://github.com/lytics/dev-agent.git
cd dev-agent

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Quick Start

**For Local Development:**

```bash
# Link the CLI globally for local testing
cd packages/cli
npm link

# Now you can use 'dev' anywhere
cd ~/your-project
dev init
dev index .
```

**Basic Commands:**

```bash
# Index your repository
dev index .

# Semantic search (natural language queries work!)
dev search "how do agents communicate"
dev search "vector embeddings"
dev search "error handling" --threshold 0.3

# Explore code patterns
dev explore pattern "test coverage utilities" --limit 5
dev explore similar path/to/file.ts

# View statistics
dev stats
```

**Real Example Output:**

```bash
$ dev search "vector embeddings" --threshold 0.3 --limit 3

1. EmbeddingProvider (58.5% match)
   File: packages/core/src/vector/types.ts:36-54
   Signature: interface EmbeddingProvider
   Doc: Generates vector embeddings from text

2. EmbeddingDocument (51.0% match)
   File: packages/core/src/vector/types.ts:8-12
   Signature: interface EmbeddingDocument

3. VectorStore (47.9% match)
   File: packages/core/src/vector/types.ts:60-97
   Signature: interface VectorStore
   Doc: Stores and retrieves vector embeddings

✔ Found 3 result(s)
```

**Tips for Better Results:**
- **Use natural language**: "how do agents communicate" works better than "agent message"
- **Adjust thresholds**: Default is 0.7 (precise), use 0.25-0.4 for exploration
- **Exact matches score 70-90%**: Semantic matches score 25-60%

### Current Status

**In Progress:** Building core intelligence layer (scanner, vectors, indexer)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical decisions and implementation plan.

### Development

#### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm -F "@monorepo/core" test:watch
```

#### Linting and Formatting

```bash
# Lint all packages
pnpm lint

# Format all packages
pnpm format
```

#### Building

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm -F "@monorepo/core" build
```

## Implementation Plan

See [PLAN.md](./PLAN.md) for the detailed implementation plan.

## Contributing

Contributions are welcome! Please follow the conventional commit format and include tests for any new features.

## Working with this Monorepo

### Adding a New Package

1. Create a new folder in the `packages` directory
2. Add a `package.json` with appropriate dependencies
3. Add a `tsconfig.json` that extends from the root
4. Update root `tsconfig.json` with path mappings for the new package

### Package Interdependencies

Packages can depend on each other using the workspace protocol:

```json
"dependencies": {
  "@monorepo/core": "workspace:*"
}
```

## Versioning

This template follows [Semantic Versioning](https://semver.org/) at the repository level:

- **Git tags**: `v1.0.0`, `v1.1.0`, `v2.0.0` (for template releases)
- **Package versions**: Remain at `0.1.0` by default (customize after cloning)

**Version bumps:**
- **MAJOR**: Breaking changes to template structure or tooling
- **MINOR**: New features, examples, or improvements
- **PATCH**: Bug fixes, documentation updates

See [AGENTS.md](AGENTS.md) for detailed versioning strategy.

## License

[MIT](LICENSE)