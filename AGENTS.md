# AGENTS.md

This is a TypeScript monorepo starter template designed to be cloned and customized by developers.

## Project Overview

A modern TypeScript monorepo using pnpm workspaces, Turborepo for build orchestration, Biome for linting/formatting, Vitest for testing, and Changesets for versioning. By default, all packages are private to prevent accidental publishing when users clone the template.

**Tech Stack:**

- Package manager: pnpm 8.15.4
- Build system: Turborepo
- Linter/Formatter: Biome
- Testing: Vitest (run from root)
- CI/CD: GitHub Actions (separate CI and Release workflows)
- Versioning: Changesets
- Node.js: >= 22 (LTS)

## Repository Structure

```
packages/
├── core/          # Core package with tests
├── utils/         # Utilities (depends on core)
└── feature-a/     # Feature package (depends on core and utils)
```

Each package has its own `package.json`, `tsconfig.json`, and `src/` directory. All packages are currently marked as `"private": true`.

## Setup Commands

```bash
# Install dependencies (required first step)
pnpm install

# Build all packages (required before typecheck)
pnpm build

# Lint all packages
pnpm lint

# Type check all packages (must run AFTER build)
pnpm typecheck

# Run all tests (runs from root using centralized vitest config)
pnpm test

# Watch mode for tests
pnpm test:watch

# Clean all build outputs
pnpm clean
```

## Development Workflow

### Working on a specific package

```bash
# Build a specific package
pnpm -F "@monorepo/core" build

# Watch mode for development
pnpm -F "@monorepo/core" dev

# Run tests for a specific package (note: tests run from root)
cd packages/core && pnpm test:watch
```

### Important: Build Order

Packages with dependencies must be built in order. Turborepo handles this automatically, but be aware:

- `@monorepo/core` has no dependencies (builds first)
- `@monorepo/utils` depends on `@monorepo/core`
- `@monorepo/feature-a` depends on both `@monorepo/core` and `@monorepo/utils`

**Critical:** Always run `pnpm build` before `pnpm typecheck` because TypeScript needs the built `.d.ts` files from dependencies.

## Testing Instructions

Tests use Vitest with a centralized configuration at the root (`vitest.config.ts`).

- Test files: `**/*.test.ts` or `**/*.spec.ts` in `packages/*/src/`
- Run from root: `pnpm test` (NOT `turbo test`)
- The test script in root package.json runs `vitest run`, not `turbo test`
- Only `@monorepo/core` currently has tests (`packages/core/src/index.test.ts`)

**When adding tests:**

1. Place test files next to source files: `src/myModule.test.ts`
2. Import from the source file: `import { MyClass } from './myModule'`
3. Run `pnpm test` from root to verify

## Code Style

- TypeScript strict mode enabled
- Biome handles linting and formatting (config in `biome.json`)
- Run `pnpm lint` to check, `pnpm format` to auto-fix
- Conventional Commits enforced via Commitlint
- Husky hooks run typecheck on pre-commit

**Commit message format:**

```
type(scope): description

# Examples:
feat(core): add new authentication method
fix(utils): resolve import path issue
chore: update dependencies
```

## CI/CD Workflows

### CI Workflow (`.github/workflows/ci.yml`)

- Triggers: Push to main OR Pull Request to main
- Node version: 22.x (LTS)
- Steps: Install → Lint → Build → Typecheck → Test
- **Important:** Build runs BEFORE typecheck (required for type definitions)

### Release Workflow (`.github/workflows/release.yml`)

- Triggers: After CI succeeds on main branch (workflow_run)
- Uses Changesets to version and publish packages
- **By default, does nothing** because all packages are private
- To enable publishing: Set `"private": false` in package.json and add `NPM_TOKEN` secret

## Adding a New Package

1. Create directory: `packages/new-package/`
2. Add `package.json`:
   ```json
   {
     "name": "@monorepo/new-package",
     "version": "0.1.0",
     "private": true,
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "typecheck": "tsc --noEmit",
       "lint": "biome lint ./src"
     }
   }
   ```
