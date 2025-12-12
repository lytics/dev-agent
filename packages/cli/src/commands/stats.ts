import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  compareStats,
  type DetailedIndexStats,
  ensureStorageDirectory,
  exportLanguageStatsAsMarkdown,
  exportPackageStatsAsMarkdown,
  exportStatsAsCsv,
  exportStatsAsJson,
  getStorageFilePaths,
  getStoragePath,
  RepositoryIndexer,
} from '@lytics/dev-agent-core';
import { GitHubIndexer } from '@lytics/dev-agent-subagents';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import {
  formatCompactSummary,
  formatComponentTypes,
  formatDetailedLanguageTable,
  formatGitHubSummary,
  formatLanguageBreakdown,
  output,
} from '../utils/output.js';

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

/**
 * Helper function to load current stats
 */
async function loadCurrentStats(): Promise<{
  stats: DetailedIndexStats | null;
  githubStats: unknown | null;
  repositoryPath: string;
}> {
  // Load config
  const config = await loadConfig();
  if (!config) {
    throw new Error('No config found. Run "dev init" first to initialize dev-agent');
  }

  // Resolve repository path
  const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
  const resolvedRepoPath = path.resolve(repositoryPath);

  // Get centralized storage paths
  const storagePath = await getStoragePath(resolvedRepoPath);
  await ensureStorageDirectory(storagePath);
  const filePaths = getStorageFilePaths(storagePath);

  const indexer = new RepositoryIndexer({
    repositoryPath: resolvedRepoPath,
    vectorStorePath: filePaths.vectors,
    statePath: filePaths.indexerState,
    excludePatterns: config.repository?.excludePatterns || config.excludePatterns,
    languages: config.repository?.languages || config.languages,
  });

  await indexer.initialize();

  const stats = (await indexer.getStats()) as DetailedIndexStats | null;

  // Try to load GitHub stats
  let githubStats = null;
  try {
    // Try to load repository from state file
    let repository: string | undefined;
    try {
      const stateContent = await fs.readFile(filePaths.githubState, 'utf-8');
      const state = JSON.parse(stateContent);
      repository = state.repository;
    } catch {
      // State file doesn't exist
    }

    const githubIndexer = new GitHubIndexer(
      {
        vectorStorePath: `${filePaths.vectors}-github`,
        statePath: filePaths.githubState,
        autoUpdate: false,
      },
      repository
    );
    await githubIndexer.initialize();
    githubStats = githubIndexer.getStats();
    await githubIndexer.close();
  } catch {
    // GitHub not indexed, ignore
  }

  await indexer.close();

  return { stats, githubStats, repositoryPath: resolvedRepoPath };
}

