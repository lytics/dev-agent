---
"@lytics/dev-agent-cli": patch
---

### Bug Fixes

- **Default config now includes all 9 MCP adapters**: `dev init` previously only enabled 4 adapters. Now all 9 tools (search, refs, map, history, plan, explore, github, status, health) are enabled by default.

### Features

- **Index size reporting**: `dev index` now calculates and displays actual storage size after indexing (e.g., "Storage size: 2.5 MB"). Previously showed 0.

### Internal

- Moved `getDirectorySize` and `formatBytes` utilities to shared `file.ts` module
- Added comprehensive tests for size calculation and formatting
- Added integration test to verify storage size appears in index output

