/**
 * GitHub Context Commands
 * CLI commands for indexing and searching GitHub data
 */

import { GitHubIndexer } from '@lytics/dev-agent-subagents';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export const ghCommand = new Command('gh')
  .description('GitHub context commands (index issues/PRs, search, get context)')
  .addCommand(
    new Command('index')
      .description('Index GitHub issues and PRs')
      .option('--issues-only', 'Index only issues')
      .option('--prs-only', 'Index only pull requests')
      .option('--state <state>', 'Filter by state (open, closed, merged, all)', 'all')
      .option('--limit <number>', 'Limit number of items to fetch', Number.parseInt)
      .action(async (options) => {
        const spinner = ora('Loading configuration...').start();

        try {
          const config = await loadConfig();
          if (!config) {
            spinner.fail('No config found');
            logger.error('Run "dev init" first to initialize dev-agent');
            process.exit(1);
            return;
          }

          spinner.text = 'Initializing indexers...';

          // Create GitHub indexer with vector storage
          const ghIndexer = new GitHubIndexer({
            vectorStorePath: config.vectorStorePath + '-github', // Separate storage for GitHub data
            statePath: '.dev-agent/github-state.json',
            autoUpdate: true,
            staleThreshold: 15 * 60 * 1000, // 15 minutes
          });

          await ghIndexer.initialize();

          spinner.text = 'Fetching GitHub data...';

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

          // Index
          const stats = await ghIndexer.index({
            types: types as ('issue' | 'pull_request')[],
            state: state as ('open' | 'closed' | 'merged')[] | undefined,
            limit: options.limit,
          });

          spinner.succeed(chalk.green('GitHub data indexed!'));

          // Display stats
          logger.log('');
          logger.log(chalk.bold('Indexing Stats:'));
          logger.log(`  Repository: ${chalk.cyan(stats.repository)}`);
          logger.log(`  Total: ${chalk.yellow(stats.totalDocuments)} documents`);

          if (stats.byType.issue) {
            logger.log(`  Issues: ${stats.byType.issue}`);
          }
          if (stats.byType.pull_request) {
            logger.log(`  Pull Requests: ${stats.byType.pull_request}`);
          }

          logger.log(`  Duration: ${stats.indexDuration}ms`);
          logger.log('');
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
      .description('Search GitHub issues and PRs')
      .argument('<query>', 'Search query')
      .option('--type <type>', 'Filter by type (issue, pull_request)')
      .option('--state <state>', 'Filter by state (open, closed, merged)')
      .option('--author <author>', 'Filter by author')
      .option('--label <labels...>', 'Filter by labels')
      .option('--limit <number>', 'Number of results', Number.parseInt, 10)
      .option('--json', 'Output as JSON')
      .action(async (query, options) => {
        const spinner = ora('Loading configuration...').start();

        try {
          const config = await loadConfig();
          if (!config) {
            spinner.fail('No config found');
            logger.error('Run "dev init" first to initialize dev-agent');
            process.exit(1);
            return;
          }

          spinner.text = 'Initializing...';

          // Initialize GitHub indexer
          const ghIndexer = new GitHubIndexer({
            vectorStorePath: config.vectorStorePath + '-github',
            statePath: '.dev-agent/github-state.json',
            autoUpdate: true,
            staleThreshold: 15 * 60 * 1000,
          });
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

          // Search
          const results = await ghIndexer.search(query, {
            type: options.type as 'issue' | 'pull_request' | undefined,
            state: options.state as 'open' | 'closed' | 'merged' | undefined,
            author: options.author,
            labels: options.label,
            limit: options.limit,
          });

          spinner.succeed(chalk.green(`Found ${results.length} results`));

          if (results.length === 0) {
            logger.log('');
            logger.log(chalk.gray('No results found'));
            return;
          }

          // Output results
          if (options.json) {
            console.log(JSON.stringify(results, null, 2));
            return;
          }

          logger.log('');
          for (const result of results) {
            const doc = result.document;
            const typeEmoji = doc.type === 'issue' ? '🐛' : '🔀';
            const stateColor =
              doc.state === 'open'
                ? chalk.green
                : doc.state === 'merged'
                  ? chalk.magenta
                  : chalk.gray;

            logger.log(
              `${typeEmoji} ${chalk.bold(`#${doc.number}`)} ${doc.title} ${stateColor(`[${doc.state}]`)}`
            );
            logger.log(
              `   ${chalk.gray(`Score: ${(result.score * 100).toFixed(0)}%`)} | ${chalk.blue(doc.url)}`
            );

            if (doc.labels.length > 0) {
              logger.log(`   Labels: ${doc.labels.map((l: string) => chalk.cyan(l)).join(', ')}`);
            }

            logger.log('');
          }
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
          const config = await loadConfig();
          if (!config) {
            spinner.fail('No config found');
            logger.error('Run "dev init" first');
            process.exit(1);
            return;
          }

          spinner.text = 'Initializing...';

          const ghIndexer = new GitHubIndexer({
            vectorStorePath: config.vectorStorePath + '-github',
            statePath: '.dev-agent/github-state.json',
            autoUpdate: true,
            staleThreshold: 15 * 60 * 1000,
          });
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

          spinner.succeed(chalk.green('Context retrieved'));

          if (options.json) {
            console.log(JSON.stringify(context, null, 2));
            return;
          }

          const doc = context.document;
          const typeEmoji = doc.type === 'issue' ? '🐛' : '🔀';

          logger.log('');
          logger.log(chalk.bold.cyan(`${typeEmoji} #${doc.number}: ${doc.title}`));
          logger.log('');
          logger.log(chalk.gray(`${doc.body.substring(0, 200)}...`));
          logger.log('');

          if (context.relatedIssues.length > 0) {
            logger.log(chalk.bold('Related Issues:'));
            for (const related of context.relatedIssues) {
              logger.log(`  🐛 #${related.number} ${related.title}`);
            }
            logger.log('');
          }

          if (context.relatedPRs.length > 0) {
            logger.log(chalk.bold('Related PRs:'));
            for (const related of context.relatedPRs) {
              logger.log(`  🔀 #${related.number} ${related.title}`);
            }
            logger.log('');
          }

          if (context.linkedCodeFiles.length > 0) {
            logger.log(chalk.bold('Linked Code Files:'));
            for (const file of context.linkedCodeFiles) {
              const scorePercent = (file.score * 100).toFixed(0);
              logger.log(`  📁 ${file.path} (${scorePercent}% match)`);
            }
            logger.log('');
          }
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
        const config = await loadConfig();
        if (!config) {
          spinner.fail('No config found');
          process.exit(1);
          return;
        }

        const ghIndexer = new GitHubIndexer({
          vectorStorePath: config.vectorStorePath + '-github',
          statePath: '.dev-agent/github-state.json',
          autoUpdate: true,
          staleThreshold: 15 * 60 * 1000,
        });
        await ghIndexer.initialize();

        const stats = ghIndexer.getStats();

        spinner.stop();

        if (!stats) {
          logger.log('');
          logger.log(chalk.yellow('GitHub data not indexed'));
          logger.log('Run "dev gh index" to index');
          return;
        }

        logger.log('');
        logger.log(chalk.bold.cyan('GitHub Indexing Stats'));
        logger.log('');
        logger.log(`Repository: ${chalk.cyan(stats.repository)}`);
        logger.log(`Total Documents: ${chalk.yellow(stats.totalDocuments)}`);
        logger.log('');

        logger.log(chalk.bold('By Type:'));
        if (stats.byType.issue) {
          logger.log(`  Issues: ${stats.byType.issue}`);
        }
        if (stats.byType.pull_request) {
          logger.log(`  Pull Requests: ${stats.byType.pull_request}`);
        }
        logger.log('');

        logger.log(chalk.bold('By State:'));
        if (stats.byState.open) {
          logger.log(`  ${chalk.green('Open')}: ${stats.byState.open}`);
        }
        if (stats.byState.closed) {
          logger.log(`  ${chalk.gray('Closed')}: ${stats.byState.closed}`);
        }
        if (stats.byState.merged) {
          logger.log(`  ${chalk.magenta('Merged')}: ${stats.byState.merged}`);
        }
        logger.log('');

        logger.log(`Last Indexed: ${chalk.gray(stats.lastIndexed)}`);
        logger.log('');
      } catch (error) {
        spinner.fail('Failed to get stats');
        logger.error((error as Error).message);
        process.exit(1);
      }
    })
  );
