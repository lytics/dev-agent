/**
 * Owners command - Show code ownership and developer contributions
 */

import * as path from 'node:path';
import { getStoragePath, MetricsStore } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Developer ownership stats
 */
interface DeveloperStats {
  email: string;
  displayName: string; // GitHub handle or shortened email
  files: number;
  commits: number;
  linesOfCode: number;
  lastActive: Date | null;
  topFiles: Array<{ path: string; commits: number; loc: number }>;
}

/**
 * Extract GitHub handle from email or git config
 */
function getDisplayName(email: string, repositoryPath: string): string {
  const { execSync } = require('node:child_process');

  // Try GitHub-style emails: username@users.noreply.github.com
  const githubMatch = email.match(/^([^@]+)@users\.noreply\.github\.com$/);
  if (githubMatch) {
    return `@${githubMatch[1]}`;
  }

  // Try to get GitHub username from git config
  try {
    const username = execSync('git config --get github.user', {
      cwd: repositoryPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (username) {
      return `@${username}`;
    }
  } catch (_error) {
    // Git config not set, continue
  }

  // Fallback: shorten email (username part only)
  const atIndex = email.indexOf('@');
  if (atIndex > 0) {
    return email.substring(0, atIndex);
  }

  return email;
}

/**
 * Get current user as GitHub handle
 */
function getCurrentUser(repositoryPath: string): string {
  const { execSync } = require('node:child_process');
  try {
    const email = execSync('git config user.email', {
      cwd: repositoryPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return getDisplayName(email, repositoryPath);
  } catch {
    return 'unknown';
  }
}

/**
 * Get list of changed files (uncommitted changes)
 */
function getChangedFiles(repositoryPath: string): string[] {
  const { execSync } = require('node:child_process');
  try {
    const output = execSync('git diff --name-only HEAD', {
      cwd: repositoryPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if current directory is at repo root
 */
function isAtRepoRoot(repositoryPath: string): boolean {
  return process.cwd() === repositoryPath;
}

/**
 * Get current directory relative to repo root
 */
function getCurrentDirectory(repositoryPath: string): string {
  const cwd = process.cwd();
  if (cwd === repositoryPath) return '';
  return `${cwd.replace(repositoryPath, '').replace(/^\//, '')}/`;
}

/**
 * Calculate developer ownership from indexed data (instant, no git calls!)
 */
async function calculateDeveloperOwnership(
  store: MetricsStore,
  snapshotId: string,
  repositoryPath: string
): Promise<DeveloperStats[]> {
  // Get all files with metrics
  const allFiles = store.getCodeMetadata({ snapshotId, limit: 10000 });

  // Build file path lookup map
  const fileMetadataMap = new Map(allFiles.map((f) => [f.filePath, f]));

  // Calculate file author contributions on-demand (fast batched git call)
  const { calculateFileAuthorContributions } = await import('@lytics/dev-agent-core');
  const fileAuthors = await calculateFileAuthorContributions({ repositoryPath });

  // Build developer stats grouped by GitHub handle (normalized identity)
  const devMap = new Map<
    string,
    {
      emails: Set<string>; // Track all emails for this developer
      files: Set<string>;
      commits: number;
      linesOfCode: number;
      lastActive: Date | null;
      fileCommits: Map<string, { commits: number; loc: number }>;
    }
  >();

  // For each file, assign to primary author (most commits)
  for (const [filePath, authors] of fileAuthors) {
    if (authors.length === 0) continue;

    // Primary author is first in list (already sorted by commit count)
    const primaryAuthor = authors[0];
    if (!primaryAuthor) continue;

    const fileMetadata = fileMetadataMap.get(filePath);
    if (!fileMetadata) continue;

    // Normalize to GitHub handle (groups multiple emails for same developer)
    const displayName = getDisplayName(primaryAuthor.authorEmail, repositoryPath);

    // Update developer stats (grouped by display name, not email)
    let devData = devMap.get(displayName);
    if (!devData) {
      devData = {
        emails: new Set(),
        files: new Set(),
        commits: 0,
        linesOfCode: 0,
        lastActive: null,
        fileCommits: new Map(),
      };
      devMap.set(displayName, devData);
    }

    // Track this email for this developer
    devData.emails.add(primaryAuthor.authorEmail);

    devData.files.add(filePath);
    devData.commits += primaryAuthor.commitCount;
    devData.linesOfCode += fileMetadata.linesOfCode;
    devData.fileCommits.set(filePath, {
      commits: primaryAuthor.commitCount,
      loc: fileMetadata.linesOfCode,
    });

    // Track most recent activity
    const lastCommit = primaryAuthor.lastCommit || fileMetadata.lastModified;
    if (lastCommit) {
      if (!devData.lastActive || lastCommit > devData.lastActive) {
        devData.lastActive = lastCommit;
      }
    }
  }

  // Convert to array and sort by file count
  const developers: DeveloperStats[] = [];
  for (const [displayName, data] of devMap) {
    // Get top 5 files by commit count
    const sortedFiles = Array.from(data.fileCommits.entries())
      .sort((a, b) => b[1].commits - a[1].commits)
      .slice(0, 5);

    // Use first email for identity (already normalized by displayName)
    const primaryEmail = Array.from(data.emails)[0] || displayName;

    developers.push({
      email: primaryEmail,
      displayName,
      files: data.files.size,
      commits: data.commits,
      linesOfCode: data.linesOfCode,
      lastActive: data.lastActive,
      topFiles: sortedFiles.map(([path, stats]) => ({
        path,
        commits: stats.commits,
        loc: stats.loc,
      })),
    });
  }

  // Sort by number of files owned (descending)
  developers.sort((a, b) => b.files - a.files);

  return developers;
}

/**
 * Format changed files mode with tree branches
 */
function formatChangedFilesMode(
  changedFiles: string[],
  fileOwners: Map<string, { owner: string; commits: number; lastActive: Date | null }>,
  currentUser: string,
  _repositoryPath: string
): string {
  let output = '';
  output += chalk.bold('📝 Modified files') + chalk.gray(` (${changedFiles.length}):\n`);

  const reviewers = new Set<string>();

  for (let i = 0; i < changedFiles.length; i++) {
    const file = changedFiles[i];
    const isLast = i === changedFiles.length - 1;
    const prefix = isLast ? '└─' : '├─';
    const ownerInfo = fileOwners.get(file);

    // Shorten file path for display
    const displayPath = file.length > 60 ? `...${file.slice(-57)}` : file;

    if (!ownerInfo) {
      output += chalk.dim(`  ${prefix} ${displayPath}\n`);
      output += chalk.dim(`  ${isLast ? ' ' : '│'}    Owner: Unknown (new file?)\n`);
    } else {
      const isYours = ownerInfo.owner === currentUser;
      const icon = isYours ? '✅' : '⚠️ ';

      output += `  ${chalk.gray(prefix)} ${icon} ${chalk.white(displayPath)}\n`;
      output += chalk.dim(
        `  ${isLast ? ' ' : '│'}    Owner: ${isYours ? 'You' : ownerInfo.owner} (${chalk.cyan(ownerInfo.owner)})`
      );
      output += chalk.dim(` • ${ownerInfo.commits} commits\n`);

      if (!isYours) {
        reviewers.add(ownerInfo.owner);
      }
    }

    if (!isLast) output += chalk.dim(`  │\n`);
  }

  if (reviewers.size > 0) {
    output += '\n';
    output += chalk.yellow(`💡 Suggested reviewers: ${Array.from(reviewers).join(', ')}\n`);
  }

  return output;
}

/**
 * Format root directory mode with tree branches
 */
function formatRootDirectoryMode(developers: DeveloperStats[], repositoryPath: string): string {
  // Group files by top-level directory
  const dirMap = new Map<string, { files: Set<string>; owner: string; lastActive: Date | null }>();

  for (const dev of developers) {
    for (const fileData of dev.topFiles) {
      const relativePath = fileData.path.replace(`${repositoryPath}/`, '');
      const parts = relativePath.split('/');

      // For monorepos (packages/*, apps/*), show 2 levels. Otherwise, 1 level.
      let topDir = parts[0] || '';
      if (topDir === 'packages' || topDir === 'apps' || topDir === 'libs') {
        topDir = parts.slice(0, 2).join('/');
      }

      if (!topDir) continue;

      let dirData = dirMap.get(topDir);
      if (!dirData) {
        dirData = { files: new Set(), owner: dev.displayName, lastActive: dev.lastActive };
        dirMap.set(topDir, dirData);
      }
      dirData.files.add(fileData.path);

      // Use most recently active owner
      if (dev.lastActive && (!dirData.lastActive || dev.lastActive > dirData.lastActive)) {
        dirData.owner = dev.displayName;
        dirData.lastActive = dev.lastActive;
      }
    }
  }

  const repoName = repositoryPath.split('/').pop() || 'repository';
  let output = chalk.bold(`📦 ${repoName}\n\n`);
  output += chalk.bold('Top areas:\n');

  const dirs = Array.from(dirMap.entries()).sort((a, b) => b[1].files.size - a[1].files.size);

  for (let i = 0; i < Math.min(dirs.length, 10); i++) {
    const [dirName, data] = dirs[i];
    const isLast = i === Math.min(dirs.length, 10) - 1;
    const prefix = isLast ? '└─' : '├─';
    const relTime = data.lastActive ? formatRelativeTime(data.lastActive) : 'unknown';

    output += chalk.dim(`  ${prefix} `) + chalk.cyan(`📁 ${dirName}/`);
    output += chalk.gray(`  ${data.owner} • ${data.files.size} files • Active ${relTime}\n`);
  }

  output += '\n';
  output += chalk.dim(
    `💡 Tip: Use ${chalk.cyan(`'dev owners ${dirs[0]?.[0]}/'`)} to see details\n`
  );

  return output;
}

/**
 * Format subdirectory mode with tree branches
 */
function formatSubdirectoryMode(
  developers: DeveloperStats[],
  currentDir: string,
  repositoryPath: string
): string {
  // Filter developers to only those with files in current directory
  const relevantDevs = developers.filter((dev) =>
    dev.topFiles.some((f) => f.path.startsWith(`${repositoryPath}/${currentDir}`))
  );

  if (relevantDevs.length === 0) {
    return chalk.yellow('No ownership data found for this directory\n');
  }

  const primary = relevantDevs[0];
  let output = chalk.bold(`📁 ${currentDir}\n\n`);

  output += chalk.bold(`👤 ${primary.displayName}`) + chalk.gray(' (Primary expert)\n');
  output += chalk.dim(`  ├─ ${primary.files} files owned\n`);
  output += chalk.dim(`  ├─ ${primary.commits} commits total\n`);
  const lastActiveStr = primary.lastActive ? formatRelativeTime(primary.lastActive) : 'unknown';
  output += chalk.dim(`  └─ Last active: ${lastActiveStr}\n`);

  // Show top files in this directory
  const filesInDir = primary.topFiles
    .filter((f) => f.path.startsWith(`${repositoryPath}/${currentDir}`))
    .slice(0, 5);

  if (filesInDir.length > 0) {
    output += '\n';
    output += chalk.bold('Recent files:\n');

    for (let i = 0; i < filesInDir.length; i++) {
      const file = filesInDir[i];
      const isLast = i === filesInDir.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const fileName = file.path.split('/').pop() || file.path;
      const locStr = file.loc >= 1000 ? `${(file.loc / 1000).toFixed(1)}k` : String(file.loc);

      output += chalk.dim(`  ${prefix} ${fileName} • ${file.commits} commits • ${locStr} LOC\n`);
    }
  }

  output += '\n';
  if (relevantDevs.length === 1) {
    output += chalk.dim(`💡 Tip: You're the main contributor here\n`);
  } else {
    output += chalk.dim(`💡 Tip: ${relevantDevs.length} contributors work in this area\n`);
  }

  return output;
}

/**
 * Format relative time (e.g., "2 days ago", "today")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Owners command - Show developer contributions
 */
export const ownersCommand = new Command('owners')
  .description('Show code ownership and developer contributions (context-aware)')
  .option('-n, --limit <number>', 'Number of developers to display (default: 10)', '10')
  .option('--json', 'Output as JSON', false)
  .action(async (options) => {
    try {
      const config = await loadConfig();
      if (!config) {
        logger.error('No config found. Run "dev init" first.');
        process.exit(1);
      }

      const repositoryPath = path.resolve(
        config.repository?.path || config.repositoryPath || process.cwd()
      );
      const storagePath = await getStoragePath(repositoryPath);
      const metricsDbPath = path.join(storagePath, 'metrics.db');

      const store = new MetricsStore(metricsDbPath);
      const latestSnapshot = store.getLatestSnapshot(repositoryPath);

      if (!latestSnapshot) {
        logger.warn('No metrics found. Index your repository first with "dev index".');
        store.close();
        process.exit(0);
      }

      // Calculate developer ownership on-demand (uses fast batched git call)
      const developers = await calculateDeveloperOwnership(
        store,
        latestSnapshot.id,
        repositoryPath
      );
      store.close();

      if (developers.length === 0) {
        logger.warn('No developer ownership data found.');
        process.exit(0);
      }

      // JSON output for programmatic use
      if (options.json) {
        const limit = Number.parseInt(options.limit, 10);
        const topDevelopers = developers.slice(0, limit);
        console.log(
          JSON.stringify({ developers: topDevelopers, total: developers.length }, null, 2)
        );
        return;
      }

      // Context-aware modes
      console.log('');

      // Mode 1: Changed files (if there are uncommitted changes)
      const changedFiles = getChangedFiles(repositoryPath);
      if (changedFiles.length > 0) {
        const currentUser = getCurrentUser(repositoryPath);

        // Build file ownership map
        const fileOwners = new Map<
          string,
          { owner: string; commits: number; lastActive: Date | null }
        >();
        for (const dev of developers) {
          for (const fileData of dev.topFiles) {
            const relativePath = fileData.path.replace(`${repositoryPath}/`, '');
            if (!fileOwners.has(relativePath)) {
              fileOwners.set(relativePath, {
                owner: dev.displayName,
                commits: fileData.commits,
                lastActive: dev.lastActive,
              });
            }
          }
        }

        console.log(formatChangedFilesMode(changedFiles, fileOwners, currentUser, repositoryPath));
        console.log('');
        return;
      }

      // Mode 2: Root directory (show high-level areas)
      if (isAtRepoRoot(repositoryPath)) {
        console.log(formatRootDirectoryMode(developers, repositoryPath));
        console.log('');
        return;
      }

      // Mode 3: Subdirectory (show expertise for current area)
      const currentDir = getCurrentDirectory(repositoryPath);
      console.log(formatSubdirectoryMode(developers, currentDir, repositoryPath));
      console.log('');
    } catch (error) {
      logger.error(
        `Failed to get ownership metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });
