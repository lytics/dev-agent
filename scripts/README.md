# Scripts

Utility scripts for managing the dev-agent repository and GitHub issues.

## gh-issue-add-subs.sh

Add multiple sub-issues to a parent issue using GitHub's GraphQL API.

### Usage

```bash
./scripts/gh-issue-add-subs.sh <parent-issue-number> <child-issue-number>...
```

### Examples

```bash
# Add issues #52, #53, #54 as sub-issues of #31
./scripts/gh-issue-add-subs.sh 31 52 53 54

# Add a single sub-issue
./scripts/gh-issue-add-subs.sh 31 52
```

### Requirements

- GitHub CLI (`gh`) installed and authenticated
- Issues must exist in the current repository
- `jq` (optional, for better error formatting)

### How It Works

1. Fetches the parent issue ID using `gh issue view`
2. Fetches each child issue ID
3. Builds a batched GraphQL mutation with aliases (`add1`, `add2`, etc.)
4. Executes all mutations in a single GraphQL request
5. Displays results for each relationship created

### Exit Codes

- `0` - Success
- `1` - Missing required arguments
- `2` - Failed to get parent issue ID
- `3` - Failed to get child issue ID
- `4` - GraphQL mutation failed

### Notes

- The script uses GraphQL aliases to batch multiple `addSubIssue` mutations in a single request
- If a child issue already has a parent, GitHub will return an error (handled gracefully)
- All operations are performed atomically - if one fails, the entire batch fails

### Related GitHub Features

- [GitHub Issue Relationships](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)
- [GitHub GraphQL API - addSubIssue](https://docs.github.com/en/graphql/reference/mutations#addsubissue)

