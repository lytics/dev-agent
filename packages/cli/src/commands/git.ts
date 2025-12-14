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
import { createIndexLogger, logger } from '../utils/logger.js';
import { output, printGitStats } from '../utils/output.js';
import { ProgressRenderer } from '../utils/progress.js';

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
      .option(
        '--limit <number>',
        'Maximum commits to index (default: 500)',
        (val) => Number.parseInt(val, 10),
        500
      )
      .option(
        '--since <date>',
        'Only index commits after this date (e.g., "2024-01-01", "6 months ago")'
      )
      .option('-v, --verbose', 'Verbose output', false)
      .action(async (options) => {
        const spinner = ora('Initializing git indexer...').start();

        // Create logger for indexing
        const indexLogger = createIndexLogger(options.verbose);

        try {
          const { indexer, vectorStore } = await createGitIndexer();

          // Stop spinner and switch to section-based progress
          spinner.stop();

          // Initialize progress renderer
          const progressRenderer = new ProgressRenderer({ verbose: options.verbose });
          progressRenderer.setSections(['Extracting Commits', 'Embedding Commits']);

          const startTime = Date.now();
          const extractStartTime = startTime;
          let embeddingStartTime = 0;
          let inEmbeddingPhase = false;

          const stats = await indexer.index({
            limit: options.limit,
            since: options.since,
            logger: indexLogger,
            onProgress: (progress) => {
              if (progress.phase === 'storing' && progress.totalCommits > 0) {
                // Transitioning to embedding phase
                if (!inEmbeddingPhase) {
                  const extractDuration = (Date.now() - extractStartTime) / 1000;
                  progressRenderer.completeSection(
                    `${progress.totalCommits.toLocaleString()} commits extracted`,
                    extractDuration
                  );
                  embeddingStartTime = Date.now();
                  inEmbeddingPhase = true;
                }

                // Update embedding progress
                progressRenderer.updateSectionWithRate(
                  progress.commitsProcessed,
                  progress.totalCommits,
                  'commits',
                  embeddingStartTime
                );
              }
            },
          });

          // Complete embedding section
          if (inEmbeddingPhase) {
            const embeddingDuration = (Date.now() - embeddingStartTime) / 1000;
            progressRenderer.completeSection(
              `${stats.commitsIndexed.toLocaleString()} commits`,
              embeddingDuration
            );
          }

          const totalDuration = (Date.now() - startTime) / 1000;

          // Finalize progress display
          progressRenderer.done();

          // Display success message
          output.log('');
          output.success(`Git history indexed successfully!`);
          output.log(
            `  ${chalk.bold('Indexed:')} ${stats.commitsIndexed.toLocaleString()} commits`
          );
          output.log(`  ${chalk.bold('Duration:')} ${totalDuration.toFixed(1)}s`);
          output.log('');
          output.log(chalk.dim('💡 Next step:'));
          output.log(
            `   ${chalk.cyan('dev git search "<query>"')}  ${chalk.dim('Search commit history')}`
          );
          output.log('');

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
      .option('--limit <number>', 'Number of results', (val) => Number.parseInt(val, 10), 10)
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
          output.log();
          output.log(chalk.yellow('Git history not indexed'));
          output.log();
          output.log(`Run ${chalk.cyan('dev git index')} to index commits`);
          output.log();
          await vectorStore.close();
          return;
        }

        // Print clean stats output
        printGitStats({
          totalCommits,
          // Date range would require additional query - defer for now
        });

        await vectorStore.close();
      } catch (error) {
        spinner.fail('Failed to get stats');
        logger.error((error as Error).message);
        process.exit(1);
      }
    })
  );
