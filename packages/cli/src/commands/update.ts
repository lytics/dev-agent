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

export const updateCommand = new Command('update')
  .description('Update index with changed files')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (options) => {
    const spinner = ora('Checking for changes...').start();

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

      spinner.text = 'Detecting changed files...';

      const startTime = Date.now();
      let lastUpdate = startTime;

      const stats = await indexer.update({
        onProgress: (progress) => {
          const now = Date.now();
          if (now - lastUpdate > 100) {
            const percent = progress.percentComplete || 0;
            const currentFile = progress.currentFile ? ` ${progress.currentFile}` : '';
            spinner.text = `${progress.phase}:${currentFile} (${percent.toFixed(0)}%)`;
            lastUpdate = now;
          }
        },
      });

      await indexer.close();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (stats.filesScanned === 0) {
        spinner.succeed(chalk.green('Index is up to date!'));
        logger.log('');
        logger.log('No changes detected since last index.');
      } else {
        spinner.succeed(chalk.green('Index updated successfully!'));

        // Show stats
        logger.log('');
        logger.log(chalk.bold('Update Statistics:'));
        logger.log(`  ${chalk.cyan('Files updated:')}      ${stats.filesScanned}`);
        logger.log(`  ${chalk.cyan('Documents re-indexed:')} ${stats.documentsIndexed}`);
        logger.log(`  ${chalk.cyan('Duration:')}            ${duration}s`);

        if (stats.errors.length > 0) {
          logger.log('');
          logger.warn(`${stats.errors.length} error(s) occurred during update`);
          if (options.verbose) {
            for (const error of stats.errors) {
              logger.error(`  ${error.file}: ${error.message}`);
            }
          }
        }
      }

      logger.log('');
    } catch (error) {
      spinner.fail('Failed to update index');
      logger.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });
