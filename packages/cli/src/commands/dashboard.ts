/**
 * Dashboard command - alias for enhanced stats
 */

import { Command } from 'commander';

/**
 * Dashboard command is an alias for stats with enhanced formatting
 * Implemented as a simple alias that imports and re-exports stats functionality
 */
export const dashboardCommand = new Command('dashboard')
  .description('Display interactive repository dashboard')
  .summary('Show enhanced repository statistics and insights')
  .option('--json', 'Output stats as JSON', false)
  .action(async (options) => {
    // Import stats command action dynamically to avoid circular dependency
    const { statsCommand } = await import('./stats.js');
    // Execute stats command with the same options
    await statsCommand.parseAsync(['node', 'dev', 'stats', ...(options.json ? ['--json'] : [])]);
  });
