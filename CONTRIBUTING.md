# Contributing to Dev-Agent

Thank you for considering contributing to dev-agent! This document outlines the process for contributing and the standards we follow.

## 🎯 **Core Values**

1. **Testability First** - If it's hard to test, refactor it
2. **Modularity** - Small, focused, reusable modules
3. **100% Coverage on Utilities** - Pure functions should be fully tested
4. **Atomic Commits** - Each commit should build and test independently

## Development Process

1. **Fork and clone** the repository
2. **Install dependencies**: `pnpm install`
3. **Create a branch**: `git checkout -b feature/my-feature`
4. **Make your changes**
5. **Test your changes**: `pnpm test`
6. **Ensure code quality**: `pnpm lint && pnpm typecheck`

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. This is enforced using commitlint.

Format: `type(scope): subject`

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that don't affect code meaning (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to build process or auxiliary tools

Example:
```
feat(core): add new API method for authentication
```

## Pull Request Process

1. Update the README.md if needed with details of changes to the interface.
2. Add a changeset to document your changes: `pnpm changeset`
3. Create a pull request to the `main` branch.
4. The PR will be reviewed and merged if it meets our standards.

## Adding New Packages

1. Create a new directory in the `packages` folder.
2. Create a `package.json`, `tsconfig.json`, and source files.
3. Add the package to relevant workspace configurations.
4. Update path mappings in the root `tsconfig.json`.

## Testing & Testability

### 📖 **Read First:** [TESTABILITY.md](./docs/TESTABILITY.md)

Our comprehensive testability guide covers:
- When and how to extract utilities
- Organization patterns
- Coverage targets
- Real-world examples

### **Quick Rules:**

1. **Extract Pure Functions** to `utils/` modules
   - ✅ DO: `utils/formatting.ts` with `formatDocument(doc: Document)`
   - ❌ DON'T: Private methods in 500-line classes

2. **Aim for 100% on Utilities**
   - Pure functions are easy to test
   - No mocks needed
   - Foundation for everything else

3. **No Non-Null Assertions (`!`)**
   - Use guard clauses or optional chaining
   - Makes code safer and more testable

4. **Organize by Domain**
   - ✅ `utils/strings.ts`, `utils/dates.ts`, `utils/validation.ts`
   - ❌ `utils.ts` (500 lines of everything)

### **Coverage Targets:**

| Code Type | Target | Example |
|-----------|--------|---------|
| **Pure Utilities** | 100% | `formatDocument()`, `calculateCoverage()` |
| **Integration** | >80% | `RepositoryIndexer`, `ExplorerAgent` |
| **CLI/UI** | >60% | Command handlers, spinners |

### **Before Submitting:**

```bash
# Run tests with coverage
pnpm vitest run --coverage

# Check specific package
pnpm vitest run packages/core/src/indexer --coverage
```

- Write tests for all new features and bug fixes
- Run existing tests to ensure your changes don't break existing functionality
- See [TESTABILITY.md](./docs/TESTABILITY.md) for detailed guidelines

## Code Style

We use Biome for linting and formatting:

- Run `pnpm lint` to check code quality.
- Run `pnpm format` to format the code.

All code must pass linting and typechecking before being merged.

## Versioning

We use [Changesets](https://github.com/changesets/changesets) to manage versions and generate changelogs.

After making changes:
1. Run `pnpm changeset`
2. Follow the prompts to describe your changes
3. Commit the generated changeset file

## Questions?

If you have any questions, please open an issue or discussion in the repository.