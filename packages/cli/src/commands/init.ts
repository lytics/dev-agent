import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { getDefaultConfig, saveConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export const initCommand = new Command('init')
  .description('Initialize dev-agent in the current directory')
  .option('-p, --path <path>', 'Repository path', process.cwd())
  .action(async (options) => {
    const spinner = ora('Initializing dev-agent...').start();

    try {
      const config = getDefaultConfig(options.path);

      spinner.text = 'Creating configuration file...';
      await saveConfig(config, options.path);

      spinner.succeed(chalk.green('Dev-agent initialized successfully!'));

      logger.log('');
      logger.log(chalk.bold('Next steps:'));
      logger.log(`  ${chalk.cyan('1.')} Run ${chalk.yellow('dev index')} to index your repository`);
      logger.log(
        `  ${chalk.cyan('2.')} Run ${chalk.yellow('dev search "<query>"')} to search your code`
      );
      logger.log('');
      logger.log(`Configuration saved to ${chalk.cyan('.dev-agent.json')}`);
    } catch (error) {
      spinner.fail('Failed to initialize dev-agent');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
