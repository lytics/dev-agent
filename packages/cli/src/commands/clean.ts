import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { formatBytes, getDirectorySize } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { output, printCleanSuccess, printCleanSummary } from '../utils/output.js';

export const cleanCommand = new Command('clean')
  .description('Clean indexed data and cache')
  .option('-f, --force', 'Skip confirmation prompt', false)
  .action(async (options) => {
    try {
      // Load config
      const config = await loadConfig();
      if (!config) {
        logger.warn('No config found');
        logger.log('Nothing to clean.');
        return;
      }

      // Resolve repository path
      const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
      const resolvedRepoPath = path.resolve(repositoryPath);

      // Get centralized storage paths
      const storagePath = await getStoragePath(resolvedRepoPath);
      await ensureStorageDirectory(storagePath);
      const filePaths = getStorageFilePaths(storagePath);

      // Calculate sizes of files to be deleted
      const files = await Promise.all(
        [
          { name: 'Vector store', path: filePaths.vectors },
          { name: 'Indexer state', path: filePaths.indexerState },
          { name: 'GitHub state', path: filePaths.githubState },
          { name: 'Metadata', path: filePaths.metadata },
        ].map(async (file) => {
          try {
            const stat = await fs.stat(file.path);
            const size = stat.isDirectory() ? await getDirectorySize(file.path) : stat.size;
            return { ...file, size };
          } catch {
            return { ...file, size: null };
          }
        })
      );

      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

      // Show what will be deleted
      printCleanSummary({
        files,
        totalSize,
        force: options.force,
      });

      // Confirm unless --force
      if (!options.force) {
        process.exit(0);
      }

      const spinner = ora('Cleaning indexed data...').start();

      // Delete storage directory (contains all index files)
      try {
        await fs.rm(storagePath, { recursive: true, force: true });
        spinner.succeed('Cleaned successfully');

        printCleanSuccess({ totalSize });
      } catch (error) {
        spinner.fail('Failed to clean');
        output.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to clean: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
