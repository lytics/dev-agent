---
"@lytics/dev-agent": minor
"@lytics/dev-agent-cli": minor
"@lytics/dev-agent-core": minor
"@lytics/dev-agent-mcp": minor
"@lytics/dev-agent-subagents": minor
"@lytics/dev-agent-types": minor
---

## 🎉 v0.8.0 - Major Feature Release

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

