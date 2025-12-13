/**
 * Activity command - Show most active files by commit frequency
 */

import * as path from 'node:path';
import {
  type FileMetrics,
  getMostActive,
  getStoragePath,
  MetricsStore,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

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
 * Format files as a compact table
 */
function formatFileMetricsTable(files: FileMetrics[]): string {
  if (files.length === 0) return '';

  // Calculate column widths
  const maxPathLen = Math.max(...files.map((f) => f.filePath.length), 40);
  const pathWidth = Math.min(maxPathLen, 55);

  // Header
  let output = chalk.bold(
    `${'FILE'.padEnd(pathWidth)}  ${'COMMITS'.padStart(7)}  ${'LOC'.padStart(6)}  ${'AUTHORS'.padStart(7)}  ${'LAST CHANGE'}\n`
  );

  // Separator line
  output += chalk.dim(`${'─'.repeat(pathWidth + 2 + 7 + 2 + 6 + 2 + 7 + 2 + 12)}\n`);

  // Rows
  for (const file of files) {
    // Truncate path if too long
    let displayPath = file.filePath;
    if (displayPath.length > pathWidth) {
      displayPath = `...${displayPath.slice(-(pathWidth - 3))}`;
    }
    displayPath = displayPath.padEnd(pathWidth);

    const commits = String(file.commitCount).padStart(7);
    const loc = String(file.linesOfCode).padStart(6);

    // Author count with emoji
    const authorIcon = file.authorCount === 1 ? ' 👤' : file.authorCount === 2 ? ' 👥' : '👥👥';
    const authors = `${String(file.authorCount).padStart(5)}${authorIcon}`;

    // Relative time
    const lastChange = file.lastModified ? formatRelativeTime(file.lastModified) : 'unknown';

    output += `${chalk.dim(displayPath)}  ${chalk.cyan(commits)}  ${chalk.yellow(loc)}  ${chalk.green(authors)}  ${chalk.gray(lastChange)}\n`;
  }

  return output;
}

/**
 * Generate summary insights
 */
function generateActivitySummary(files: FileMetrics[]): string[] {
  const insights: string[] = [];
  const highChurn = files.filter((f) => f.commitCount >= 10).length;
  const singleAuthor = files.filter((f) => f.authorCount === 1).length;

  if (highChurn > 0) {
    insights.push(`${highChurn} file${highChurn > 1 ? 's' : ''} changed 10+ times this month`);
  }
  if (singleAuthor > 0 && singleAuthor === files.length) {
    insights.push(`All files have single author`);
  } else if (singleAuthor > files.length / 2) {
    insights.push(`${singleAuthor}/${files.length} files have single author`);
  }

  return insights;
}

/**
 * Activity command - Show most active files
 */
export const activityCommand = new Command('activity')
  .description('Show most active files by commit frequency')
  .option('-n, --limit <number>', 'Number of files to show', '10')
  .option('--json', 'Output as JSON', false)
  .action(async (options) => {
    try {
      const config = await loadConfig();
      if (!config) {
        logger.error('No config found. Run "dev init" first.');
        process.exit(1);
      }

      const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
      const storagePath = await getStoragePath(path.resolve(repositoryPath));
      const metricsDbPath = path.join(storagePath, 'metrics.db');

      const store = new MetricsStore(metricsDbPath);
      const latestSnapshot = store.getLatestSnapshot(path.resolve(repositoryPath));

      if (!latestSnapshot) {
        logger.warn('No metrics found. Index your repository first with "dev index".');
        store.close();
        process.exit(0);
      }

      const limit = Number.parseInt(options.limit, 10);
      const files = getMostActive(store, latestSnapshot.id, limit);

      // Get total count for context
      const allFiles = store.getCodeMetadata({ snapshotId: latestSnapshot.id, limit: 10000 });
      const totalWithActivity = allFiles.filter((f) => (f.commitCount || 0) >= 5).length;

      store.close();

      if (files.length === 0) {
        logger.warn('No file metrics available.');
        process.exit(0);
      }

      // JSON output for programmatic use
      if (options.json) {
        console.log(JSON.stringify({ files, totalWithActivity }, null, 2));
        return;
      }

      // Human-readable table output
      console.log('');
      console.log(
        chalk.bold.cyan(`📊 Most Active Files (${totalWithActivity} total with 5+ commits)`)
      );
      console.log('');
      console.log(formatFileMetricsTable(files));
      console.log('');

      // Add summary
      const summary = generateActivitySummary(files);
      if (summary.length > 0) {
        console.log(chalk.dim('Summary:'));
        for (const insight of summary) {
          console.log(chalk.dim(`  • ${insight}`));
        }
      }

      console.log('');
    } catch (error) {
      logger.error(
        `Failed to get activity metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });
