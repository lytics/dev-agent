---
"@lytics/dev-agent": patch
"@lytics/dev-agent-cli": patch
---

feat: unified indexing and CLI improvements

**`dev index .`** now indexes everything in one command:
- Code (always)
- Git history (if in a git repo)
- GitHub issues/PRs (if gh CLI installed)

Shows an upfront "indexing plan" with prerequisites check.
Use `--no-git` or `--no-github` to skip specific indexers.

**New `dev git` commands:**
- `dev git index` - index git history separately
- `dev git search <query>` - semantic search over commits
- `dev git stats` - show indexed commit count

**Fix:** `dev --version` now correctly displays installed version (injected at build time).
