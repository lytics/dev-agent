/**
 * Metrics commands - View repository metrics and file analytics
 */

import * as path from 'node:path';
import {
  type FileMetrics,
  getConcentratedOwnership,
  getLargestFiles,
  getMostActive,
  getStoragePath,
  MetricsStore,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Create progress bar for visualization
 */
function createBar(value: number, max: number, width = 10): string {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Get activity level label with color
 */
function getActivityLabel(activity: FileMetrics['activity']): string {
  const labels = {
    'very-high': chalk.red.bold('Very High'),
    high: chalk.red('High'),
    medium: chalk.yellow('Medium'),
    low: chalk.blue('Low'),
    minimal: chalk.gray('Minimal'),
  };
  return labels[activity];
}

/**
 * Get size label with color
 */
function getSizeLabel(size: FileMetrics['size']): string {
  const labels = {
    'very-large': chalk.red.bold('Very Large'),
    large: chalk.red('Large'),
    medium: chalk.yellow('Medium'),
    small: chalk.blue('Small'),
    tiny: chalk.gray('Tiny'),
  };
  return labels[size];
}

/**
 * Get ownership label with color
 */
function getOwnershipLabel(ownership: FileMetrics['ownership']): string {
  const labels = {
    single: chalk.red('Single'),
    pair: chalk.yellow('Pair'),
    'small-team': chalk.blue('Small Team'),
    shared: chalk.green('Shared'),
  };
  return labels[ownership];
}

/**
 * Format file metrics with visualization
 */
function formatFileMetrics(file: FileMetrics, maxCommits: number, maxLOC: number): string {
  const activityBar = createBar(file.commitCount, maxCommits);
  const sizeBar = createBar(file.linesOfCode, maxLOC);
  const ownershipBar = createBar(10 - file.authorCount, 10); // Invert: fewer authors = more concentrated

  const lastModified = file.lastModified ? `📅 ${file.lastModified.toLocaleDateString()}` : '';

  return `
${chalk.bold(file.filePath)}

📊 Activity:   ${activityBar}  ${getActivityLabel(file.activity)} (${file.commitCount} commits)
📏 Size:       ${sizeBar}  ${getSizeLabel(file.size)} (${file.linesOfCode} LOC, ${file.numFunctions} functions)
👥 Ownership:  ${ownershipBar}  ${getOwnershipLabel(file.ownership)} (${file.authorCount} ${file.authorCount === 1 ? 'author' : 'authors'})
${lastModified}
`;
}

/**
 * Activity command - Show most active files
 */
const activityCommand = new Command('activity')
  .description('Show most active files by commit frequency')
  .option('-n, --limit <number>', 'Number of files to show', '10')
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

      const files = getMostActive(store, latestSnapshot.id, Number.parseInt(options.limit, 10));
      store.close();

      if (files.length === 0) {
        logger.warn('No file metrics available.');
        process.exit(0);
      }

      // Calculate max values for scaling bars
      const maxCommits = Math.max(...files.map((f) => f.commitCount));
      const maxLOC = Math.max(...files.map((f) => f.linesOfCode));

      logger.log('');
      logger.log(chalk.bold.cyan(`📊 Most Active Files (by commits)`));
      logger.log('');

      for (const file of files) {
        logger.log(formatFileMetrics(file, maxCommits, maxLOC));
      }
    } catch (error) {
      logger.error(
        `Failed to get activity metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

/**
 * Size command - Show largest files
 */
const sizeCommand = new Command('size')
  .description('Show largest files by lines of code')
  .option('-n, --limit <number>', 'Number of files to show', '10')
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

      const files = getLargestFiles(store, latestSnapshot.id, Number.parseInt(options.limit, 10));
      store.close();

      if (files.length === 0) {
        logger.warn('No file metrics available.');
        process.exit(0);
      }

      const maxCommits = Math.max(...files.map((f) => f.commitCount));
      const maxLOC = Math.max(...files.map((f) => f.linesOfCode));

      logger.log('');
      logger.log(chalk.bold.cyan(`📏 Largest Files (by LOC)`));
      logger.log('');

      for (const file of files) {
        logger.log(formatFileMetrics(file, maxCommits, maxLOC));
      }
    } catch (error) {
      logger.error(
        `Failed to get size metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

/**
 * Ownership command - Show files with concentrated ownership
 */
const ownershipCommand = new Command('ownership')
  .description('Show files with concentrated ownership (single/pair authors)')
  .option('-n, --limit <number>', 'Number of files to show', '10')
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

      const files = getConcentratedOwnership(
        store,
        latestSnapshot.id,
        Number.parseInt(options.limit, 10)
      );
      store.close();

      if (files.length === 0) {
        logger.warn('No files with concentrated ownership found.');
        process.exit(0);
      }

      const maxCommits = Math.max(...files.map((f) => f.commitCount));
      const maxLOC = Math.max(...files.map((f) => f.linesOfCode));

      logger.log('');
      logger.log(chalk.bold.cyan(`👥 Concentrated Ownership (knowledge silos)`));
      logger.log('');

      for (const file of files) {
        logger.log(formatFileMetrics(file, maxCommits, maxLOC));
      }
    } catch (error) {
      logger.error(
        `Failed to get ownership metrics: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

/**
 * Metrics parent command
 */
export const metricsCommand = new Command('metrics')
  .description('View repository metrics and file analytics')
  .addCommand(activityCommand)
  .addCommand(sizeCommand)
  .addCommand(ownershipCommand);
