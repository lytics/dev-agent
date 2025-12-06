---
"@lytics/dev-agent": patch
"@lytics/dev-agent-subagents": patch
"@lytics/dev-agent-cli": patch
---

Fix ENOBUFS error during GitHub issues/PRs indexing for large repositories

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

