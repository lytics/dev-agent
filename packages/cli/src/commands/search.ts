import * as path from 'node:path';
import {
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
  RepositoryIndexer,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { formatSearchResults, output } from '../utils/output.js';

export const searchCommand = new Command('search')
  .description('Search indexed code semantically')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .option('-t, --threshold <number>', 'Minimum similarity score (0-1)', '0.7')
  .option('--json', 'Output results as JSON', false)
  .option('-v, --verbose', 'Show detailed results with signatures and docs', false)
  .action(async (query: string, options) => {
    const spinner = ora('Searching...').start();

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

      spinner.text = 'Initializing indexer...';
      const indexer = new RepositoryIndexer({
        repositoryPath: resolvedRepoPath,
        vectorStorePath: filePaths.vectors,
        statePath: filePaths.indexerState,
        excludePatterns: config.repository?.excludePatterns || config.excludePatterns,
        languages: config.repository?.languages || config.languages,
      });

      await indexer.initialize();

      spinner.text = `Searching for: ${chalk.cyan(query)}`;

      const results = await indexer.search(query, {
        limit: Number.parseInt(options.limit, 10),
        scoreThreshold: Number.parseFloat(options.threshold),
      });

      await indexer.close();

      spinner.stop();

      if (results.length === 0) {
        output.log('');
        output.warn('No results found. Try:');
        output.log(`  • Lower threshold: ${chalk.cyan('--threshold 0.5')}`);
        output.log(`  • Different keywords`);
        output.log(`  • Refresh index: ${chalk.cyan('dev update')}`);
        output.log('');
        return;
      }

      // Output as JSON if requested
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Pretty print results (compact or verbose)
      output.log('');
      output.success(`Found ${results.length} result(s)`);
      output.log('');
      output.log(formatSearchResults(results, resolvedRepoPath, { verbose: options.verbose }));
      output.log('');
    } catch (error) {
      spinner.fail('Search failed');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
