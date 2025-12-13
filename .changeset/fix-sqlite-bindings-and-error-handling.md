---
"@lytics/dev-agent": patch
"@lytics/dev-agent-cli": patch
---

## Bug Fix & UX Improvements

### Fixed Native Bindings Error

Added `better-sqlite3` as a direct dependency to fix "Could not locate the bindings file" error in globally installed package.

### Improved Error Messages

Added consistent, user-friendly error messages across all commands when indexed data is missing. Commands now provide clear re-index instructions instead of cryptic errors.

Affected commands: `dev activity`, `dev owners`, `dev map`, `dev stats`

