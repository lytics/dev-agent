import * as fs from 'node:fs/promises';
import * as path from 'node:path';
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

      const dataDir = path.dirname(config.vectorStorePath);
      const stateFile = path.join(config.repositoryPath, '.dev-agent', 'indexer-state.json');

      // Show what will be deleted
      logger.log('');
      logger.log(chalk.bold('The following will be deleted:'));
      logger.log(`  ${chalk.cyan('Vector store:')} ${config.vectorStorePath}`);
      logger.log(`  ${chalk.cyan('State file:')}   ${stateFile}`);
      logger.log(`  ${chalk.cyan('Data directory:')} ${dataDir}`);
      logger.log('');

      // Confirm unless --force
      if (!options.force) {
        logger.warn('This action cannot be undone!');
        logger.log(`Run with ${chalk.yellow('--force')} to skip this prompt.`);
        logger.log('');
        process.exit(0);
      }

      const spinner = ora('Cleaning indexed data...').start();

      // Delete vector store
      try {
        await fs.rm(config.vectorStorePath, { recursive: true, force: true });
        spinner.text = 'Deleted vector store';
      } catch (error) {
        logger.debug(`Vector store not found or already deleted: ${error}`);
      }

      // Delete state file
      try {
        await fs.rm(stateFile, { force: true });
        spinner.text = 'Deleted state file';
      } catch (error) {
        logger.debug(`State file not found or already deleted: ${error}`);
      }

      // Delete data directory if empty
      try {
        const files = await fs.readdir(dataDir);
        if (files.length === 0) {
          await fs.rmdir(dataDir);
          spinner.text = 'Deleted data directory';
        }
      } catch (error) {
        logger.debug(`Data directory not found or not empty: ${error}`);
      }

      spinner.succeed(chalk.green('Cleaned successfully!'));

      logger.log('');
      logger.log('All indexed data has been removed.');
      logger.log(`Run ${chalk.yellow('dev index')} to re-index your repository.`);
      logger.log('');
    } catch (error) {
      logger.error(`Failed to clean: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
