/**
 * Plan Command
 * Generate development plan from GitHub issue
 */

import { RepositoryIndexer } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

// Import utilities directly from dist to avoid source dependencies
type Plan = {
  issueNumber: number;
  title: string;
  description: string;
  tasks: Array<{
    id: string;
    description: string;
    relevantCode: Array<{
      path: string;
      reason: string;
      score: number;
    }>;
    estimatedHours?: number;
  }>;
  totalEstimate: string;
  priority: string;
};

export const planCommand = new Command('plan')
  .description('Generate a development plan from a GitHub issue')
  .argument('<issue>', 'GitHub issue number')
  .option('--no-explorer', 'Skip finding relevant code with Explorer')
  .option('--simple', 'Generate high-level plan (4-8 tasks)')
  .option('--json', 'Output as JSON')
  .option('--markdown', 'Output as markdown')
  .action(async (issueArg: string, options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const issueNumber = Number.parseInt(issueArg, 10);
      if (Number.isNaN(issueNumber)) {
        spinner.fail('Invalid issue number');
        logger.error(`Issue number must be a number, got: ${issueArg}`);
        process.exit(1);
        return;
      }

      // Load config
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first to initialize dev-agent');
        process.exit(1);
        return;
      }

      spinner.text = `Fetching issue #${issueNumber}...`;

      // Import utilities dynamically from dist
      const utilsModule = await import('@lytics/dev-agent-subagents');
      const {
        fetchGitHubIssue,
        extractAcceptanceCriteria,
        inferPriority,
        cleanDescription,
        breakdownIssue,
        addEstimatesToTasks,
        calculateTotalEstimate,
      } = utilsModule;

      // Fetch GitHub issue
      const issue = await fetchGitHubIssue(issueNumber);

      // Parse issue content
      const acceptanceCriteria = extractAcceptanceCriteria(issue.body);
      const priority = inferPriority(issue.labels);
      const description = cleanDescription(issue.body);

      spinner.text = 'Breaking down into tasks...';

      // Break down into tasks
      const detailLevel = options.simple ? 'simple' : 'detailed';
      let tasks = breakdownIssue(issue, acceptanceCriteria, {
        detailLevel,
        maxTasks: detailLevel === 'simple' ? 8 : 15,
        includeEstimates: false,
      });

      // Find relevant code if Explorer enabled
      if (options.explorer !== false) {
        spinner.text = 'Finding relevant code...';

        const indexer = new RepositoryIndexer(config);
        await indexer.initialize();

        for (const task of tasks) {
          try {
            const results = await indexer.search(task.description, {
              limit: 3,
              scoreThreshold: 0.6,
            });

            task.relevantCode = results.map((r) => ({
              path: (r.metadata as { path?: string }).path || '',
              reason: 'Similar pattern found',
              score: r.score,
            }));
          } catch {
            // Continue without Explorer context
          }
        }

        await indexer.close();
      }

      // Add effort estimates
      tasks = addEstimatesToTasks(tasks);
      const totalEstimate = calculateTotalEstimate(tasks);

      spinner.succeed(chalk.green('Plan generated!'));

      const plan: Plan = {
        issueNumber,
        title: issue.title,
        description,
        tasks,
        totalEstimate,
        priority,
      };

      // Output based on format
      if (options.json) {
        console.log(JSON.stringify(plan, null, 2));
        return;
      }

      if (options.markdown) {
        outputMarkdown(plan);
        return;
      }

      // Default: pretty print
      outputPretty(plan);
    } catch (error) {
      spinner.fail('Planning failed');
      logger.error((error as Error).message);

      if ((error as Error).message.includes('not installed')) {
        logger.log('');
        logger.log(chalk.yellow('GitHub CLI is required for planning.'));
        logger.log('Install it:');
        logger.log(`  ${chalk.cyan('brew install gh')}          # macOS`);
        logger.log(`  ${chalk.cyan('sudo apt install gh')}      # Linux`);
        logger.log(`  ${chalk.cyan('https://cli.github.com')}   # Windows`);
      }

      process.exit(1);
    }
  });

/**
 * Output plan in pretty format
 */
function outputPretty(plan: Plan) {
  logger.log('');
  logger.log(chalk.bold.cyan(`📋 Plan for Issue #${plan.issueNumber}: ${plan.title}`));
  logger.log('');

  if (plan.description) {
    logger.log(chalk.gray(`${plan.description.substring(0, 200)}...`));
    logger.log('');
  }

  logger.log(chalk.bold(`Tasks (${plan.tasks.length}):`));
  logger.log('');

  for (const task of plan.tasks) {
    logger.log(chalk.white(`${task.id}. ☐ ${task.description}`));

    if (task.estimatedHours) {
      logger.log(chalk.gray(`   ⏱️  Est: ${task.estimatedHours}h`));
    }

    if (task.relevantCode.length > 0) {
      for (const code of task.relevantCode.slice(0, 2)) {
        const scorePercent = (code.score * 100).toFixed(0);
        logger.log(chalk.gray(`   📁 ${code.path} (${scorePercent}% similar)`));
      }
    }

    logger.log('');
  }

  logger.log(chalk.bold('Summary:'));
  logger.log(`  Priority: ${getPriorityEmoji(plan.priority)} ${plan.priority}`);
  logger.log(`  Estimated: ⏱️  ${plan.totalEstimate}`);
  logger.log('');
}

/**
 * Output plan in markdown format
 */
function outputMarkdown(plan: Plan) {
  console.log(`# Plan: ${plan.title} (#${plan.issueNumber})\n`);

  if (plan.description) {
    console.log(`## Description\n`);
    console.log(`${plan.description}\n`);
  }

  console.log(`## Tasks\n`);

  for (const task of plan.tasks) {
    console.log(`### ${task.id}. ${task.description}\n`);

    if (task.estimatedHours) {
      console.log(`- **Estimate:** ${task.estimatedHours}h`);
    }

    if (task.relevantCode.length > 0) {
      console.log(`- **Relevant Code:**`);
      for (const code of task.relevantCode) {
        const scorePercent = (code.score * 100).toFixed(0);
        console.log(`  - \`${code.path}\` (${scorePercent}% similar)`);
      }
    }

    console.log('');
  }

  console.log(`## Summary\n`);
  console.log(`- **Priority:** ${plan.priority}`);
  console.log(`- **Total Estimate:** ${plan.totalEstimate}\n`);
}

/**
 * Get emoji for priority level
 */
function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}
