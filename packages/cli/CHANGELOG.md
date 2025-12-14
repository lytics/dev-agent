# @lytics/dev-agent-cli

## 0.6.0

### Minor Changes

- 8b4972a: Remove git analytics commands to refocus on semantic value

  **BREAKING CHANGES:**

  - Remove `dev owners` command - use `git log` or GitHub contributors instead
  - Remove `dev activity` command - use `git log --since` for activity analysis

  **What's Changed:**

  - Removed 891 lines from `dev owners` command
  - Removed 175 lines from `dev activity` command
  - Cleaned up dead code in `change-frequency.ts` (calculateFileAuthorContributions)
  - Simplified metrics collection to focus on code structure introspection

  **What's Kept:**

  - `code_metadata` table for debugging/introspection of indexed code
  - `calculateChangeFrequency` for `dev_map` MCP tool (shows commit activity in codebase structure)

  **Why:**

  Dev-agent's unique value is semantic search (embeddings + AST), not git analytics which GitHub/git already provide. This change reduces complexity by ~1,200 lines and refocuses on MCP tools for AI context.

  **Migration:**

  For contributor/ownership analytics, use:

  - `git log --format="%ae" <path> | sort | uniq -c | sort -rn` for ownership
  - `git log --since="1 month" --name-only | sort | uniq -c | sort -rn` for activity
  - GitHub's Contributors page for visualization

### Patch Changes

- Updated dependencies [8b4972a]
  - @lytics/dev-agent-core@0.9.2
  - @lytics/dev-agent-mcp@0.5.3
  - @lytics/dev-agent-subagents@0.5.3

## 0.5.1

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
  - @lytics/dev-agent-subagents@0.5.2
  - @lytics/dev-agent-mcp@0.5.2

## 0.5.0

### Minor Changes

