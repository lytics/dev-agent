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
import { logger } from '../utils/logger.js';
import {
  formatCompactSummary,
  formatComponentTypes,
  formatDetailedLanguageTable,
  formatGitHubSummary,
  formatLanguageBreakdown,
  output,
} from '../utils/output.js';

export const statsCommand = new Command('stats')
  .description('Show indexing statistics')
  .option('--json', 'Output stats as JSON', false)
  .option('-v, --verbose', 'Show detailed breakdown with tables', false)
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
      if (githubStats) {
        output.log(formatGitHubSummary(githubStats));
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
