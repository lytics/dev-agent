---
"@lytics/dev-agent-mcp": patch
"@lytics/dev-agent": patch
---

### Features

- **Test file hints in search results**: `dev_search` now shows related test files (e.g., `utils.test.ts`) after search results. This surfaces test files without polluting semantic search rankings.

### Design

- Uses structural matching (`.test.ts`, `.spec.ts` patterns) rather than semantic search
- Keeps semantic search pure - test hints are in a separate "Related test files:" section
- Patterns are configurable for future extensibility via function parameters

