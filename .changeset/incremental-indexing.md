---
"@lytics/dev-agent-core": patch
"@lytics/dev-agent": patch
---

Incremental indexing now works! `dev update` detects changed, new, and deleted files.

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
