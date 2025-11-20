# Dev-Agent

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15.4-orange.svg)](https://pnpm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A local-first repository context provider for AI tools like Claude Code, that helps AI tools better understand codebases without hallucinations.

## Overview

Dev-Agent is designed to provide rich context about code repositories to AI tools, improving their ability to understand and work with code. Key features include:

- Repository analysis using TypeScript Compiler API
- Vector storage and search with Chroma DB
- GitHub integration for metadata
- Context API for AI tool integration
- Subagent system for specialized tasks

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

- TypeScript
- TypeScript Compiler API (AST parsing)
- Chroma DB (vector storage)
- TensorFlow.js (embedding generation)
- Express.js (API server)
- Commander.js (CLI)
- GitHub CLI (GitHub integration)
- Turborepo (monorepo management)
- pnpm (package management)

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

### Usage

The project follows a phased implementation as detailed in PLAN.md:

1. Phase 1: Core Context Provider (2 Weeks)
2. Phase 2: Subagent Foundation (2-3 Weeks)
3. Phase 3: Advanced Capabilities (Ongoing)

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