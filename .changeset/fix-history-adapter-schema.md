---
"@lytics/dev-agent": patch
"@lytics/dev-agent-mcp": patch
---

Fix dev_history tool schema for Claude API compatibility

- Removed `anyOf` from input schema (Claude API doesn't support it at top level)
- Validation for "at least one of query or file required" is still enforced in execute()

