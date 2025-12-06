# Development Workflow

Standard workflow for implementing features in dev-agent.

## The Drill™

### 1. Find Next Work (Dogfooding! 🐕🍽️)

```bash
# Update main branch
git checkout main
git pull origin main

# Use GitHub Context to find what to work on next
dev gh search "state:open label:\"Epic: MCP Integration\"" --type issue

# Or use gh CLI directly
gh issue list --milestone "Epic #3: MCP Integration" --state open

# The tool helps you:
# - Find open issues by epic/milestone
# - See issue dependencies
# - Prioritize based on labels
# - Avoid duplicate work
```

### 2. Start New Feature

```bash
# Create feature branch (use feat/, fix/, docs/, etc.)
git checkout -b feat/feature-name

# Update TODOs (mark as in_progress)
# Done via todo_write tool in Claude
```

### 3. Planning Phase (Dogfooding! 🐕🍽️)

```bash
# Read the issue requirements
gh issue view <issue-number>

# Use the Planner to break down the work
dev plan <issue-number> --json

# Review the plan and adjust as needed
# The planner will:
# - Break issue into specific tasks
# - Find relevant code locations
# - Estimate effort
# - Suggest implementation order
```

**Why dogfood the Planner?**
- ✅ Tests our own tool in real scenarios
- ✅ Identifies bugs and missing features
- ✅ Improves estimation accuracy over time
- ✅ Validates usefulness for end users

### 4. Implementation Phase

```bash
# Design interfaces first (in comments or types)
# Implement with test-driven development
# Document with examples as you go
```

**Implementation Checklist:**
- [ ] Define types/interfaces
- [ ] Implement core functionality
- [ ] Write comprehensive tests
- [ ] Add usage examples
- [ ] Create README if new module
- [ ] Update related documentation

### 5. Quality Checks

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Check specific package coverage
npx vitest run packages/<package>/src/<module> --coverage

# Lint and format
pnpm lint
pnpm format

# Type check
pnpm typecheck
```

**Quality Standards:**
- ✅ All tests passing
- ✅ 85%+ statement coverage (aim for 90%+)
- ✅ 100% function coverage
- ✅ No linter errors
- ✅ No TypeScript errors
- ✅ Documentation with examples

### 6. Commit & PR

```bash
# Stage all changes
git add -A

# Commit with conventional commit format
git commit -m "feat(<scope>): <description>

<detailed description>

Features:
- Feature 1
- Feature 2

Testing:
- X tests, all passing
- Y% coverage

<additional sections>

Issue: #<issue-number>"

# Push to remote
git push -u origin feat/feature-name

# Create PR with comprehensive description
gh pr create \
  --title "feat(<scope>): <title>" \
  --body "<detailed PR description>" \
  --base main
```

## Commit Message Format

### Structure

```
<type>(<scope>): <short description>

<detailed description>

<body sections>

Issue: #<number>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `chore`: Maintenance tasks

### Scopes
- `scanner`: Repository scanner
- `vector`: Vector storage
- `indexer`: Repository indexer
- `cli`: Command-line interface
- `subagents`: Subagent system
- `core`: Core functionality

### Body Sections

**Always include:**
- **Implementation**: What was built
- **Features**: Key features added
- **Testing**: Test count, coverage
- **Issue**: Reference to GitHub issue

**Optional but recommended:**
- **Performance**: Performance metrics
- **Documentation**: What was documented
- **Architecture**: Design decisions
- **Breaking Changes**: API changes
- **Known Limitations**: What doesn't work yet

## PR Description Format

### Principles

**Keep it concise and meaningful** - Context is important, but excessive noise makes PRs harder to parse. Focus on essential information that helps reviewers and provides future reference.

### Structure

```markdown
## Summary
1-2 sentence overview of what this PR does and why.

## Problem (if fix)
Brief description of the bug/issue being fixed.

## Solution
- Key change 1
- Key change 2
- Key change 3

## Usage (if new feature)
```bash
# Example command or code snippet
```

## Testing
- ✅ X tests passing (Y new tests)
- ✅ Verified on: specific scenario/repository
- ⚠️ Known limitations (if any)

## Changes
- N commits: brief description of commit types
- Packages affected: list relevant packages
```

### Good Example

```markdown
## Summary
Fixes ENOBUFS error when indexing repositories with many GitHub issues/PRs.

## Problem
\`dev index\` would fail with \`ENOBUFS\` on repositories with extensive GitHub 
activity due to buffer overflow (default 1MB buffer, fetching 1000+ items).

## Solution
- Increased maxBuffer: 1MB → 50MB for issue/PR fetching
- Lowered default limit: 1000 → 500 items per type
- Added \`--gh-limit <number>\` CLI flag for customization
- Improved error messages with actionable suggestions

## Usage
\`\`\`bash
dev index                    # Default (500 items)
dev index --gh-limit 200     # Large repos
dev index --gh-limit 100     # Very active repos
\`\`\`

## Testing
- ✅ All 1100+ tests passing
- ✅ 23 new fetcher utility tests
- ✅ Verified on 6,989 file repo with 1,000 issues/PRs

## Changes
- 6 commits: fix implementation, tests, documentation, changeset, website
- Patches: \`@lytics/dev-agent\`, \`@lytics/dev-agent-cli\`, \`@lytics/dev-agent-subagents\`
```

### What to Exclude