// Main stats command (show current stats)
const showStatsCommand = new Command('show')
  .description('Show current indexing statistics (default)')
  .option('--json', 'Output stats as JSON', false)
  .option('-v, --verbose', 'Show detailed breakdown with tables', false)
  .action(async (options) => {
    const spinner = ora('Loading statistics...').start();

    try {
      const { stats, githubStats, repositoryPath: resolvedRepoPath } = await loadCurrentStats();
      spinner.stop();

      if (!stats) {
        output.warn('No indexing statistics available');
        output.log(`Run ${chalk.cyan('dev index')} to index your repository first`);
        output.log('');
        return;
      }

      // Output as JSON if requested
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              repository: stats,
              github: githubStats || undefined,
            },
            null,
            2
          )
        );
        return;
      }

      // Get repository name from path
      const repoName = resolvedRepoPath.split('/').pop() || 'repository';

      output.log('');

      // Compact one-line summary
      output.log(formatCompactSummary(stats, repoName));
      output.log('');

      // Language breakdown (compact or verbose)
      if (stats.byLanguage && Object.keys(stats.byLanguage).length > 0) {
        if (options.verbose) {
          // Verbose: Show table with LOC
          output.log(formatDetailedLanguageTable(stats.byLanguage));
        } else {
          // Compact: Show simple list
          output.log(formatLanguageBreakdown(stats.byLanguage));
        }
        output.log('');
      }

      // Component types summary (compact - top 3)
      if (stats.byComponentType && Object.keys(stats.byComponentType).length > 0) {
        output.log(formatComponentTypes(stats.byComponentType));
        output.log('');
      }

      // GitHub stats (compact)
      if (githubStats && typeof githubStats === 'object' && 'repository' in githubStats) {
        output.log(
          formatGitHubSummary(
            githubStats as {
              repository: string;
              totalDocuments: number;
              byType: { issue?: number; pull_request?: number };
              byState: { open?: number; closed?: number; merged?: number };
              lastIndexed: string;
            }
          )
        );
      } else {
        output.log(`🔗 ${chalk.gray('GitHub not indexed. Run')} ${chalk.cyan('dev gh index')}`);
      }

      output.log('');
    } catch (error) {
      spinner.fail('Failed to load statistics');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Compare command - compare two stat snapshots
const compareCommand = new Command('compare')
  .description('Compare two stat snapshots to see changes over time')
  .argument('<before>', 'Path to "before" stats JSON file')
  .argument('<after>', 'Path to "after" stats JSON file')
  .option('--json', 'Output comparison as JSON', false)
  .action(async (beforePath: string, afterPath: string, options) => {
    const spinner = ora('Loading stat snapshots...').start();

    try {
      // Load both stat files
      const beforeContent = await fs.readFile(beforePath, 'utf-8');
      const afterContent = await fs.readFile(afterPath, 'utf-8');

      const beforeStats: DetailedIndexStats = JSON.parse(beforeContent);
      const afterStats: DetailedIndexStats = JSON.parse(afterContent);

      spinner.text = 'Comparing statistics...';

      // Calculate diff
      const diff = compareStats(beforeStats, afterStats);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(diff, null, 2));
        return;
      }

      // Pretty print comparison
      output.log('');
      output.log(chalk.bold.cyan('📊 Stats Comparison'));
      output.log('');

      // Summary
      output.log(chalk.bold('Summary:'));
      output.log(
        `  Trend: ${diff.summary.overallTrend === 'growing' ? chalk.green('Growing') : diff.summary.overallTrend === 'shrinking' ? chalk.red('Shrinking') : chalk.gray('Stable')}`
      );
      if (diff.summary.languagesAdded.length > 0) {
        output.log(`  Languages added: ${chalk.green(diff.summary.languagesAdded.join(', '))}`);
      }
      if (diff.summary.languagesRemoved.length > 0) {
        output.log(`  Languages removed: ${chalk.red(diff.summary.languagesRemoved.join(', '))}`);
      }
      output.log('');

      // Overall changes
      output.log(chalk.bold('Overall Changes:'));
      const fileChange = diff.files.absolute;
      const fileSymbol = fileChange > 0 ? '↑' : fileChange < 0 ? '↓' : '•';
      const fileColor = fileChange > 0 ? chalk.green : fileChange < 0 ? chalk.red : chalk.gray;
      const filePercent = diff.files.percent;
      output.log(
        `  Files:     ${fileColor(`${fileSymbol} ${fileChange >= 0 ? '+' : ''}${fileChange} (${filePercent >= 0 ? '+' : ''}${filePercent.toFixed(1)}%)`)} [${diff.files.before} → ${diff.files.after}]`
      );

      const docChange = diff.documents.absolute;
      const docSymbol = docChange > 0 ? '↑' : docChange < 0 ? '↓' : '•';
      const docColor = docChange > 0 ? chalk.green : docChange < 0 ? chalk.red : chalk.gray;
      const docPercent = diff.documents.percent;
      output.log(
        `  Documents: ${docColor(`${docSymbol} ${docChange >= 0 ? '+' : ''}${docChange} (${docPercent >= 0 ? '+' : ''}${docPercent.toFixed(1)}%)`)} [${diff.documents.before} → ${diff.documents.after}]`
      );

      const vecChange = diff.vectors.absolute;
      const vecSymbol = vecChange > 0 ? '↑' : vecChange < 0 ? '↓' : '•';
      const vecColor = vecChange > 0 ? chalk.green : vecChange < 0 ? chalk.red : chalk.gray;
      const vecPercent = diff.vectors.percent;
      output.log(
        `  Vectors:   ${vecColor(`${vecSymbol} ${vecChange >= 0 ? '+' : ''}${vecChange} (${vecPercent >= 0 ? '+' : ''}${vecPercent.toFixed(1)}%)`)} [${diff.vectors.before} → ${diff.vectors.after}]`
      );

      output.log(`  Time between snapshots: ${chalk.gray(formatDuration(diff.timeDelta))}`);
      output.log('');

      // Language changes
      if (diff.languages && Object.keys(diff.languages).length > 0) {
        output.log(chalk.bold('By Language (top changes):'));
        const langChanges = Object.entries(diff.languages)
          .map(([lang, langDiff]) => ({ lang, diff: langDiff }))
          .filter((item) => item.diff.files.absolute !== 0)
          .sort((a, b) => Math.abs(b.diff.files.absolute) - Math.abs(a.diff.files.absolute))
          .slice(0, 5);

        for (const { lang, diff: langDiff } of langChanges) {
          const filesDiff = langDiff.files.absolute;
          const symbol = filesDiff > 0 ? '↑' : '↓';
          const color = filesDiff > 0 ? chalk.green : chalk.red;
          output.log(
            `  ${chalk.cyan(lang)}: ${color(`${symbol} ${filesDiff >= 0 ? '+' : ''}${filesDiff} files (${langDiff.files.percent.toFixed(1)}%)`)} [${langDiff.files.before} → ${langDiff.files.after}]`
          );
        }
        output.log('');
      }

      // Component type changes
      if (diff.componentTypes && Object.keys(diff.componentTypes).length > 0) {
        output.log(chalk.bold('By Component Type (top changes):'));
        const changedTypes = Object.entries(diff.componentTypes)
          .filter(([_, countDiff]) => countDiff.absolute !== 0)
          .sort((a, b) => Math.abs(b[1].absolute) - Math.abs(a[1].absolute))
          .slice(0, 5);

        for (const [type, countDiff] of changedTypes) {
          const change = countDiff.absolute;
          const symbol = change > 0 ? '↑' : '↓';
          const color = change > 0 ? chalk.green : chalk.red;
          output.log(
            `  ${type}: ${color(`${symbol} ${change >= 0 ? '+' : ''}${change} (${countDiff.percent.toFixed(1)}%)`)} [${countDiff.before} → ${countDiff.after}]`
          );
        }
        output.log('');
      }
    } catch (error) {
      spinner.fail('Failed to compare statistics');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Export command - export current stats in various formats
const exportCommand = new Command('export')
  .description('Export current statistics in various formats')
  .option('-f, --format <format>', 'Output format (json, markdown)', 'json')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (options) => {
    const spinner = ora('Loading statistics...').start();

    try {
      const { stats } = await loadCurrentStats();

      if (!stats) {
        spinner.fail('No statistics available');
        output.warn('Run "dev index" to index your repository first');
        process.exit(1);
      }

      spinner.text = `Exporting as ${options.format}...`;

      let outputContent: string;

      switch (options.format.toLowerCase()) {
        case 'json':
          outputContent = exportStatsAsJson(stats);
          break;
        case 'csv':
          outputContent = exportStatsAsCsv(stats);
          break;
        case 'markdown':
        case 'md': {
          // Build markdown with language and package tables
          const lines: string[] = [];
          lines.push('# Repository Statistics');
          lines.push('');
          lines.push(`**Repository:** ${stats.repositoryPath}`);
          lines.push(`**Files Scanned:** ${stats.filesScanned}`);
          lines.push(`**Documents Indexed:** ${stats.documentsIndexed}`);
          lines.push(`**Vectors Stored:** ${stats.vectorsStored}`);
          lines.push(`**Duration:** ${stats.duration}ms`);
          lines.push('');

          if (stats.byLanguage && Object.keys(stats.byLanguage).length > 0) {
            lines.push(exportLanguageStatsAsMarkdown(stats.byLanguage));
            lines.push('');
          }

          if (stats.byPackage && Object.keys(stats.byPackage).length > 0) {
            lines.push(exportPackageStatsAsMarkdown(stats.byPackage));
            lines.push('');
          }

          outputContent = lines.join('\n');
          break;
        }
        default:
          spinner.fail(`Unknown format: ${options.format}`);
          logger.error('Supported formats: json, csv, markdown');
          process.exit(1);
      }

      spinner.stop();

      // Output to file or stdout
      if (options.output) {
        await fs.writeFile(options.output, outputContent, 'utf-8');
        output.success(`Statistics exported to ${chalk.cyan(options.output)}`);
      } else {
        console.log(outputContent);
      }
    } catch (error) {
      spinner.fail('Failed to export statistics');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Main stats command with subcommands
export const statsCommand = new Command('stats')
  .description('Manage and view indexing statistics')
  .addCommand(showStatsCommand, { isDefault: true })
  .addCommand(compareCommand)
  .addCommand(exportCommand);