- d23d1a9: Massive indexing performance and UX improvements

  **Performance Optimizations (184% faster):**

  - **63x faster metadata collection**: Eliminated 863 individual git calls by using single batched git command
  - **Removed storage size calculation**: Deferred to on-demand in `dev stats` (saves 1-3s)
  - **Simplified ownership tracking**: Author contributions now calculated on-demand in `dev owners` (1s), removed SQLite pre-indexing overhead
  - **Total speedup**: Indexing now completes in ~33s vs ~95s (61s improvement!)

  **Architecture Simplifications:**

  - Removed `file_authors` SQLite table (on-demand is fast enough)
  - Removed `appendFileAuthors()` and `getFileAuthors()` from MetricsStore
  - Removed `authorContributions` from IndexUpdatedEvent
  - Cleaner separation: metrics for analytics, ownership for developer insights

  **UX Improvements (no more silent gaps):**

  - **Section-based progress display**: Clean, informative output inspired by Homebrew/Cargo
  - **Applied to 4 commands**: `dev index`, `dev update`, `dev git index`, `dev github index`
  - **Live progress updates**: Shows current progress for each phase (scanning, embedding, git, GitHub)
  - **Clean indexing plan**: Removed INFO timestamps from plan display
  - **Helpful next steps**: Suggests relevant commands after indexing completes
  - **More frequent scanner progress**: Logs every 2 batches OR every 10 seconds (was every 50 files)
  - **Slow file detection**: Debug logs for files/batches taking >5s to process
  - **Cleaner completion summary**: Removed storage size from index output (shown in `dev stats` instead)
  - **Continuous feedback**: Maximum 1-second gaps between progress updates
  - **Context-aware `dev owners` command**: Adapts output based on git status and current directory
    - **Changed files mode**: Shows ownership of uncommitted changes with real-time git log analysis
    - **Root directory mode**: High-level overview of top areas (packages/cli/, packages/core/)
    - **Subdirectory mode**: Detailed expertise for specific area
    - **Smart ownership display**: Asymmetric icons that only flag exceptions (⚠️ for others' files, 🆕 for new files)
    - **Last touched timestamps**: Shows when files were last modified (catches stale code and active development)
    - **Recent activity detection**: Warns when others recently touched your files (prevents conflicts)
    - **Suggested reviewers**: Automatically identifies who to loop in for code reviews
    - **Visual hierarchy**: Tree branches (├─, └─) and emojis (📝, 📁, 👤) for better readability
    - **Activity-focused**: Sorted by last active, not file count (no more leaderboard vibes)
    - **Git root detection**: Works from any subdirectory within the repository
  - **Better developer grouping**: `dev owners` now groups by GitHub handle instead of email (merges multiple emails for same developer)
  - **Graceful degradation**: Verbose mode and non-TTY environments show traditional log output

  **Technical Details:**

  - Added `log-update` dependency for smooth single-line progress updates
  - New `ProgressRenderer` class for section-based progress display
  - Optimized `buildCodeMetadata()` to derive change frequency from author contributions instead of making separate git calls
  - Scanner now tracks time since last log and ensures updates every 10s
  - Storage size calculation moved from index-time to query-time (lazy evaluation)
  - TTY detection for graceful fallback in CI/CD environments

  **Before:**

  ```
  [14:27:37] typescript 3450/3730 (92%)
             ← 3 MINUTES OF SILENCE
  [14:30:09] typescript 3600/3730 (97%)
             ← EMBEDDING COMPLETES
             ← 63 SECONDS OF SILENCE
  [14:31:12] Starting git extraction
  ```

  **After:**

  ```
  ▸ Scanning Repository
    357/433 files (82%, 119 files/sec)
  ✓ Scanning Repository (3.2s)
    433 files → 2,525 components

  ▸ Embedding Vectors
    1,600/2,525 documents (63%, 108 docs/sec)
  ✓ Embedding Vectors (20.7s)
    2,525 documents

  ▸ Git History
    150/252 commits (60%)
  ✓ Git History (4.4s)
    252 commits

  ▸ GitHub Issues/PRs
    82/163 documents (50%)
  ✓ GitHub Issues/PRs (7.8s)
    163 documents

  ✓ Repository indexed successfully!

    Indexed: 433 files • 2,525 components • 252 commits • 163 GitHub docs
    Duration: 33.5s

  💡 Next steps:
     dev map       Explore codebase structure
     dev owners    See contributor stats
     dev activity  Find active files
  ```

### Patch Changes

- Updated dependencies [d23d1a9]
  - @lytics/dev-agent-core@0.9.0
  - @lytics/dev-agent-mcp@0.5.1
  - @lytics/dev-agent-subagents@0.5.1

## 0.4.1

### Patch Changes

- 5656263: ## Bug Fix & UX Improvements

  ### Fixed Native Bindings Error

  Added `better-sqlite3` as a direct dependency to fix "Could not locate the bindings file" error in globally installed package.

  ### Improved Error Messages

  Added consistent, user-friendly error messages across all commands when indexed data is missing. Commands now provide clear re-index instructions instead of cryptic errors.

  Affected commands: `dev activity`, `dev owners`, `dev map`, `dev stats`

## 0.4.0

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
  - @lytics/dev-agent-mcp@0.5.0
  - @lytics/dev-agent-subagents@0.5.0

## 0.3.0

### Minor Changes

- c13b24f: UX and performance improvements for TypeScript projects

  **UX Improvements:**

  - MCP install is now idempotent for Claude Code - shows positive message when server already exists instead of erroring
  - Enhanced documentation with clear customization examples for exclusion patterns

  **Performance Improvements:**

  - Add TypeScript-specific exclusion patterns to default config for 10-15% indexing performance improvement
  - Exclude mock files (_.mock.ts, _.mock.tsx, mocks/), type definition files (\*.d.ts), and test infrastructure (test-utils/, testing/)

  **Configurability:**

  - TypeScript exclusions are now fully configurable via .dev-agent/config.json
  - Users can customize patterns, include type definitions if desired, or add project-specific exclusions
  - Default config provides optimized performance while maintaining full user control

  **Semantic Value Preserved:**

  - Stories files are kept (contain valuable component documentation and usage patterns)
  - Only excludes truly low-value files while preserving semantic content for AI tools

### Patch Changes

- Updated dependencies [c13b24f]
  - @lytics/dev-agent-core@0.7.0
  - @lytics/dev-agent-mcp@0.4.9
  - @lytics/dev-agent-subagents@0.4.2

## 0.2.1

### Patch Changes

- b675fc9: fix: improve reliability, performance, and documentation for Go support

  ## Major Features

  - **Performance Configuration**: Environment variables for fine-tuning concurrency (DEV*AGENT*\*\_CONCURRENCY)
  - **Enhanced Go Scanner**: Runtime WASM validation, improved error handling, better reliability
  - **TypeScript Improvements**: Streamlined error handling, better type checking, enhanced progress reporting
  - **System Resource Detection**: Intelligent performance defaults based on CPU and memory
  - **Architectural Utilities**: Reusable modules for WASM resolution, concurrency, and file validation

  ## New Environment Variables

  - `DEV_AGENT_TYPESCRIPT_CONCURRENCY`: Control TypeScript scanner parallelism
  - `DEV_AGENT_INDEXER_CONCURRENCY`: Configure embedding batch processing
  - `DEV_AGENT_GO_CONCURRENCY`: Tune Go scanner performance
  - `DEV_AGENT_CONCURRENCY`: General fallback for all scanners

  ## Documentation & User Experience

  - Document missing `dev update` command for incremental indexing
  - Add timing expectations (5-10 minutes for large codebases)
  - Create LANGUAGE_SUPPORT.md contributor guide
  - Enhanced troubleshooting and configuration sections
  - Remove Renovate automation for manual dependency control

  ## Technical Improvements

  - 57 new tests with comprehensive coverage
  - Dependency injection for testable file system operations
  - Centralized error handling patterns across scanners
  - Build script reliability fixes (prevent silent failures)

  This release significantly improves performance, reliability, and developer experience while maintaining backward compatibility.

- Updated dependencies [b675fc9]
  - @lytics/dev-agent-core@0.6.1
  - @lytics/dev-agent-mcp@0.4.8
  - @lytics/dev-agent-subagents@0.4.1

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
