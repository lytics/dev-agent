---
"@lytics/dev-agent": patch
"@lytics/dev-agent-cli": patch
"@lytics/dev-agent-mcp": patch
---

Fix MCP server to include all 9 adapters and improve tool descriptions for better AI tool adoption

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

