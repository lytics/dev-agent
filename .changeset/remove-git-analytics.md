---
"@lytics/dev-agent-cli": minor
"@lytics/dev-agent-core": patch
"@lytics/dev-agent": patch
---

Remove git analytics commands to refocus on semantic value

**BREAKING CHANGES:**

- Remove `dev owners` command - use `git log` or GitHub contributors instead
- Remove `dev activity` command - use `git log --since` for activity analysis

**What's Changed:**

- Removed 891 lines from `dev owners` command
- Removed 175 lines from `dev activity` command  
- Cleaned up dead code in `change-frequency.ts` (calculateFileAuthorContributions)
- Simplified metrics collection to focus on code structure introspection

**What's Kept:**

- `code_metadata` table for debugging/introspection of indexed code
- `calculateChangeFrequency` for `dev_map` MCP tool (shows commit activity in codebase structure)

**Why:**

Dev-agent's unique value is semantic search (embeddings + AST), not git analytics which GitHub/git already provide. This change reduces complexity by ~1,200 lines and refocuses on MCP tools for AI context.

**Migration:**

For contributor/ownership analytics, use:
- `git log --format="%ae" <path> | sort | uniq -c | sort -rn` for ownership
- `git log --since="1 month" --name-only | sort | uniq -c | sort -rn` for activity
- GitHub's Contributors page for visualization

