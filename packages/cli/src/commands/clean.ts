import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export const cleanCommand = new Command('clean')
  .description('Clean indexed data and cache')
  .option('-f, --force', 'Skip confirmation prompt', false)
  .action(async (options) => {
    try {
      // Load config
      const config = await loadConfig();
      if (!config) {
        logger.warn('No config found');
        logger.log('Nothing to clean.');
        return;
      }

      // Resolve repository path
      const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
      const resolvedRepoPath = path.resolve(repositoryPath);

      // Get centralized storage paths
      const storagePath = await getStoragePath(resolvedRepoPath);
      await ensureStorageDirectory(storagePath);
      const filePaths = getStorageFilePaths(storagePath);

      // Show what will be deleted
      logger.log('');
      logger.log(chalk.bold('The following will be deleted:'));
      logger.log(`  ${chalk.cyan('Storage directory:')} ${storagePath}`);
      logger.log(`  ${chalk.cyan('Vector store:')}     ${filePaths.vectors}`);
      logger.log(`  ${chalk.cyan('State file:')}       ${filePaths.indexerState}`);
      logger.log(`  ${chalk.cyan('GitHub state:')}      ${filePaths.githubState}`);
      logger.log(`  ${chalk.cyan('Metadata:')}         ${filePaths.metadata}`);
      logger.log('');

      // Confirm unless --force
      if (!options.force) {
        logger.warn('This action cannot be undone!');
        logger.log(`Run with ${chalk.yellow('--force')} to skip this prompt.`);
        logger.log('');
        process.exit(0);
      }

      const spinner = ora('Cleaning indexed data...').start();

      // Delete storage directory (contains all index files)
      try {
        await fs.rm(storagePath, { recursive: true, force: true });
        spinner.succeed(chalk.green('Cleaned successfully!'));
      } catch (error) {
        spinner.fail('Failed to clean');
        logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }

      logger.log('');
      logger.log('All indexed data has been removed.');
      logger.log(`Run ${chalk.yellow('dev index')} to re-index your repository.`);
      logger.log('');
    } catch (error) {
      logger.error(`Failed to clean: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
