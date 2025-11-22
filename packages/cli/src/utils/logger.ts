import chalk from 'chalk';

export const logger = {
  info: (message: string) => {
    console.log(chalk.blue('ℹ'), message);
  },

  success: (message: string) => {
    console.log(chalk.green('✔'), message);
  },

  error: (message: string) => {
    console.log(chalk.red('✖'), message);
  },

  warn: (message: string) => {
    console.log(chalk.yellow('⚠'), message);
  },

  log: (message: string) => {
    console.log(message);
  },

  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🐛'), chalk.gray(message));
    }
  },
};
