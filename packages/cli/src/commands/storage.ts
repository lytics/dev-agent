/**
 * Storage Management Commands
 * Commands for managing centralized storage
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import {
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
  loadMetadata,
  type RepositoryMetadata,
  saveMetadata,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { formatBytes, getDirectorySize } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { printStorageInfo } from '../utils/output.js';

/**
 * Detect existing project-local indexes
 */
async function detectLocalIndexes(repositoryPath: string): Promise<{
  vectors: string | null;
  indexerState: string | null;
  githubState: string | null;
}> {
  const localDevAgentDir = path.join(repositoryPath, '.dev-agent');
  const vectorsPath = path.join(localDevAgentDir, 'vectors.lance');
  const indexerStatePath = path.join(localDevAgentDir, 'indexer-state.json');
  const githubStatePath = path.join(localDevAgentDir, 'github-state.json');

  const result = {
    vectors: null as string | null,
    indexerState: null as string | null,
    githubState: null as string | null,
  };

  try {
    await fs.access(vectorsPath);
    result.vectors = vectorsPath;
  } catch {
    // Not found
  }

  try {
    await fs.access(indexerStatePath);
    result.indexerState = indexerStatePath;
  } catch {
    // Not found
  }

  try {
    await fs.access(githubStatePath);
    result.githubState = githubStatePath;
  } catch {
    // Not found
  }

  return result;
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Storage command group
 */
const storageCommand = new Command('storage').description(
  'Manage centralized storage for repository indexes'
);

/**
 * Migrate command - Move local indexes to centralized storage
 */
storageCommand
  .command('migrate')
  .description('Migrate project-local indexes to centralized storage')
  .option('-f, --force', 'Skip confirmation prompt', false)
  .option('--dry-run', 'Show what would be migrated without actually moving files', false)
  .action(async (options) => {
    const spinner = ora('Detecting local indexes...').start();

    try {
      // Load config
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first to initialize dev-agent');
        process.exit(1);
        return;
      }

      // Resolve repository path
      const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
      const resolvedRepoPath = path.resolve(repositoryPath);

      // Detect local indexes
      const localIndexes = await detectLocalIndexes(resolvedRepoPath);

      // Check if there's anything to migrate
      const hasLocalIndexes =
        localIndexes.vectors || localIndexes.indexerState || localIndexes.githubState;

      if (!hasLocalIndexes) {
        spinner.succeed('No local indexes found to migrate');
        logger.log('');
        logger.log('All indexes are already using centralized storage.');
        return;
      }

      // Get centralized storage path
      const storagePath = await getStoragePath(resolvedRepoPath);
      await ensureStorageDirectory(storagePath);
      const filePaths = getStorageFilePaths(storagePath);

      // Check if centralized storage already exists
      let centralizedExists = false;
      try {
        await fs.access(filePaths.vectors);
        centralizedExists = true;
      } catch {
        // Doesn't exist yet
      }

      spinner.stop();

      // Show what will be migrated
      logger.log('');
      logger.log(chalk.bold('📦 Local Indexes Found:'));
      logger.log('');

      let totalSize = 0;
      const filesToMigrate: Array<{ from: string; to: string; size: number }> = [];

      if (localIndexes.vectors) {
        const size = await getDirectorySize(localIndexes.vectors);
        totalSize += size;
        filesToMigrate.push({
          from: localIndexes.vectors,
          to: filePaths.vectors,
          size,
        });
        logger.log(`  ${chalk.cyan('Vector store:')}     ${localIndexes.vectors}`);
        logger.log(`    ${chalk.gray(`→ ${filePaths.vectors}`)}`);
        logger.log(`    ${chalk.gray(`Size: ${formatBytes(size)}`)}`);
      }

      if (localIndexes.indexerState) {
        const stat = await fs.stat(localIndexes.indexerState);
        totalSize += stat.size;
        filesToMigrate.push({
          from: localIndexes.indexerState,
          to: filePaths.indexerState,
          size: stat.size,
        });
        logger.log(`  ${chalk.cyan('Indexer state:')}    ${localIndexes.indexerState}`);
        logger.log(`    ${chalk.gray(`→ ${filePaths.indexerState}`)}`);
        logger.log(`    ${chalk.gray(`Size: ${formatBytes(stat.size)}`)}`);
      }

      if (localIndexes.githubState) {
        const stat = await fs.stat(localIndexes.githubState);
        totalSize += stat.size;
        filesToMigrate.push({
          from: localIndexes.githubState,
          to: filePaths.githubState,
          size: stat.size,
        });
        logger.log(`  ${chalk.cyan('GitHub state:')}      ${localIndexes.githubState}`);
        logger.log(`    ${chalk.gray(`→ ${filePaths.githubState}`)}`);
        logger.log(`    ${chalk.gray(`Size: ${formatBytes(stat.size)}`)}`);
      }

      logger.log('');
      logger.log(`  ${chalk.bold('Total size:')}        ${formatBytes(totalSize)}`);
      logger.log(`  ${chalk.bold('Storage location:')}  ${storagePath}`);
      logger.log('');

      if (centralizedExists) {
        logger.warn('⚠️  Centralized storage already exists!');
        logger.log('Migration will merge/overwrite existing indexes.');
        logger.log('');
      }

      // Dry run mode
      if (options.dryRun) {
        logger.log(chalk.yellow('🔍 DRY RUN MODE - No files will be moved'));
        logger.log('');
        logger.log('To actually migrate, run without --dry-run flag.');
        return;
      }

      // Confirm unless --force
      if (!options.force) {
        logger.warn('This will move indexes to centralized storage.');
        logger.log('');

        const confirmed = await askConfirmation('Continue with migration?');
        if (!confirmed) {
          logger.log('Migration cancelled.');
          logger.log(`Run with ${chalk.yellow('--force')} to skip this prompt.`);
          return;
        }
      }

      // Perform migration
      spinner.start('Migrating indexes...');

      for (const file of filesToMigrate) {
        try {
          // Ensure target directory exists
          await fs.mkdir(path.dirname(file.to), { recursive: true });

          // Move file/directory
          await fs.rename(file.from, file.to);
          spinner.text = `Migrated ${path.basename(file.from)}`;
        } catch (error) {
          spinner.fail(`Failed to migrate ${path.basename(file.from)}`);
          logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
          // Continue with other files
        }
      }

      // Create/update metadata
      try {
        const existingMetadata = await loadMetadata(storagePath);
        await saveMetadata(storagePath, resolvedRepoPath, {
          ...existingMetadata,
          migrated: {
            timestamp: new Date().toISOString(),
            from: resolvedRepoPath,
          },
        });
      } catch (error) {
        logger.debug(`Failed to update metadata: ${error}`);
      }

      // Clean up empty .dev-agent directory
      try {
        const localDevAgentDir = path.join(resolvedRepoPath, '.dev-agent');
        const entries = await fs.readdir(localDevAgentDir);
        if (entries.length === 0) {
          await fs.rmdir(localDevAgentDir);
        }
      } catch {
        // Ignore errors
      }

      spinner.succeed(chalk.green('Migration completed successfully!'));

      logger.log('');
      logger.log(`✓ Indexes migrated to: ${chalk.cyan(storagePath)}`);
      logger.log(`✓ ${formatBytes(totalSize)} moved to centralized storage`);
      logger.log('');
      logger.log('Local indexes have been moved. Your repository is now clean!');
      logger.log('');
    } catch (error) {
      spinner.fail('Migration failed');
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Info command - Show storage information
 */
storageCommand
  .command('info')
  .description('Show storage information and repository list')
  .action(async () => {
    const spinner = ora('Loading storage information...').start();

    try {
      // Load config
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first to initialize dev-agent');
        process.exit(1);
        return;
      }

      // Resolve repository path
      const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
      const resolvedRepoPath = path.resolve(repositoryPath);

      // Get centralized storage path
      const storagePath = await getStoragePath(resolvedRepoPath);
      const filePaths = getStorageFilePaths(storagePath);

      spinner.stop();

      // Check if storage exists
      let storageExists = false;
      let totalSize = 0;
      try {
        await fs.access(storagePath);
        storageExists = true;
        totalSize = await getDirectorySize(storagePath);
      } catch {
        // Storage doesn't exist yet
      }

      // Collect file information
      const fileList = [
        { name: 'Vector Store', path: filePaths.vectors },
        { name: 'Indexer State', path: filePaths.indexerState },
        { name: 'GitHub State', path: filePaths.githubState },
        { name: 'Metadata', path: filePaths.metadata },
      ];

      const files = await Promise.all(
        fileList.map(async (file) => {
          try {
            const stat = await fs.stat(file.path);
            const size = stat.isDirectory() ? await getDirectorySize(file.path) : stat.size;
            return {
              name: file.name,
              path: file.path,
              size,
              exists: true,
            };
          } catch {
            return {
              name: file.name,
              path: file.path,
              size: null,
              exists: false,
            };
          }
        })
      );

      // Load metadata if available
      let metadata: RepositoryMetadata | null = null;
      try {
        metadata = await loadMetadata(storagePath);
      } catch {
        // Metadata not available
      }

      // Print using new output format
      printStorageInfo({
        storagePath,
        status: storageExists ? 'active' : 'not-initialized',
        totalSize,
        files,
        metadata: metadata || undefined,
      });
    } catch (error) {
      spinner.fail('Failed to load storage information');
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

export { storageCommand };
