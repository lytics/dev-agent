---
"@lytics/dev-agent-cli": patch
"@lytics/dev-agent-core": patch
"@lytics/dev-agent-subagents": patch
"@lytics/dev-agent-types": patch
"@lytics/dev-agent": patch
---

# Visual Formatting & GitHub Stats Improvements

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

