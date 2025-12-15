# @lytics/dev-agent-subagents

## 0.5.4

### Patch Changes

- Updated dependencies [d3d2126]
  - @lytics/dev-agent-core@0.9.3

## 0.5.3

### Patch Changes

- Updated dependencies [8b4972a]
  - @lytics/dev-agent-core@0.9.2

## 0.5.2

### Patch Changes

- f20406e: # Visual Formatting & GitHub Stats Improvements

  ## Visual Enhancements ✨

  ### Tree Branches & File Icons

  All CLI outputs now use consistent tree-based formatting with file icons:

  **`dev map` hot paths:**

  ```
  ## Hot Paths (most referenced)
    ├─ 📘 **typescript.ts** • 307 refs
       /packages/core/src/scanner
    ├─ 📘 **index.ts** • 251 refs
       /packages/core/src/indexer
    └─ 📘 **go.ts** • 152 refs
       /packages/core/src/scanner
  ```

  **`dev activity` output:**

  ```
  ├─ 📘 packages/mcp-server/bin/dev-agent-mcp.ts
  │     34 commits • 1 👤 • Last: today
  │
  ├─ 📘 packages/core/src/indexer/index.ts
  │     32 commits • 1 👤 • Last: today
  ```

  ### Shared Icon Utility

  Extracted `getFileIcon()` to `@lytics/dev-agent-core/utils` for reuse across packages.

  ## GitHub Stats Fix 🐛

  Fixed confusing issue/PR state display:

  **Before:**

  ```
  Issues: 68 total (14 open, 55 closed)
  Pull Requests: 97 total (14 open, 96 merged)  ❌ Wrong!
  ```

  **After:**

  ```
  Issues: 68 total (14 open, 54 closed)
  Pull Requests: 97 total (0 open, 96 merged)   ✅ Correct!
  ```

  - Added separate state tracking: `issuesByState`, `prsByState`
  - GitHub indexer now tracks issue and PR states independently
  - Stats display now shows accurate per-type counts

  ## Progress Display Improvements 📊

  ### Detailed Progress with Rates

  All indexing commands now show detailed progress:

  ```
  Scanning Repository: 1,234/4,567 files (27%, 45 files/sec)
  Embedding Vectors: 856/2,549 documents (34%, 122 docs/sec)
  ```

  Applied to:

  - `dev index` - scanning & embedding progress
  - `dev update` - changed files & embedding progress
  - `dev git index` - commit embedding progress
  - `dev github index` - document embedding progress

  ### Update Plan Display

  `dev update` now shows what will change before starting:

  ```
  Update plan:
    • Changed: 3 files
    • Added: 1 file
    • Deleted: 0 files
  ```

  ### Code Quality

  - Refactored progress logic into `ProgressRenderer.updateSectionWithRate()`
  - Reduced ~40 lines of duplicated code
  - Fixed NaN display (now shows "Discovering files..." initially)

  ## Bug Fixes 🐛

  - **`dev owners`**: Fixed "No ownership data" error when run from subdirectories
  - **Progress Display**: Fixed NaN showing during initial file discovery phase
  - **`dev update`**: Removed duplicate checkmark in success message

  ## Breaking Changes

  None - all changes are backward compatible. Old GitHub state files will fall back to aggregate counts gracefully.

- Updated dependencies [f20406e]
  - @lytics/dev-agent-core@0.9.1
  - @lytics/dev-agent-types@0.2.1

## 0.5.1

### Patch Changes

- Updated dependencies [d23d1a9]
  - @lytics/dev-agent-core@0.9.0

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
  - @lytics/dev-agent-types@0.2.0

## 0.4.2

### Patch Changes

- Updated dependencies [c13b24f]
  - @lytics/dev-agent-core@0.7.0

## 0.4.1

### Patch Changes

- Updated dependencies [b675fc9]
  - @lytics/dev-agent-core@0.6.1

## 0.4.0

### Minor Changes

- f578042: feat: Go language support

  Add comprehensive Go language support to dev-agent:

  **Go Scanner**

  - Tree-sitter WASM infrastructure (reusable for Python/Rust later)
  - Extract functions, methods, structs, interfaces, types, constants
  - Method receivers with pointer detection
  - Go 1.18+ generics support
  - Go doc comment extraction
  - Exported symbol detection (capital letter convention)
  - Generated file skipping (_.pb.go, _.gen.go, etc.)
  - 90%+ test coverage

  **Indexer Logging**

  - Add `--verbose` flag to `dev index`, `dev git index`, `dev github index`
  - Progress spinner shows actual counts: `Embedding 4480/49151 documents (9%)`
  - Structured logging with kero logger

  **Go-Specific Exclusions**

  - Protobuf: `*.pb.go`, `*.pb.gw.go`
  - Generated: `*.gen.go`, `*_gen.go`
  - Mocks: `mock_*.go`, `mocks/`
  - Test fixtures: `testdata/`

  Tested on large Go codebase (~4k files, 49k documents).

### Patch Changes

- Updated dependencies [f578042]
  - @lytics/dev-agent-core@0.6.0

## 0.3.3

### Patch Changes

- d6e5e6f: Fix ENOBUFS error during GitHub issues/PRs indexing for large repositories

  **Problem:** When indexing repositories with many GitHub issues/PRs (especially with large issue bodies), the `dev index` command would fail with `ENOBUFS` (No buffer space available) error.

  **Solution:**

  - Increased execSync maxBuffer from default 1MB to 50MB for issue/PR fetching
  - Reduced default fetch limit from 1000 to 500 items to prevent buffer overflow
  - Added `--gh-limit` CLI flag to allow users to customize the limit
  - Improved error messages to guide users when buffer issues occur

  **Changes:**

  - `fetchIssues()` and `fetchPullRequests()` now use 50MB maxBuffer
  - Default limit changed from 1000 to 500 (per type: issues and PRs)
  - Added `--gh-limit <number>` flag to `dev index` command
  - Better error handling with helpful suggestions (use `--gh-limit 100` for very large repos)
  - Comprehensive test coverage (23 new tests for fetcher utilities)

  **Usage:**

  ```bash
  # Default (works for most repos)
  dev index

  # For large repos (200+ issues/PRs)
  dev index --gh-limit 200

  # For very active repos (500+ issues/PRs)
  dev index --gh-limit 100
  ```

  **Testing:** All 1100+ tests passing. Verified on lytics-ui repository (6989 files, 1000 issues/PRs indexed successfully).

## 0.3.2

### Patch Changes

- Updated dependencies [579925c]
  - @lytics/dev-agent-core@0.5.1

## 0.3.1

### Patch Changes

- Updated dependencies [d0481b4]
  - @lytics/dev-agent-core@0.5.0

## 0.3.0

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

## 0.2.0

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

## 0.1.1

### Patch Changes

- Updated dependencies [ce7390b]
  - @lytics/dev-agent-core@0.2.0