**Don't include:**
- ❌ Verbose change logs (commits already document this)
- ❌ Line-by-line code explanations
- ❌ Coverage tables (CI provides this)
- ❌ Full test lists (test files document this)
- ❌ Obvious information that's in the code

**Instead:**
- ✅ Focus on the "why" and key decisions
- ✅ Usage examples for new features
- ✅ Verification details for bug fixes
- ✅ Brief overview of what changed

## Testing Standards

### Coverage Goals
- **Statement Coverage**: 85%+ (aim for 90%+)
- **Branch Coverage**: 60%+ (aim for 80%+)
- **Function Coverage**: 100%
- **Line Coverage**: 85%+

### Test Organization

```typescript
describe('ComponentName', () => {
  // Setup
  beforeAll(async () => {
    // Initialize shared resources
  });

  afterAll(async () => {
    // Cleanup
  });

  // Happy path tests
  it('should do main thing', () => {});
  it('should handle common case', () => {});

  // Edge cases
  it('should handle empty input', () => {});
  it('should handle large input', () => {});

  // Error cases
  it('should throw on invalid input', () => {});
  it('should handle error gracefully', () => {});
});

describe('ComponentName - Advanced', () => {
  // Complex scenarios
  it('should handle concurrent operations', () => {});
  it('should handle cleanup', () => {});
});
```

### What to Test

**Must Test:**
- ✅ Happy paths (normal usage)
- ✅ Edge cases (empty, null, boundaries)
- ✅ Error handling
- ✅ Public API methods
- ✅ Integration points

**Don't Need to Test:**
- ❌ Type definitions (TypeScript handles this)
- ❌ External library behavior
- ❌ Private implementation details (test through public API)

## Documentation Standards

### Module README Structure

```markdown
# Module Name
Brief description

## Overview
What it does and why

## Architecture
Component diagram or description

## Usage Examples
### Basic Setup
### Common Operations
### Advanced Usage

## API Reference
### Classes
### Interfaces
### Functions

## Performance Characteristics
Metrics and benchmarks

## Best Practices
Tips for effective usage

## Limitations & Future Work
What doesn't work yet

## Testing
How to run tests

## Troubleshooting
Common issues and solutions
```

### Code Documentation

```typescript
/**
 * Class description
 * 
 * @example
 * ```typescript
 * const instance = new MyClass();
 * await instance.doSomething();
 * ```
 */
export class MyClass {
  /**
   * Method description
   * 
   * @param param1 - What it is
   * @param param2 - What it is
   * @returns What it returns
   * @throws {Error} When it throws
   */
  async doSomething(param1: string, param2: number): Promise<Result> {
    // Implementation
  }
}
```

## Branch Naming

### Format
```
<type>/<description>
```

### Examples
- `feat/repository-indexer`
- `feat/vector-storage`
- `fix/scanner-error-handling`
- `docs/add-usage-examples`
- `test/improve-coverage`

## Issue Management

### When Starting Work
```bash
# Assign yourself
gh issue develop <number> --checkout

# Or manually
gh issue edit <number> --add-assignee @me
```

### When Completing Work
- Reference in commit: `Issue: #<number>`
- Reference in PR: `Closes #<number>`
- GitHub will auto-close on merge

## Quick Reference Commands

```bash
# Check current branch
git branch --show-current

# View issue details
gh issue view <number>

# List open issues
gh issue list

# View PR
gh pr view <number>

# List open PRs
gh pr list

# Run tests for specific module
pnpm test packages/<package>/src/<module>

# Run with coverage
npx vitest run packages/<package>/src/<module> --coverage

# Build specific package
pnpm -F "@lytics/<package>" build

# Lint specific package
pnpm -F "@lytics/<package>" lint
```

## Example: Complete Feature Workflow

```bash
# 1. Start
git checkout main
git pull origin main
git checkout -b feat/amazing-feature

# 2. Implement
# - Write types
# - Write tests
# - Implement
# - Document

# 3. Verify
pnpm build
pnpm test
npx vitest run packages/core/src/amazing --coverage

# 4. Commit
git add -A
git commit -m "feat(amazing): implement amazing feature

Implements amazing functionality that does X, Y, Z.

Features:
- Feature X with performance optimization
- Feature Y with error handling
- Feature Z with comprehensive docs

Testing:
- 25 tests, all passing
- 92% statement coverage, 100% function coverage
- Tested: happy paths, edge cases, errors

Documentation:
- README with usage examples
- API reference
- Integration guide

Performance:
- Operation X: <10ms
- Operation Y: <100ms

Issue: #42"

# 5. Push & PR
git push -u origin feat/amazing-feature
gh pr create --title "feat(amazing): Amazing Feature" --body "..." --base main

# 6. After Review & Merge
git checkout main
git pull origin main
git branch -d feat/amazing-feature
```

## Tips

### Incremental Commits
- Commit frequently with meaningful messages
- Each commit should be a logical unit
- Easier to review and debug

### Test-Driven Development
1. Write failing test
2. Implement minimal code to pass
3. Refactor
4. Repeat

### Documentation-Driven Development
1. Write README examples first
2. Define interfaces
3. Implement to match examples
4. Update docs as needed

### Code Review
- Keep PRs focused (one feature/fix)
- Write detailed PR descriptions
- Include examples and screenshots
- Respond to feedback promptly
- Update TODOs after merge

---

**Remember:** Quality over speed. Well-tested, documented code saves time in the long run.

