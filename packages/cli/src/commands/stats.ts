import { RepositoryIndexer } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
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

      const indexer = new RepositoryIndexer(config);
      await indexer.initialize();

      const stats = await indexer.getStats();
      await indexer.close();

      spinner.stop();

      if (!stats) {
        logger.warn('No indexing statistics available');
        logger.log(`Run ${chalk.yellow('dev index')} to index your repository first`);
        return;
      }

      // Output as JSON if requested
      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      // Pretty print stats
      logger.log('');
      logger.log(chalk.bold.cyan('📊 Indexing Statistics'));
      logger.log('');
      logger.log(`${chalk.cyan('Repository:')}         ${config.repositoryPath}`);
      logger.log(`${chalk.cyan('Vector Store:')}       ${config.vectorStorePath}`);
      logger.log('');
      logger.log(`${chalk.cyan('Files Indexed:')}      ${stats.filesScanned}`);
      logger.log(`${chalk.cyan('Documents Extracted:')} ${stats.documentsExtracted}`);
      logger.log(`${chalk.cyan('Vectors Stored:')}     ${stats.vectorsStored}`);
      logger.log('');

      if (stats.startTime && stats.endTime) {
        const duration = (stats.duration / 1000).toFixed(2);
        logger.log(
          `${chalk.cyan('Last Indexed:')}       ${new Date(stats.startTime).toLocaleString()}`
        );
        logger.log(`${chalk.cyan('Duration:')}           ${duration}s`);
      }

      if (stats.errors && stats.errors.length > 0) {
        logger.log('');
        logger.warn(`${stats.errors.length} error(s) during last indexing`);
      }

      logger.log('');
    } catch (error) {
      spinner.fail('Failed to load statistics');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
