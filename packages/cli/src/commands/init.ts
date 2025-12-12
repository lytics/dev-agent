import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { getDefaultConfig, saveConfig } from '../utils/config.js';
import { output } from '../utils/output.js';

export const initCommand = new Command('init')
  .description('Initialize dev-agent in the current directory')
  .option('-p, --path <path>', 'Repository path', process.cwd())
  .action(async (options) => {
    const spinner = ora('Initializing dev-agent...').start();

    try {
      const config = getDefaultConfig(options.path);

      spinner.text = 'Creating configuration file...';
      await saveConfig(config, options.path);

      spinner.stop();

      // Clean output without timestamps
      output.log('');
      output.success('Initialized dev-agent');
      output.log('');
      output.log(chalk.bold('Next steps:'));
      output.log(`  ${chalk.cyan('1.')} Run ${chalk.cyan('dev index')} to index your repository`);
      output.log(
        `  ${chalk.cyan('2.')} Run ${chalk.cyan('dev search "<query>"')} to search your code`
      );
      output.log('');
      output.log(`   ${chalk.gray('Config saved:')} ${chalk.cyan('.dev-agent.json')}`);
      output.log('');
    } catch (error) {
      spinner.fail('Failed to initialize dev-agent');
      output.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
