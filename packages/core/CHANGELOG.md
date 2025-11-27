# @lytics/dev-agent-core

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
