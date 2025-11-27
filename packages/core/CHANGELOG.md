# @lytics/dev-agent-core

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

- ce7390b: feat: Richer search results with code snippets, imports, and token budget management

  **Core Scanner:**

  - Extract code snippets during indexing (truncated to 50 lines)
  - Parse and store import statements using ts-morph
  - Extended DocumentMetadata with `snippet` and `imports` fields

  **MCP Formatters:**

  - CompactFormatter and VerboseFormatter now render snippets and imports
  - Progressive disclosure: full → signature → minimal detail levels
  - Token budget management (500-10000 tokens, configurable per-search)
  - Improved token estimation for code-heavy text

  **Search Adapter:**

  - New `tokenBudget` parameter for dev_search tool
  - Enables snippets and imports by default

  The `dev_search` tool now returns actionable context instead of just pointers, making it significantly more useful for AI assistants to understand code without additional file reads.
