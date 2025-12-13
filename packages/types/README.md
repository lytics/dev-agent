# @lytics/dev-agent-types

Shared TypeScript type definitions for dev-agent packages.

## Purpose

This package provides common type definitions that are shared across multiple dev-agent packages, preventing circular dependencies and ensuring type consistency.

## Structure

- `github.ts` - GitHub-related types (documents, search, indexing)
- `index.ts` - Main exports

## Usage

```typescript
import type { GitHubDocument, GitHubSearchResult } from '@lytics/dev-agent-types/github';
```

## Why a Separate Package?

This package exists to break circular dependencies between:
- `@lytics/dev-agent-core` (services)
- `@lytics/dev-agent-subagents` (GitHub indexer, agents)
- `@lytics/dev-agent-mcp` (MCP adapters)

By extracting shared types into a separate package that all others depend on, we maintain a clean dependency graph while ensuring type safety.

