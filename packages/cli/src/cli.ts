#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { activityCommand } from './commands/activity.js';
import { cleanCommand } from './commands/clean.js';
import { compactCommand } from './commands/compact.js';
import { dashboardCommand } from './commands/dashboard.js';
import { exploreCommand } from './commands/explore.js';
import { gitCommand } from './commands/git.js';
import { githubCommand } from './commands/github.js';
import { indexCommand } from './commands/index.js';
import { initCommand } from './commands/init.js';
import { mapCommand } from './commands/map.js';
import { mcpCommand } from './commands/mcp.js';
import { ownersCommand } from './commands/owners.js';
import { planCommand } from './commands/plan.js';
import { searchCommand } from './commands/search.js';
import { statsCommand } from './commands/stats.js';
import { storageCommand } from './commands/storage.js';
import { updateCommand } from './commands/update.js';

// Injected at build time by tsup define
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev';

const program = new Command();

program
  .name('dev')
  .description(chalk.cyan('🤖 Dev-Agent - Multi-agent code intelligence platform'))
  .version(VERSION);

// Register commands
program.addCommand(initCommand);
program.addCommand(indexCommand);
program.addCommand(searchCommand);
program.addCommand(exploreCommand);
program.addCommand(planCommand);
program.addCommand(githubCommand);
program.addCommand(gitCommand);
program.addCommand(mapCommand);
program.addCommand(updateCommand);
program.addCommand(statsCommand);
program.addCommand(ownersCommand);
program.addCommand(activityCommand);
program.addCommand(dashboardCommand);
program.addCommand(compactCommand);
program.addCommand(cleanCommand);
program.addCommand(storageCommand);
program.addCommand(mcpCommand);

// Show help if no command provided
if (process.argv.length === 2) {
  program.outputHelp();
}

program.parse(process.argv);
