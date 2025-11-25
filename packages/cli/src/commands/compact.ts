import { RepositoryIndexer } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export const compactCommand = new Command('compact')
  .description('🗜️  Optimize and compact the vector store')
  .option('-v, --verbose', 'Show detailed optimization information', false)
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      // Load config
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first to initialize the repository');
        process.exit(1);
        return;
      }

      spinner.text = 'Initializing indexer...';
      const indexer = new RepositoryIndexer(config);
      await indexer.initialize();

      // Get stats before optimization
      const statsBefore = await indexer.getStats();
      if (!statsBefore) {
        spinner.fail('No index found');
        logger.error('Run "dev index" first to index the repository');
        await indexer.close();
        process.exit(1);
        return;
      }

      spinner.text = 'Optimizing vector store...';
      const startTime = Date.now();

      // Access the internal vector storage and call optimize
      // We need to access the private vectorStorage property
      // @ts-expect-error - accessing private property for optimization
      await indexer.vectorStorage.optimize();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Get stats after optimization
      const statsAfter = await indexer.getStats();

      await indexer.close();

      spinner.succeed(chalk.green('Vector store optimized successfully!'));

      // Show results
      logger.log('');
      logger.log(chalk.bold('Optimization Results:'));
      logger.log(`  ${chalk.cyan('Duration:')}        ${duration}s`);
      logger.log(`  ${chalk.cyan('Total documents:')} ${statsAfter?.vectorsStored || 0}`);

      if (options.verbose) {
        logger.log('');
        logger.log(chalk.bold('Before Optimization:'));
        logger.log(`  ${chalk.cyan('Storage size:')} ${statsBefore.vectorsStored} vectors`);
        logger.log('');
        logger.log(chalk.bold('After Optimization:'));
        logger.log(`  ${chalk.cyan('Storage size:')} ${statsAfter?.vectorsStored || 0} vectors`);
      }

      logger.log('');
      logger.log(
        chalk.gray(
          'Optimization merges small data fragments, updates indices, and improves query performance.'
        )
      );
    } catch (error) {
      spinner.fail('Failed to optimize vector store');
      logger.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });
