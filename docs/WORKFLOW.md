# Development Workflow

Standard workflow for implementing features in dev-agent.

## The Drill™

### 1. Start New Feature

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch (use feat/, fix/, docs/, etc.)
git checkout -b feat/feature-name

# Update TODOs (mark as in_progress)
# Done via todo_write tool in Claude
```

### 2. Implementation Phase

```bash
# Read the issue requirements
gh issue view <issue-number>

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

### 3. Quality Checks

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

### 4. Commit & PR

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

### Structure

```markdown
## Summary
Brief overview of what this PR does.

## Features
✅ Feature 1
✅ Feature 2
✅ Feature 3

## Testing
- ✅ X tests, all passing
- ✅ Y% statement coverage (Z% function coverage)
- ✅ Tested: scenarios covered
- ⚠️ Uncovered: what's not covered and why

## Performance
- Metric 1: value
- Metric 2: value

## Documentation
- ✅ README with examples
- ✅ API reference
- ✅ Usage guide

## Example Usage
```typescript
// Clear, runnable example
```
\`\`\`

## Coverage Report
\`\`\`
Coverage table
\`\`\`

## Known Limitations
- ⚠️ Limitation 1
- ⚠️ Limitation 2

## Closes
Closes #<issue-number>
```

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

