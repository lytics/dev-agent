# Dependency Management

This project uses [Renovate](https://docs.renovatebot.com/) to automate dependency updates across the monorepo. This document describes how dependency updates are managed and how to work with the system.

## Overview

Renovate automatically:

1. Monitors all dependencies in the monorepo
2. Creates pull requests for updates
3. Groups related updates together to reduce PR noise
4. Automatically merges safe updates
5. Maintains a dependency dashboard

## Configuration Files

The Renovate configuration is split across several files:

- `renovate.json5` - Main configuration file
- `.github/renovate-automerge.json5` - Auto-merge settings
- `.github/renovate-groups.json5` - Package grouping settings
- `.github/workflows/renovate.yml` - GitHub workflow for self-hosted Renovate

## Update Schedule

Renovate is configured to run:

- Daily at 2:00 AM UTC via GitHub Actions
- Only creates PRs during off-hours (after 10pm and before 5am on weekdays, and on weekends)
- Lock file maintenance on Monday mornings
- Can be triggered manually via GitHub Actions workflow dispatch

## Update Strategy

The system follows these strategies:

1. **Minor and patch updates** are grouped together and auto-merged if tests pass
2. **Dev dependencies** are automatically merged for minor and patch versions
3. **Production dependencies** have stricter rules, with only patch versions auto-merged
4. **Major updates** require manual review and approval
5. **GitHub Actions** are automatically updated for minor and patch versions

## Package Grouping

Dependencies are grouped into logical categories:

- TypeScript ecosystem (TypeScript, tsconfig, type definitions)
- Linting and formatting tools (Biome, ESLint, Prettier)
- Testing tools (Vitest, Jest)
- Monorepo tooling (Changesets, Turborepo)
- Internal workspace packages

## Working with Renovate

### Dependency Dashboard

Renovate maintains a dependency dashboard as a pinned issue in the repository. This provides:

- Overview of all pending updates
- PRs that need attention
- Rejected/ignored updates
- Upcoming major updates

### Manual Control

You can influence Renovate behavior:

- Add `renovate:disable` comment in a PR to prevent Renovate from rebasing it
- Add specific packages to `ignoreDeps` in configuration to prevent updates
- Use the dashboard to manually trigger specific updates

### Best Practices

1. **Review major updates carefully** - These can contain breaking changes
2. **Don't modify package.json versions directly** - Let Renovate manage this
3. **Use the dashboard** to monitor and manage update flow
4. **Create changeset entries** for dependency updates that affect consumers

## Troubleshooting

If Renovate isn't working as expected:

1. Check the Renovate logs in GitHub Actions
2. Verify configuration files are valid JSON5
3. Look at the dependency dashboard for errors
4. Run Renovate manually via workflow dispatch with debug logging

## Further Reading

- [Renovate Documentation](https://docs.renovatebot.com/)
- [Renovate GitHub Action](https://github.com/renovatebot/github-action)
- [Monorepo Support in Renovate](https://docs.renovatebot.com/getting-started/installing-onboarding/#monorepos)