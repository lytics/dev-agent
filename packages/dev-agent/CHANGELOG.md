# @lytics/dev-agent

## 0.6.0

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

  - Add `--verbose` flag to `dev index`, `dev git index`, `dev gh index`
  - Progress spinner shows actual counts: `Embedding 4480/49151 documents (9%)`
  - Structured logging with kero logger

  **Go-Specific Exclusions**

  - Protobuf: `*.pb.go`, `*.pb.gw.go`
  - Generated: `*.gen.go`, `*_gen.go`
  - Mocks: `mock_*.go`, `mocks/`
  - Test fixtures: `testdata/`

  Tested on large Go codebase (~4k files, 49k documents).

## 0.5.2

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

## 0.5.1

### Patch Changes

- 579925c: Incremental indexing now works! `dev update` detects changed, new, and deleted files.

  **What's new:**

  - Only re-indexes files that actually changed (via content hash)
  - Detects new files added since last index
  - Cleans up documents for deleted files
  - Removes orphaned symbols when code is modified

  **Usage:**

  ```bash
  dev index .     # First run: full index
  dev update      # Fast incremental update
  dev index . --force  # Force full re-index
  ```

## 0.5.0

### Minor Changes

- d0481b4: feat(scanner): Extract arrow functions, function expressions, and exported constants

  ### New Features

  **Arrow Function Extraction**

  - Extract arrow functions assigned to `const`/`let` variables
  - Extract function expressions assigned to variables
  - Detect React hooks automatically (`use*` naming pattern)
  - Detect async arrow functions

  **Exported Constant Extraction**

  - Extract exported `const` with object literal initializers (config objects)
  - Extract exported `const` with array literal initializers (static lists)
  - Extract exported `const` with call expression initializers (factories like `createContext()`)

  ### API Changes

  **New DocumentType value:**

  - Added `'variable'` to `DocumentType` union

  **New metadata fields:**

  - `isArrowFunction?: boolean` - true for arrow functions (vs function expressions)
  - `isHook?: boolean` - true if name matches `/^use[A-Z]/` (React convention)
  - `isAsync?: boolean` - true for async functions
  - `isConstant?: boolean` - true for exported constants
  - `constantKind?: 'object' | 'array' | 'value'` - kind of constant initializer

  ### Examples

  Now extracts:

  ```typescript
  export const useAuth = () => { ... }           // Hook (isHook: true)
  export const fetchData = async (url) => { ... } // Async (isAsync: true)
  const validateEmail = (email: string) => ...   // Utility function
  export const API_CONFIG = { baseUrl: '...' }   // Object constant
  export const LANGUAGES = ['ts', 'js']          // Array constant
  export const AppContext = createContext({})    // Factory constant
  ```

  ### Migration

  No breaking changes. The new `'variable'` DocumentType is additive. Existing queries for `'function'`, `'class'`, etc. continue to work unchanged.

## 0.4.4

### Patch Changes

- ad4af12: ### Features

  - **Test file hints in search results**: `dev_search` now shows related test files (e.g., `utils.test.ts`) after search results. This surfaces test files without polluting semantic search rankings.

  ### Design

  - Uses structural matching (`.test.ts`, `.spec.ts` patterns) rather than semantic search
  - Keeps semantic search pure - test hints are in a separate "Related test files:" section
  - Patterns are configurable for future extensibility via function parameters

## 0.4.3

### Patch Changes

- 40192f5: Fix dev_history tool schema for Claude API compatibility

  - Removed `anyOf` from input schema (Claude API doesn't support it at top level)
  - Validation for "at least one of query or file required" is still enforced in execute()

## 0.4.2

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

## 0.4.1

### Patch Changes

- 573ad3a: feat: unified indexing and CLI improvements

  **`dev index .`** now indexes everything in one command:

  - Code (always)
  - Git history (if in a git repo)
  - GitHub issues/PRs (if gh CLI installed)

  Shows an upfront "indexing plan" with prerequisites check.
  Use `--no-git` or `--no-github` to skip specific indexers.

  **New `dev git` commands:**

  - `dev git index` - index git history separately
  - `dev git search <query>` - semantic search over commits
  - `dev git stats` - show indexed commit count

  **Fix:** `dev --version` now correctly displays installed version (injected at build time).

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
