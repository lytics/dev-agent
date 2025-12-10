# @lytics/dev-agent-cli

## 0.2.0

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

### Patch Changes

- Updated dependencies [f578042]
  - @lytics/dev-agent-core@0.6.0
  - @lytics/dev-agent-subagents@0.4.0
  - @lytics/dev-agent-mcp@0.4.7

## 0.1.11

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

- Updated dependencies [d6e5e6f]
  - @lytics/dev-agent-subagents@0.3.3
  - @lytics/dev-agent-mcp@0.4.6

## 0.1.10

### Patch Changes

- Updated dependencies [579925c]
  - @lytics/dev-agent-core@0.5.1
  - @lytics/dev-agent-mcp@0.4.5
  - @lytics/dev-agent-subagents@0.3.2

## 0.1.9

### Patch Changes

- Updated dependencies [d0481b4]
  - @lytics/dev-agent-core@0.5.0
  - @lytics/dev-agent-mcp@0.4.4
  - @lytics/dev-agent-subagents@0.3.1

## 0.1.8

### Patch Changes

- Updated dependencies [ad4af12]
  - @lytics/dev-agent-mcp@0.4.3

## 0.1.7

### Patch Changes

- 5918edb: ### Bug Fixes

  - **Default config now includes all 9 MCP adapters**: `dev init` previously only enabled 4 adapters. Now all 9 tools (search, refs, map, history, plan, explore, github, status, health) are enabled by default.

  ### Features

  - **Index size reporting**: `dev index` now calculates and displays actual storage size after indexing (e.g., "Storage size: 2.5 MB"). Previously showed 0.

  ### Internal

  - Moved `getDirectorySize` and `formatBytes` utilities to shared `file.ts` module
  - Added comprehensive tests for size calculation and formatting
  - Added integration test to verify storage size appears in index output

## 0.1.6

### Patch Changes

- Updated dependencies [40192f5]
  - @lytics/dev-agent-mcp@0.4.2

## 0.1.5

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

- Updated dependencies [4b55a04]
  - @lytics/dev-agent-mcp@0.4.1

## 0.1.4

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

## 0.1.3

### Patch Changes

- Updated dependencies [c42f5ba]
  - @lytics/dev-agent-core@0.4.0
  - @lytics/dev-agent-mcp@0.4.0
  - @lytics/dev-agent-subagents@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [afa8adb]
  - @lytics/dev-agent-core@0.3.0
  - @lytics/dev-agent-mcp@0.3.0
  - @lytics/dev-agent-subagents@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [ce7390b]
  - @lytics/dev-agent-core@0.2.0
  - @lytics/dev-agent-mcp@0.2.0
  - @lytics/dev-agent-subagents@0.1.1
