import * as path from 'node:path';
import { RepositoryIndexer } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export const searchCommand = new Command('search')
  .description('Search indexed code semantically')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .option('-t, --threshold <number>', 'Minimum similarity score (0-1)', '0.7')
  .option('--json', 'Output results as JSON', false)
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

      spinner.text = 'Initializing indexer...';
      const indexer = new RepositoryIndexer(config);
      await indexer.initialize();

      spinner.text = `Searching for: ${chalk.cyan(query)}`;

      const results = await indexer.search(query, {
        limit: Number.parseInt(options.limit, 10),
        scoreThreshold: Number.parseFloat(options.threshold),
      });

      await indexer.close();

      spinner.succeed(chalk.green(`Found ${results.length} result(s)`));

      if (results.length === 0) {
        logger.log('');
        logger.warn('No results found. Try:');
        logger.log(`  - Lowering the threshold: ${chalk.yellow('--threshold 0.5')}`);
        logger.log(`  - Using different keywords`);
        logger.log(`  - Running ${chalk.yellow('dev update')} to refresh the index`);
        return;
      }

      // Output as JSON if requested
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Pretty print results
      logger.log('');
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const metadata = result.metadata;
        const score = (result.score * 100).toFixed(1);

        // Extract file info
        const file = metadata.file as string;
        const relativePath = path.relative(config.repositoryPath, file);
        const startLine = metadata.startLine as number;
        const endLine = metadata.endLine as number;
        const name = metadata.name as string;
        const type = metadata.type as string;

        logger.log(
          chalk.bold(`${i + 1}. ${chalk.cyan(name || type)} ${chalk.gray(`(${score}% match)`)}`)
        );
        logger.log(`   ${chalk.gray('File:')} ${relativePath}:${startLine}-${endLine}`);

        // Show signature if available
        if (metadata.signature) {
          logger.log(`   ${chalk.gray('Signature:')} ${chalk.yellow(metadata.signature)}`);
        }

        // Show docstring if available
        if (metadata.docstring) {
          const doc = String(metadata.docstring);
          const truncated = doc.length > 80 ? `${doc.substring(0, 77)}...` : doc;
          logger.log(`   ${chalk.gray('Doc:')} ${truncated}`);
        }

        logger.log('');
      }
    } catch (error) {
      spinner.fail('Search failed');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
