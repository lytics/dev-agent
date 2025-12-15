# @lytics/dev-agent-mcp

## 0.5.4

### Patch Changes

- d3d2126: feat(mcp): refactor dev_inspect and optimize pattern analysis

  **API Simplification:**

  - `dev_inspect` simplified to single-purpose tool (action parameter streamlined)
  - Previously: `dev_inspect({ action: "compare", query: "file.ts" })`
  - Now: `dev_inspect({ query: "file.ts" })`
  - Existing usage continues to work with dynamic MCP schema discovery

  **Major Features:**

  - Created `PatternAnalysisService` with 5 pattern extractors:
    - Import style (ESM, CJS, mixed, unknown)
    - Error handling (throw, result, callback, unknown)
    - Type coverage (full, partial, none)
    - Testing (co-located test files)
    - File size (lines vs similar files)
  - Batch scanning optimization (5-10x faster: 500-1000ms vs 2-3 seconds)
  - Embedding-based similarity search (no more false matches)
  - Extension filtering (`.ts` only compares with `.ts`)
  - Comprehensive pattern analysis (finds similar files + analyzes patterns)

  **Performance:**

  - One ts-morph initialization vs 6 separate scans
  - Batch scan all files in one pass
  - `searchByDocumentId()` for embedding-based similarity
  - Pattern analysis: 500-1000ms (down from 2-3 seconds)

  **Bug Fixes:**

  - Fixed `findSimilar` to use document embeddings instead of file paths
  - Fixed `--force` flag to properly clear old vector data
  - Fixed race condition in LanceDB table creation
  - Removed `outputSchema` from all 9 MCP adapters (Cursor/Claude compatibility)

  **New Features:**

  - Test utilities in `@lytics/dev-agent-core/utils`:
    - `isTestFile()` — Check if file is a test file
    - `findTestFile()` — Find co-located test files
  - Vector store `clear()` method
  - Vector store `searchByDocumentId()` method
  - Comprehensive pattern comparison with statistical analysis

  **Migration Guide:**

  ```typescript
  // Before (v0.8.4)
  dev_inspect({ action: "compare", query: "src/auth.ts" });
  dev_inspect({ action: "validate", query: "src/auth.ts" });

  // After (v0.8.5) - Streamlined!
  dev_inspect({ query: "src/auth.ts" });
  ```

  The tool now automatically finds similar files AND performs pattern analysis. No migration needed - MCP tools discover the new schema dynamically.

  **Re-index Recommended:**

  ```bash
  dev index . --force
  ```

  This clears old data and rebuilds with improved embedding-based search.

  **Documentation:**

  - Complete rewrite of dev-inspect.mdx
  - Updated README.md with pattern categories
  - Updated CLAUDE.md with new descriptions
  - Added v0.8.5 changelog entry to website
  - Migration guide from dev_explore

  **Tests:**

  - All 1100+ tests passing
  - Added 10 new test-utils tests
  - Pattern analysis service fully tested
  - Integration tests for InspectAdapter

- Updated dependencies [d3d2126]
  - @lytics/dev-agent-core@0.9.3
  - @lytics/dev-agent-subagents@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies [8b4972a]
  - @lytics/dev-agent-core@0.9.2
  - @lytics/dev-agent-subagents@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [f20406e]
  - @lytics/dev-agent-core@0.9.1
  - @lytics/dev-agent-subagents@0.5.2
  - @lytics/dev-agent-types@0.2.1

## 0.5.1

### Patch Changes

- Updated dependencies [d23d1a9]
  - @lytics/dev-agent-core@0.9.0
  - @lytics/dev-agent-subagents@0.5.1

## 0.5.0

### Minor Changes

- 0f8c4eb: ## 🎉 v0.8.0 - Major Feature Release

  This release includes 33 commits with significant new features, performance improvements, and architectural enhancements.

  ### 🚀 Major Features

  - **`dev map` command** - Visualize codebase structure with component counts, exports, and hot paths (224x performance improvement!)
  - **`dev activity` command** - Show most active files with commit counts, recency, and complexity
  - **`dev owners` command** - Developer specialization breakdown with file-level ownership
  - **Author contribution indexing** - Indexed during `dev index` for 35x faster ownership queries
  - **Service layer architecture** - 7 services with dependency injection for better testability
  - **MetricsStore with SQLite** - Persistent code analytics with `file_authors` table
  - **Code metadata system** - Factual metrics replacing risk scoring
  - **Change frequency analysis** - Git activity tracking and hotspot identification
  - **Stats comparison & export** - Historical metrics analysis

  ### 🎨 CLI/UX Improvements

  - **Compact table format** for metrics commands with factual summaries
  - **Top-level commands** - `dev activity` and `dev owners` (refactored from `dev metrics`)
  - Enhanced `dev stats` output with 10x performance boost
  - Enhanced `dev git stats` with clean, scannable format
  - Enhanced `dev compact`, `dev clean`, and MCP command outputs
  - Modernized CLI with compact, user-friendly formatting
  - Comprehensive help text with examples and use cases
  - Visual indicators (🔥 for hotspots, ✏️ for activity)
  - GitHub handle resolution for developer identification

  ### 🏗️ Architecture & Quality

  - Service-oriented architecture with dependency injection
  - Circular dependency resolution via shared types package
  - Complete Zod validation across all 9 MCP adapters and external boundaries
  - Kero logger integration throughout
  - SearchService refactor for better code reuse
  - Improved error handling and messaging

  ### ⚡ Performance Optimizations

  - **`dev map`**: 224x speedup (103s → 0.46s)
    - Added `getAll()` method for fast scans without semantic search
    - Added `skipEmbedder` option for read-only operations
    - Added `getBasicStats()` to avoid expensive git enrichment
  - **`dev owners`**: 35x speedup (17.5s → 0.5s)
    - Batched git operations during indexing (1 call vs N file calls)
    - Author contributions stored in `file_authors` table
    - Offline capability - no git access needed after indexing
  - **`dev stats`**: 10x speedup via direct JSON reads

  ### 🐛 Bug Fixes

  - Fixed component count overflow in map generation (2.4B → 3.7K)
  - Fixed detailed stats persistence in indexer
  - Fixed ENOBUFS issues

  ### 📚 Documentation

  - Updated website for v0.7.0 features
  - TypeScript standards with Zod validation examples
  - Workflow documentation with commit checkpoints
  - Enhanced CLI help text across all commands

  ### 🧪 Testing

  - All 1,918 tests passing
  - Added comprehensive test coverage for new features
  - Mock updates for new `getAll()` method

  This release represents a significant step forward in usability, performance, and code quality. Special thanks to all contributors!

