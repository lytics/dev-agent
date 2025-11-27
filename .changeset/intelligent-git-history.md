---
"@lytics/dev-agent": minor
"@lytics/dev-agent-core": minor
"@lytics/dev-agent-mcp": minor
"@lytics/dev-agent-subagents": minor
---

feat: Intelligent Git History (v0.4.0)

New capabilities for understanding codebase history:

**`dev_history` tool** - Semantic search over git commits
- Search commit messages by meaning (e.g., "authentication token fix")
- Get file history with rename tracking
- Token-budgeted output

**`dev_map` enhancements** - Change frequency indicators
- 🔥 Hot directories (5+ commits in 30 days)
- ✏️ Active directories (1-4 commits in 30 days)
- 📝 Recent activity (commits in 90 days)

**`dev_plan` enhancements** - Git context in planning
- Related commits shown alongside code snippets
- Issue/PR references extracted from commits
- Helps understand prior work on similar features

**Core infrastructure:**
- `GitIndexer` for semantic commit search
- `LocalGitExtractor` for git operations
- Extensible architecture for future git features
