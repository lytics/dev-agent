import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type DetailedIndexStats,
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { output, printRepositoryStats } from '../utils/output.js';

/**
 * Helper function to load current stats (FAST - reads JSON directly, no LanceDB)
 */
async function loadCurrentStats(): Promise<{
  stats: DetailedIndexStats | null;
  metadata: {
    timestamp: string;
    storageSize: number;
    repository: {
      path: string;
      remote?: string;
      branch?: string;
      lastCommit?: string;
    };
  } | null;
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

  // Read indexer-state.json directly (FAST - no LanceDB initialization)
  let stats: DetailedIndexStats | null = null;
  try {
    const stateContent = await fs.readFile(filePaths.indexerState, 'utf-8');
    const state = JSON.parse(stateContent);
    // State file stores stats with totalFiles/totalDocuments field names
    // Map to DetailedIndexStats format (filesScanned/documentsIndexed)
    stats = {
      ...state.stats,
      filesScanned: state.stats.totalFiles,
      documentsIndexed: state.stats.totalDocuments,
      vectorsStored: state.stats.totalVectors || 0,
      duration: 0,
      errors: [],
      startTime: new Date(state.lastIndexTime),
      endTime: new Date(state.lastIndexTime),
    };
  } catch {
    // Not indexed yet
    stats = null;
  }

  // Read metadata.json for storage size and git info
  let metadata = null;
  try {
    const metadataContent = await fs.readFile(path.join(storagePath, 'metadata.json'), 'utf-8');
    const meta = JSON.parse(metadataContent);
    metadata = {
      timestamp: meta.indexed?.timestamp || '',
      storageSize: meta.indexed?.size || 0,
      repository: meta.repository || { path: resolvedRepoPath },
    };
  } catch {
    // No metadata
  }

  // Try to load GitHub stats directly from state file
  let githubStats = null;
  try {
    const stateContent = await fs.readFile(filePaths.githubState, 'utf-8');
    const state = JSON.parse(stateContent);
    githubStats = {
      repository: state.repository,
      totalDocuments: state.totalDocuments || 0,
      byType: state.byType || {},
      byState: state.byState || {},
      lastIndexed: state.lastIndexed || '',
      indexDuration: state.indexDuration || 0,
    };
  } catch {
    // GitHub not indexed
  }

  return { stats, metadata, githubStats, repositoryPath: resolvedRepoPath };
}

// Compare command - compare two stat snapshots (defined before createStatsCommand)
const compareCommand = new Command('compare')
  .description('Compare two stat snapshots to see changes over time')
  .argument('<before>', 'Path to "before" stats JSON file')
  .argument('<after>', 'Path to "after" stats JSON file')
  .option('--json', 'Output comparison as JSON', false)
  .action(async (beforePath: string, afterPath: string, _options) => {
    output.warn('Compare command temporarily disabled during refactor');
    output.log(`Would compare ${beforePath} and ${afterPath}`);
  });

// Export command - export stats (defined before createStatsCommand)
const exportCommand = new Command('export')
  .description('Export current statistics')
  .option('-f, --format <format>', 'Output format (json, markdown)', 'json')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (options) => {
    output.warn('Export command temporarily disabled during refactor');
    output.log(`Would export as ${options.format}`);
  });

// Main stats command - show current stats (default action)
function createStatsCommand() {
  const cmd = new Command('stats')
    .description('Show repository indexing statistics')
    .option('--json', 'Output stats as JSON', false)
    .addHelpText(
      'after',
      `
Examples:
  $ dev stats                           Show all repository statistics
  $ dev stats --json                    Export stats as JSON
  $ dev git stats                       Show git history statistics
  $ dev github stats                    Show GitHub index statistics

What You'll See:
  • Total files, components, lines indexed
  • Breakdown by language with percentages
  • Component types (functions, classes, etc.)
  • Package/directory statistics
  • Storage size and performance metrics
`
    )
    .action(async (options) => {
      const spinner = ora('Loading statistics...').start();

      try {
        const {
          stats,
          metadata,
          githubStats,
          repositoryPath: resolvedRepoPath,
        } = await loadCurrentStats();
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
                metadata: metadata || undefined,
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

        // Calculate total components from byLanguage (more accurate than documentsIndexed)
        const totalComponents = stats.byLanguage
          ? Object.values(stats.byLanguage).reduce((sum, lang) => sum + (lang?.components || 0), 0)
          : stats.documentsIndexed;

        // Print enhanced stats with visual bars
        printRepositoryStats({
          repoName,
          stats: {
            totalFiles: stats.filesScanned,
            totalDocuments: totalComponents,
            byLanguage: stats.byLanguage,
            byComponentType: stats.byComponentType,
          },
          metadata: metadata || undefined,
          githubStats:
            (githubStats as {
              repository: string;
              totalDocuments: number;
              byType: { issue?: number; pull_request?: number };
              byState: { open?: number; closed?: number; merged?: number };
              lastIndexed: string;
            } | null) || undefined,
        });
      } catch (error) {
        spinner.fail('Failed to load statistics');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Add subcommands
  cmd.addCommand(compareCommand);
  cmd.addCommand(exportCommand);

  return cmd;
}

export const statsCommand = createStatsCommand();
