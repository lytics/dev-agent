/**
 * Git History Commands
 * CLI commands for indexing and searching git commit history
 */

import {
  GitIndexer,
  getStorageFilePaths,
  getStoragePath,
  LocalGitExtractor,
  VectorStorage,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { logger } from '../utils/logger.js';

/**
 * Create Git indexer with centralized storage
 */
async function createGitIndexer(): Promise<{ indexer: GitIndexer; vectorStore: VectorStorage }> {
  const repositoryPath = process.cwd();
  const storagePath = await getStoragePath(repositoryPath);
  const { vectors } = getStorageFilePaths(storagePath);

  if (!vectors || vectors.includes('undefined')) {
    throw new Error(`Invalid storage path: vectors=${vectors}`);
  }

  const vectorStorePath = `${vectors}-git`;

  const extractor = new LocalGitExtractor(repositoryPath);
  const vectorStore = new VectorStorage({ storePath: vectorStorePath });
  await vectorStore.initialize();

  const indexer = new GitIndexer({
    extractor,
    vectorStorage: vectorStore,
  });

  return { indexer, vectorStore };
}

export const gitCommand = new Command('git')
  .description('Git history commands (index commits, search history)')
  .addCommand(
    new Command('index')
      .description('Index git commit history for semantic search')
      .option('--limit <number>', 'Maximum commits to index (default: 500)', Number.parseInt, 500)
      .option(
        '--since <date>',
        'Only index commits after this date (e.g., "2024-01-01", "6 months ago")'
      )
      .action(async (options) => {
        const spinner = ora('Loading configuration...').start();

        try {
          spinner.text = 'Initializing git indexer...';

          const { indexer, vectorStore } = await createGitIndexer();

          spinner.text = 'Indexing git commits...';

          const stats = await indexer.index({
            limit: options.limit,
            since: options.since,
          });

          spinner.succeed(chalk.green('Git history indexed!'));

          // Display stats
          logger.log('');
          logger.log(chalk.bold('Indexing Stats:'));
          logger.log(`  Commits indexed: ${chalk.yellow(stats.commitsIndexed)}`);
          logger.log(`  Duration: ${chalk.cyan(stats.durationMs)}ms`);
          logger.log('');
          logger.log(chalk.gray('Now you can search with: dev git search "<query>"'));
          logger.log('');

          await vectorStore.close();
        } catch (error) {
          spinner.fail('Indexing failed');
          logger.error((error as Error).message);

          if ((error as Error).message.includes('not a git repository')) {
            logger.log('');
            logger.log(chalk.yellow('This directory is not a git repository.'));
            logger.log('Run this command from a git repository root.');
          }

          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('search')
      .description('Semantic search over git commit messages')
      .argument('<query>', 'Search query (e.g., "authentication bug fix")')
      .option('--limit <number>', 'Number of results', Number.parseInt, 10)
      .option('--json', 'Output as JSON')
      .action(async (query, options) => {
        const spinner = ora('Loading configuration...').start();

        try {
          spinner.text = 'Initializing...';

          const { indexer, vectorStore } = await createGitIndexer();

          spinner.text = 'Searching commits...';

          const results = await indexer.search(query, {
            limit: options.limit,
          });

          spinner.succeed(chalk.green(`Found ${results.length} commits`));

          if (results.length === 0) {
            logger.log('');
            logger.log(chalk.yellow('No commits found.'));
            logger.log(chalk.gray('Make sure you have indexed git history: dev git index'));
            await vectorStore.close();
            return;
          }

          // Output results
          if (options.json) {
            console.log(JSON.stringify(results, null, 2));
            await vectorStore.close();
            return;
          }

          logger.log('');
          for (const commit of results) {
            logger.log(`${chalk.yellow(commit.shortHash)} ${chalk.bold(commit.subject)}`);
            logger.log(
              `   ${chalk.gray(`${commit.author.name}`)} | ${chalk.gray(new Date(commit.author.date).toLocaleDateString())}`
            );

            if (commit.refs.issueRefs && commit.refs.issueRefs.length > 0) {
              logger.log(`   ${chalk.cyan(`Refs: ${commit.refs.issueRefs.join(', ')}`)}`);
            }

            logger.log('');
          }

          await vectorStore.close();
        } catch (error) {
          spinner.fail('Search failed');
          logger.error((error as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('stats').description('Show git indexing statistics').action(async () => {
      const spinner = ora('Loading configuration...').start();

      try {
        spinner.text = 'Initializing...';

        const { indexer, vectorStore } = await createGitIndexer();

        const totalCommits = await indexer.getIndexedCommitCount();

        spinner.stop();

        if (totalCommits === 0) {
          logger.log('');
          logger.log(chalk.yellow('Git history not indexed'));
          logger.log('Run "dev git index" to index commits');
          await vectorStore.close();
          return;
        }

        logger.log('');
        logger.log(chalk.bold.cyan('Git History Stats'));
        logger.log('');
        logger.log(`Total Commits Indexed: ${chalk.yellow(totalCommits)}`);
        logger.log('');

        await vectorStore.close();
      } catch (error) {
        spinner.fail('Failed to get stats');
        logger.error((error as Error).message);
        process.exit(1);
      }
    })
  );
