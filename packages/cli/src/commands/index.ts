import { RepositoryIndexer } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { getDefaultConfig, loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export const indexCommand = new Command('index')
  .description('Index a repository for semantic search')
  .argument('[path]', 'Repository path to index', process.cwd())
  .option('-f, --force', 'Force re-index even if unchanged', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (repositoryPath: string, options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      // Load config or use defaults
      let config = await loadConfig();
      if (!config) {
        spinner.info('No config found, using defaults');
        config = getDefaultConfig(repositoryPath);
      }

      // Override with command line args
      config.repositoryPath = repositoryPath;

      spinner.text = 'Initializing indexer...';
      const indexer = new RepositoryIndexer(config);
      await indexer.initialize();

      spinner.text = 'Scanning repository...';

      const startTime = Date.now();
      let lastUpdate = startTime;

      const stats = await indexer.index({
        force: options.force,
        onProgress: (progress) => {
          const now = Date.now();
          // Update spinner every 100ms to avoid flickering
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

      spinner.succeed(chalk.green('Repository indexed successfully!'));

      // Show stats
      logger.log('');
      logger.log(chalk.bold('Indexing Statistics:'));
      logger.log(`  ${chalk.cyan('Files scanned:')}      ${stats.filesScanned}`);
      logger.log(`  ${chalk.cyan('Documents extracted:')} ${stats.documentsExtracted}`);
      logger.log(`  ${chalk.cyan('Documents indexed:')}   ${stats.documentsIndexed}`);
      logger.log(`  ${chalk.cyan('Vectors stored:')}      ${stats.vectorsStored}`);
      logger.log(`  ${chalk.cyan('Duration:')}            ${duration}s`);

      if (stats.errors.length > 0) {
        logger.log('');
        logger.warn(`${stats.errors.length} error(s) occurred during indexing`);
        if (options.verbose) {
          for (const error of stats.errors) {
            logger.error(`  ${error.file}: ${error.message}`);
          }
        }
      }

      logger.log('');
      logger.log(`Now you can search with: ${chalk.yellow('dev search "<query>"')}`);
    } catch (error) {
      spinner.fail('Failed to index repository');
      logger.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });
