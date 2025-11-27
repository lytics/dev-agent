# @lytics/dev-agent

## 0.3.0

### Minor Changes

- afa8adb: feat: Context Quality release (v0.3.0)

  This release significantly enhances dev-agent's ability to provide rich, actionable context to AI assistants.

  ## New Tools

  ### `dev_refs` - Relationship Queries

  Query code relationships to understand what calls what:

  - Find all callers of a function
  - Find all callees (what a function calls)
  - Includes file paths, line numbers, and snippets

  ### `dev_map` - Codebase Overview

  Get a high-level view of repository structure:

  - Directory tree with component counts
  - **Hot Paths**: Most referenced files in the codebase
  - **Smart Depth**: Adaptive expansion based on information density
  - **Signatures**: Function/class signatures in export listings
  - Configurable depth and focus directory

  ## Enhanced Tools

  ### `dev_plan` - Context Assembler (Breaking Change)

  Completely refactored from heuristic task breakdown to context assembly:

  - Returns rich context package instead of task lists
  - Includes issue details with comments
  - Includes relevant code snippets from semantic search
  - Includes detected codebase patterns
  - Let LLMs do the reasoning with better data

  **Migration:** The old task breakdown output is removed. The new output provides strictly more information for LLMs to create their own plans.

  ### `dev_search` - Richer Results (from v0.2.0)

  - Code snippets included in results
  - Import statements for context
  - Caller/callee hints
  - Progressive disclosure based on token budget

  ## Philosophy

  This release embraces the principle: **Provide structured data, let LLMs reason.**

  Instead of trying to be smart with heuristics, dev-agent now focuses on assembling comprehensive context that AI assistants can use effectively.

## 0.2.0

### Minor Changes

- bc44ec7: chore: bump main package to match core and mcp versions

  Syncs the main `@lytics/dev-agent` package version with the underlying `@lytics/dev-agent-core` and `@lytics/dev-agent-mcp` packages which were bumped to 0.2.0 for the "Richer Search Results" feature.