### Patch Changes

- Updated dependencies [0f8c4eb]
  - @lytics/dev-agent-core@0.8.0
  - @lytics/dev-agent-subagents@0.5.0
  - @lytics/dev-agent-types@0.2.0

## 0.4.9

### Patch Changes

- Updated dependencies [c13b24f]
  - @lytics/dev-agent-core@0.7.0
  - @lytics/dev-agent-subagents@0.4.2

## 0.4.8

### Patch Changes

- Updated dependencies [b675fc9]
  - @lytics/dev-agent-core@0.6.1
  - @lytics/dev-agent-subagents@0.4.1

## 0.4.7

### Patch Changes

- Updated dependencies [f578042]
  - @lytics/dev-agent-core@0.6.0
  - @lytics/dev-agent-subagents@0.4.0

## 0.4.6

### Patch Changes

- Updated dependencies [d6e5e6f]
  - @lytics/dev-agent-subagents@0.3.3

## 0.4.5

### Patch Changes

- Updated dependencies [579925c]
  - @lytics/dev-agent-core@0.5.1
  - @lytics/dev-agent-subagents@0.3.2

## 0.4.4

### Patch Changes

- Updated dependencies [d0481b4]
  - @lytics/dev-agent-core@0.5.0
  - @lytics/dev-agent-subagents@0.3.1

## 0.4.3

### Patch Changes

- ad4af12: ### Features

  - **Test file hints in search results**: `dev_search` now shows related test files (e.g., `utils.test.ts`) after search results. This surfaces test files without polluting semantic search rankings.

  ### Design

  - Uses structural matching (`.test.ts`, `.spec.ts` patterns) rather than semantic search
  - Keeps semantic search pure - test hints are in a separate "Related test files:" section
  - Patterns are configurable for future extensibility via function parameters

## 0.4.2

### Patch Changes

- 40192f5: Fix dev_history tool schema for Claude API compatibility

  - Removed `anyOf` from input schema (Claude API doesn't support it at top level)
  - Validation for "at least one of query or file required" is still enforced in execute()

## 0.4.1

### Patch Changes

- 4b55a04: Fix MCP server to include all 9 adapters and improve tool descriptions for better AI tool adoption

  **Bug Fix:**

  - CLI's `mcp start` command now registers all 9 adapters (was missing HealthAdapter, RefsAdapter, MapAdapter, HistoryAdapter)
  - Updated tool list in CLI output and install messages to show all 9 tools

  **Tool Description Improvements:**

  - `dev_search`: Added "USE THIS FIRST" trigger, comparison to grep for conceptual queries
  - `dev_map`: Clarified it shows component counts and exports, better than list_dir
  - `dev_explore`: Clarified workflow - use after dev_search for "similar" and "relationships" actions
  - `dev_refs`: Added guidance to use for specific symbols, use dev_search for conceptual queries
  - `dev_history`: Added "WHY" trigger, clarified semantic search over commits
  - `dev_plan`: Emphasized "ALL context in one call" value prop for GitHub issues
  - `dev_gh`: Clarified semantic search by meaning, not just keywords

  These description improvements help AI tools (Claude, Cursor) choose the right dev-agent tool for each task.

## 0.4.0

### Minor Changes

- c42f5ba: feat: Intelligent Git History (v0.4.0)

  New capabilities for understanding codebase history:

  **`dev_history` tool** - Semantic search over git commits

  - Search commit messages by meaning (e.g., "authentication token fix")
  - Get file history with rename tracking
  - Token-budgeted output

  **`dev_map` enhancements** - Change frequency indicators

  - 🔥 Hot directories (5+ commits in 30 days)
  - ✏️ Active directories (1-4 commits in 30 days)
  - 📝 Recent activity (commits in 90 days)

  **`dev_plan` enhancements** - Git context in planning

  - Related commits shown alongside code snippets
  - Issue/PR references extracted from commits
  - Helps understand prior work on similar features

  **Core infrastructure:**

  - `GitIndexer` for semantic commit search
  - `LocalGitExtractor` for git operations
  - Extensible architecture for future git features

### Patch Changes

- Updated dependencies [c42f5ba]
  - @lytics/dev-agent-core@0.4.0
  - @lytics/dev-agent-subagents@0.3.0

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

### Patch Changes

- Updated dependencies [afa8adb]
  - @lytics/dev-agent-core@0.3.0
  - @lytics/dev-agent-subagents@0.2.0

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

### Patch Changes

- Updated dependencies [ce7390b]
  - @lytics/dev-agent-core@0.2.0
  - @lytics/dev-agent-subagents@0.1.1
