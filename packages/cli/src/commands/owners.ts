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
 * Calculate developer ownership from indexed data (instant, no git calls!)
 */
function calculateDeveloperOwnership(
  store: MetricsStore,
  snapshotId: string,
  repositoryPath: string
): DeveloperStats[] {
  // Get all files with metrics
  const allFiles = store.getCodeMetadata({ snapshotId, limit: 10000 });

  // Build file path lookup map
  const fileMetadataMap = new Map(allFiles.map((f) => [f.filePath, f]));

  // Get indexed file author contributions
  const fileAuthors = store.getFileAuthors(snapshotId);

  // Build developer stats from indexed data
  const devMap = new Map<
    string,
    {
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

    // Update developer stats
    let devData = devMap.get(primaryAuthor.authorEmail);
    if (!devData) {
      devData = {
        files: new Set(),
        commits: 0,
        linesOfCode: 0,
        lastActive: null,
        fileCommits: new Map(),
      };
      devMap.set(primaryAuthor.authorEmail, devData);
    }

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
  for (const [email, data] of devMap) {
    // Get top 5 files by commit count
    const sortedFiles = Array.from(data.fileCommits.entries())
      .sort((a, b) => b[1].commits - a[1].commits)
      .slice(0, 5);

    developers.push({
      email,
      displayName: getDisplayName(email, repositoryPath),
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
 * Format developer stats as a table
 */
function formatDeveloperTable(developers: DeveloperStats[]): string {
  if (developers.length === 0) return '';

  // Calculate column widths based on display names
  const maxNameLen = Math.max(...developers.map((d) => d.displayName.length), 15);
  const nameWidth = Math.min(maxNameLen, 30);

  // Header
  let output = chalk.bold(
    `${'DEVELOPER'.padEnd(nameWidth)}  ${'FILES'.padStart(6)}  ${'COMMITS'.padStart(8)}  ${'LOC'.padStart(8)}  ${'LAST ACTIVE'}\n`
  );

  // Separator (calculate exact width)
  const separatorWidth = nameWidth + 2 + 6 + 2 + 8 + 2 + 8 + 2 + 12;
  output += chalk.dim(`${'─'.repeat(separatorWidth)}\n`);

  // Rows
  for (const dev of developers) {
    // Truncate display name if needed
    let displayName = dev.displayName;
    if (displayName.length > nameWidth) {
      displayName = `${displayName.slice(0, nameWidth - 3)}...`;
    }
    displayName = displayName.padEnd(nameWidth);

    const files = String(dev.files).padStart(6);
    const commits = String(dev.commits).padStart(8);

    // Format LOC with K suffix if >= 1000
    const locStr =
      dev.linesOfCode >= 1000 ? `${(dev.linesOfCode / 1000).toFixed(1)}k` : String(dev.linesOfCode);
    const loc = locStr.padStart(8);

    const lastActive = dev.lastActive ? formatRelativeTime(dev.lastActive) : 'unknown';

    output += `${chalk.cyan(displayName)}  ${chalk.yellow(files)}  ${chalk.green(commits)}  ${chalk.magenta(loc)}  ${chalk.gray(lastActive)}\n`;
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
  .description('Show developer contributions and code ownership')
  .option('-n, --limit <number>', 'Number of developers to show', '10')
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

      // Get all files first (before closing store)
      const allFiles = store.getCodeMetadata({ snapshotId: latestSnapshot.id, limit: 10000 });
      const totalFiles = allFiles.length;

      // Check if file_authors data exists
      const fileAuthors = store.getFileAuthors(latestSnapshot.id);
      if (fileAuthors.size === 0) {
        store.close();
        logger.warn('No author contribution data found.');
        console.log('');
        console.log(chalk.yellow('📌 This feature requires re-indexing your repository:'));
        console.log('');
        console.log(chalk.white('   dev index .'));
        console.log('');
        console.log(
          chalk.dim('   This is a one-time operation. Future updates will maintain author data.')
        );
        console.log('');
        process.exit(0);
      }

      const developers = calculateDeveloperOwnership(store, latestSnapshot.id, repositoryPath);
      store.close();

      if (developers.length === 0) {
        logger.warn('No developer ownership data found.');
        process.exit(0);
      }

      const limit = Number.parseInt(options.limit, 10);
      const topDevelopers = developers.slice(0, limit);

      // JSON output for programmatic use
      if (options.json) {
        console.log(
          JSON.stringify({ developers: topDevelopers, total: developers.length }, null, 2)
        );
        return;
      }

      // Human-readable table output
      console.log('');
      console.log(
        chalk.bold.cyan(`👥 Developer Contributions (${developers.length} total contributors)`)
      );
      console.log('');
      console.log(formatDeveloperTable(topDevelopers));
      console.log('');

      // Add summary insights
      const totalCommits = developers.reduce((sum, d) => sum + d.commits, 0);
      const topContributor = developers[0];

      console.log(chalk.dim('Summary:'));
      console.log(
        chalk.dim(`  • ${totalFiles} files total, ${totalCommits.toLocaleString()} commits`)
      );
      if (topContributor && developers.length > 1) {
        const percentage = Math.round((topContributor.files / totalFiles) * 100);
        console.log(
          chalk.dim(`  • ${topContributor.displayName} is primary owner of ${percentage}% of files`)
        );
      }

      console.log('');
    } catch (error) {
      logger.error(
        `Failed to get ownership metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });
