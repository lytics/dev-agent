/**
 * GitHub Context Commands
 * CLI commands for indexing and searching GitHub data
 */

import { getStorageFilePaths, getStoragePath } from '@lytics/dev-agent-core';
import { GitHubIndexer } from '@lytics/dev-agent-subagents';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { createIndexLogger, logger } from '../utils/logger.js';
import {
  output,
  printGitHubContext,
  printGitHubSearchResults,
  printGitHubStats,
} from '../utils/output.js';
import { ProgressRenderer } from '../utils/progress.js';

/**
 * Create GitHub indexer with centralized storage
 */
async function createGitHubIndexer(): Promise<GitHubIndexer> {
  const repositoryPath = process.cwd();
  const storagePath = await getStoragePath(repositoryPath);
  const { vectors, githubState } = getStorageFilePaths(storagePath);

  // Validate that paths are not undefined or invalid
  if (
    !vectors ||
    vectors.includes('undefined') ||
    !githubState ||
    githubState.includes('undefined')
  ) {
    throw new Error(`Invalid storage paths: vectors=${vectors}, githubState=${githubState}`);
  }

  const vectorStorePath = `${vectors}-github`;

  // Additional validation for the GitHub vector storage path
  if (vectorStorePath.includes('undefined')) {
    throw new Error(`Invalid GitHub vector storage path: ${vectorStorePath}`);
  }

  return new GitHubIndexer({
    vectorStorePath,
    statePath: githubState,
    autoUpdate: true,
    staleThreshold: 15 * 60 * 1000, // 15 minutes
  });
}