3. Add `tsconfig.json` extending from root
4. Create `src/index.ts`
5. Add to `vitest.config.ts` alias if needed
6. Run `pnpm install` to link workspace packages

## Package Dependencies

Use workspace protocol for internal dependencies:

```json
"dependencies": {
  "@monorepo/core": "workspace:*"
}
```

Turborepo automatically builds dependencies in the correct order.

## Versioning and Changesets

1. Make changes to packages
2. Run `pnpm changeset` to document changes
3. Select packages that changed and semantic version bump
4. Commit the changeset file
5. On merge to main, Changesets creates a version PR
6. Merge version PR to publish (only if packages are not private)

## Publishing to npm

**Template ships with all packages private by default.**

To publish a package:

1. In `packages/your-package/package.json`:
   - Change `"private": true` to `"private": false`
   - Add `"publishConfig": { "access": "public" }`
2. Ensure unique package name or use scoped name
3. Add `NPM_TOKEN` secret in GitHub repo settings
4. Release workflow will publish on next version bump

## Common Patterns

### Running commands in all packages

```bash
pnpm -r <command>  # Run in all packages
turbo <command>    # Run via Turborepo with caching
```

### Filtering specific packages

```bash
pnpm -F "@monorepo/core" build
pnpm --filter "@monorepo/*" test
```

### Checking package locations

```bash
pnpm list --depth 0  # See all workspace packages
```

## Troubleshooting

**TypeScript errors about missing types:**

- Run `pnpm build` first to generate `.d.ts` files
- Check that dependencies are listed in package.json
- Verify workspace links: `pnpm install`

**Tests not found:**

- Tests must match `packages/**/*.{test,spec}.ts` pattern
- Run from root: `pnpm test` (NOT from package directory with turbo)

**Build failures:**

- Check dependency order (core → utils → feature-a)
- Clear cache: `pnpm clean` then `pnpm build`
- Remove node_modules: `pnpm clean && pnpm install`

**CI failures on typecheck:**

- Ensure build step runs before typecheck in workflow
- Local: `pnpm build && pnpm typecheck`

## Security Considerations

- Never commit `.env` files or secrets
- NPM_TOKEN is stored as GitHub secret (not in code)
- All packages default to private to prevent accidental publishing
- Review dependencies regularly: `pnpm audit`

## Versioning Strategy

This template follows [Semantic Versioning 2.0.0](https://semver.org/) at the **repository level**, not per-package.

### Repository Versioning

Git tags use the format `vMAJOR.MINOR.PATCH` (e.g., `v1.0.0`, `v1.1.0`):

- **MAJOR**: Breaking changes to template structure, tooling, or workflows
  - Example: Changing package manager, build system, or major workflow restructuring
  - Users must adapt their code when upgrading

- **MINOR**: New features, packages, or improvements (backward compatible)
  - Example: Adding new example packages, new GitHub Actions workflows, new tooling
  - Users can adopt new features without breaking changes

- **PATCH**: Bug fixes, documentation updates, dependency patches
  - Example: Fixing CI configuration, updating README, security patches
  - Safe to update without any code changes

### Package Versioning

Individual packages remain at `0.1.0` by default:
- Packages are private by default (`"private": true`)
- Users customize package names and versions after cloning
- Version according to [Semantic Versioning](https://semver.org/) once users start developing

### Pre-release Versions

Use pre-release tags for experimental features:
- `v2.0.0-alpha.1` - Early testing, unstable
- `v2.0.0-beta.1` - Feature complete, testing phase
- `v2.0.0-rc.1` - Release candidate, final testing

## Template Customization

When using this template:

1. Update package names in all `package.json` files (change `@monorepo/*` scope)
2. Update repository URL in root `package.json`
3. Update LICENSE file with your information
4. Customize README.md for your project
5. Decide which packages should be public vs private
6. Update GitHub secrets if publishing to npm
7. Start versioning your packages from `0.1.0` according to your development needs
