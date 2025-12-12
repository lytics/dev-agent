import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type DetailedIndexStats,
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
  RepositoryIndexer,
} from '@lytics/dev-agent-core';
import { GitHubIndexer } from '@lytics/dev-agent-subagents';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { formatDetailedStats } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

export const statsCommand = new Command('stats')
  .description('Show indexing statistics')
  .option('--json', 'Output stats as JSON', false)
  .action(async (options) => {
    const spinner = ora('Loading statistics...').start();

    try {
      // Load config
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first to initialize dev-agent');
        process.exit(1);
        return; // TypeScript needs this
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

      spinner.stop();

      if (!stats) {
        logger.warn('No indexing statistics available');
        logger.log(`Run ${chalk.yellow('dev index')} to index your repository first`);
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

      // Detect if monorepo (check for package stats)
      const showPackages = !!(stats.byPackage && Object.keys(stats.byPackage).length > 0);

      // Pretty print stats with enhanced formatting
      logger.log('');
      logger.log(formatDetailedStats(stats, resolvedRepoPath, { showPackages }));
      logger.log('');

      // Display GitHub stats if available
      if (githubStats) {
        logger.log('');
        logger.log(chalk.bold.cyan('🔗 GitHub Integration'));
        logger.log('');
        logger.log(`${chalk.cyan('Repository:')}        ${githubStats.repository}`);
        logger.log(`${chalk.cyan('Total Documents:')}   ${githubStats.totalDocuments}`);
        logger.log(`${chalk.cyan('Issues:')}            ${githubStats.byType.issue || 0}`);
        logger.log(`${chalk.cyan('Pull Requests:')}     ${githubStats.byType.pull_request || 0}`);
        logger.log('');
        logger.log(`${chalk.cyan('Open:')}              ${githubStats.byState.open || 0}`);
        logger.log(`${chalk.cyan('Closed:')}            ${githubStats.byState.closed || 0}`);
        if (githubStats.byState.merged) {
          logger.log(`${chalk.cyan('Merged:')}            ${githubStats.byState.merged}`);
        }
        logger.log('');
        logger.log(
          `${chalk.cyan('Last Synced:')}       ${new Date(githubStats.lastIndexed).toLocaleString()}`
        );
      } else {
        logger.log('');
        logger.log(chalk.bold.cyan('🔗 GitHub Integration'));
        logger.log('');
        logger.log(
          chalk.gray('Not indexed. Run') +
            chalk.yellow(' dev gh index ') +
            chalk.gray('to sync GitHub data.')
        );
      }

      logger.log('');
    } catch (error) {
      spinner.fail('Failed to load statistics');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
