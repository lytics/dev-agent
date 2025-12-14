---
"@lytics/dev-agent-core": minor
"@lytics/dev-agent-cli": minor
---

Massive indexing performance and UX improvements

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
  - **Changed files mode**: Shows ownership of uncommitted changes (for PR reviews)
  - **Root directory mode**: High-level overview of top areas (packages/cli/, packages/core/)
  - **Subdirectory mode**: Detailed expertise for specific area
  - **Visual hierarchy**: Tree branches (├─, └─) and emojis (📝, 📁, 👤) for better readability
  - **Activity-focused**: Sorted by last active, not file count (no more leaderboard vibes)
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