export const githubCommand = new Command('github')
  .description('GitHub issues and pull requests')
  .addHelpText(
    'after',
    `
Examples:
  $ dev github index                    Index all issues/PRs for semantic search
  $ dev github search "auth bug"        Find issues by meaning, not keywords
  $ dev github stats                    Show indexing statistics
  $ dev github context 42               Get full details for issue #42

Related:
  dev_gh         MCP tool for AI assistants (same functionality)
`
  )
  .addCommand(
    new Command('index')
      .description('Index GitHub issues and PRs')
      .option('--issues-only', 'Index only issues')
      .option('--prs-only', 'Index only pull requests')
      .option('--state <state>', 'Filter by state (open, closed, merged, all)', 'all')
      .option('--limit <number>', 'Limit number of items to fetch', (val) =>
        Number.parseInt(val, 10)
      )
      .option('-v, --verbose', 'Verbose output', false)
      .action(async (options) => {
        const spinner = ora('Initializing GitHub indexer...').start();

        // Create logger for indexing
        const indexLogger = createIndexLogger(options.verbose);

        try {
          // Create GitHub indexer with centralized vector storage
          const ghIndexer = await createGitHubIndexer();
          await ghIndexer.initialize();

          // Stop spinner and switch to section-based progress
          spinner.stop();

          // Initialize progress renderer
          const progressRenderer = new ProgressRenderer({ verbose: options.verbose });
          progressRenderer.setSections(['Fetching Issues/PRs', 'Embedding Documents']);

          // Determine types to index
          const types = [];
          if (!options.prsOnly) types.push('issue');
          if (!options.issuesOnly) types.push('pull_request');

          // Determine states
          let state: string[] | undefined;
          if (options.state === 'all') {
            state = undefined;
          } else {
            state = [options.state];
          }

          const startTime = Date.now();
          const fetchStartTime = startTime;
          let embeddingStartTime = 0;
          let inEmbeddingPhase = false;

          // Index
          const stats = await ghIndexer.index({
            types: types as ('issue' | 'pull_request')[],
            state: state as ('open' | 'closed' | 'merged')[] | undefined,
            limit: options.limit,
            logger: indexLogger,
            onProgress: (progress) => {
              if (progress.phase === 'fetching') {
                progressRenderer.updateSection('Fetching from GitHub...');
              } else if (progress.phase === 'embedding') {
                // Transitioning to embedding phase
                if (!inEmbeddingPhase) {
                  const fetchDuration = (Date.now() - fetchStartTime) / 1000;
                  progressRenderer.completeSection(
                    `${progress.totalDocuments.toLocaleString()} documents fetched`,
                    fetchDuration
                  );
                  embeddingStartTime = Date.now();
                  inEmbeddingPhase = true;
                }

                // Update embedding progress
                progressRenderer.updateSectionWithRate(
                  progress.documentsProcessed,
                  progress.totalDocuments,
                  'documents',
                  embeddingStartTime
                );
              }
            },
          });

          // Complete embedding section
          if (inEmbeddingPhase) {
            const embeddingDuration = (Date.now() - embeddingStartTime) / 1000;
            progressRenderer.completeSection(
              `${stats.totalDocuments.toLocaleString()} documents`,
              embeddingDuration
            );
          }

          const totalDuration = (Date.now() - startTime) / 1000;

          // Finalize progress display
          progressRenderer.done();

          // Compact summary
          const issues = stats.byType.issue || 0;
          const prs = stats.byType.pull_request || 0;

          output.log('');
          output.success('GitHub data indexed successfully!');
          output.log(`  ${chalk.bold('Repository:')} ${stats.repository}`);
          output.log(`  ${chalk.bold('Indexed:')} ${issues} issues • ${prs} PRs`);
          output.log(`  ${chalk.bold('Duration:')} ${totalDuration.toFixed(1)}s`);
          output.log('');
          output.log(chalk.dim('💡 Next step:'));
          output.log(
            `   ${chalk.cyan('dev github search "<query>"')}  ${chalk.dim('Search issues/PRs')}`
          );
          output.log('');
        } catch (error) {
          spinner.fail('Indexing failed');
          logger.error((error as Error).message);

          if ((error as Error).message.includes('not installed')) {
            logger.log('');
            logger.log(chalk.yellow('GitHub CLI is required.'));
            logger.log('Install it:');
            logger.log(`  ${chalk.cyan('brew install gh')}          # macOS`);
            logger.log(`  ${chalk.cyan('sudo apt install gh')}      # Linux`);
          }

          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('search')
      .description('Search GitHub issues and PRs (defaults to open issues)')
      .argument('<query>', 'Search query')
      .option('--type <type>', 'Filter by type (default: issue)', 'issue')
      .option('--state <state>', 'Filter by state (default: open)', 'open')
      .option('--author <author>', 'Filter by author')
      .option('--label <labels...>', 'Filter by labels')
      .option('--limit <number>', 'Number of results', (val) => Number.parseInt(val, 10), 10)
      .option('--json', 'Output as JSON')
      .action(async (query, options) => {
        const spinner = ora('Loading configuration...').start();

        try {
          spinner.text = 'Initializing...';

          // Initialize GitHub indexer with centralized storage
          const ghIndexer = await createGitHubIndexer();
          await ghIndexer.initialize();

          // Check if indexed
          if (!ghIndexer.isIndexed()) {
            spinner.warn('GitHub data not indexed');
            logger.log('');
            logger.log(chalk.yellow('Run "dev gh index" first to index GitHub data'));
            process.exit(1);
            return;
          }

          spinner.text = 'Searching...';

          // Search with smart defaults (type: issue, state: open)
          const results = await ghIndexer.search(query, {
            type: options.type as 'issue' | 'pull_request',
            state: options.state as 'open' | 'closed' | 'merged',
            author: options.author,
            labels: options.label,
            limit: options.limit,
          });

          spinner.stop();

          // Output results
          if (options.json) {
            console.log(JSON.stringify(results, null, 2));
            return;
          }

          printGitHubSearchResults(results, query as string);
        } catch (error) {
          spinner.fail('Search failed');
          logger.error((error as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('context')
      .description('Get full context for an issue or PR')
      .option('--issue <number>', 'Issue number', Number.parseInt)
      .option('--pr <number>', 'Pull request number', Number.parseInt)
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        if (!options.issue && !options.pr) {
          logger.error('Provide --issue or --pr');
          process.exit(1);
          return;
        }

        const spinner = ora('Loading configuration...').start();

        try {
          spinner.text = 'Initializing...';

          const ghIndexer = await createGitHubIndexer();
          await ghIndexer.initialize();

          if (!ghIndexer.isIndexed()) {
            spinner.warn('GitHub data not indexed');
            logger.log('');
            logger.log(chalk.yellow('Run "dev gh index" first'));
            process.exit(1);
            return;
          }

          spinner.text = 'Fetching context...';

          const number = options.issue || options.pr;
          const type = options.issue ? 'issue' : 'pull_request';

          const context = await ghIndexer.getContext(number, type);

          if (!context) {
            spinner.fail('Not found');
            logger.error(`${type === 'issue' ? 'Issue' : 'PR'} #${number} not found`);
            process.exit(1);
            return;
          }

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(context, null, 2));
            return;
          }

          // Convert context to printable format
          const doc = context.document;
          printGitHubContext({
            type: doc.type,
            number: doc.number,
            title: doc.title,
            body: doc.body,
            state: doc.state,
            author: doc.author,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            labels: doc.labels,
            url: doc.url,
            comments: doc.comments,
            relatedIssues: context.relatedIssues.map((r) => ({
              number: r.number,
              title: r.title,
              state: r.state,
            })),
            relatedPRs: context.relatedPRs.map((r) => ({
              number: r.number,
              title: r.title,
              state: r.state,
            })),
            linkedFiles: context.linkedCodeFiles.map((f) => ({
              path: f.path,
              score: f.score,
            })),
          });
        } catch (error) {
          spinner.fail('Failed to get context');
          logger.error((error as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('stats').description('Show GitHub indexing statistics').action(async () => {
      const spinner = ora('Loading configuration...').start();

      try {
        spinner.text = 'Initializing...';

        const ghIndexer = await createGitHubIndexer();
        await ghIndexer.initialize();

        const stats = ghIndexer.getStats();

        spinner.stop();

        if (!stats) {
          output.log();
          output.warn('GitHub data not indexed');
          output.log('Run "dev gh index" to index');
          return;
        }

        printGitHubStats(stats);
      } catch (error) {
        spinner.fail('Failed to get stats');
        output.error((error as Error).message);
        process.exit(1);
      }
    })
  );
