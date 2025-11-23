#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { cleanCommand } from './commands/clean.js';
import { exploreCommand } from './commands/explore.js';
import { indexCommand } from './commands/index.js';
import { initCommand } from './commands/init.js';
import { planCommand } from './commands/plan.js';
import { searchCommand } from './commands/search.js';
import { statsCommand } from './commands/stats.js';
import { updateCommand } from './commands/update.js';

const program = new Command();

program
  .name('dev')
  .description(chalk.cyan('🤖 Dev-Agent - Multi-agent code intelligence platform'))
  .version('0.1.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(indexCommand);
program.addCommand(searchCommand);
program.addCommand(exploreCommand);
program.addCommand(planCommand);
program.addCommand(updateCommand);
program.addCommand(statsCommand);
program.addCommand(cleanCommand);

// Show help if no command provided
if (process.argv.length === 2) {
  program.outputHelp();
}

program.parse(process.argv);
