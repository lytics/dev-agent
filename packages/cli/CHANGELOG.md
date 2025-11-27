# @lytics/dev-agent-cli

## 0.1.4

### Patch Changes

- 573ad3a: feat: unified indexing and CLI improvements

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

## 0.1.3

### Patch Changes

- Updated dependencies [c42f5ba]
  - @lytics/dev-agent-core@0.4.0
  - @lytics/dev-agent-mcp@0.4.0
  - @lytics/dev-agent-subagents@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [afa8adb]
  - @lytics/dev-agent-core@0.3.0
  - @lytics/dev-agent-mcp@0.3.0
  - @lytics/dev-agent-subagents@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [ce7390b]
  - @lytics/dev-agent-core@0.2.0
  - @lytics/dev-agent-mcp@0.2.0
  - @lytics/dev-agent-subagents@0.1.1
