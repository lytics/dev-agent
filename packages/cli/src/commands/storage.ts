/**
 * Storage Management Commands
 * Commands for managing centralized storage
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
  loadMetadata,
  saveMetadata,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

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
 * Calculate directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return stats.size;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let size = 0;

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        size += stat.size;
      }
    }

    return size;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
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
        logger.log(`Run with ${chalk.yellow('--force')} to skip this prompt.`);
        logger.log('');
        process.exit(0);
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

      logger.log('');
      logger.log(chalk.bold('💾 Storage Information'));
      logger.log('');
      logger.log(`  ${chalk.cyan('Storage Location:')} ${storagePath}`);
      logger.log(
        `  ${chalk.cyan('Status:')}           ${storageExists ? chalk.green('Active') : chalk.gray('Not initialized')}`
      );

      if (storageExists) {
        logger.log(`  ${chalk.cyan('Total Size:')}        ${formatBytes(totalSize)}`);
        logger.log('');

        // Show individual files
        logger.log(chalk.bold('📁 Index Files:'));
        logger.log('');

        const files = [
          { name: 'Vector Store', path: filePaths.vectors },
          { name: 'Indexer State', path: filePaths.indexerState },
          { name: 'GitHub State', path: filePaths.githubState },
          { name: 'Metadata', path: filePaths.metadata },
        ];

        for (const file of files) {
          try {
            const stat = await fs.stat(file.path);
            const size = stat.isDirectory() ? await getDirectorySize(file.path) : stat.size;
            const exists = chalk.green('✓');
            logger.log(`  ${exists} ${chalk.cyan(`${file.name}:`)}     ${formatBytes(size)}`);
            logger.log(`    ${chalk.gray(file.path)}`);
          } catch {
            const missing = chalk.gray('○');
            logger.log(
              `  ${missing} ${chalk.gray(`${file.name}:`)}     ${chalk.gray('Not found')}`
            );
          }
        }

        // Load and show metadata if available
        try {
          const metadata = await loadMetadata(storagePath);
          if (metadata) {
            logger.log('');
            logger.log(chalk.bold('📋 Repository Metadata:'));
            logger.log('');
            if (metadata.repository?.remote) {
              logger.log(`  ${chalk.cyan('Remote:')}          ${metadata.repository.remote}`);
            }
            if (metadata.repository?.branch) {
              logger.log(`  ${chalk.cyan('Branch:')}          ${metadata.repository.branch}`);
            }
            if (metadata.indexed) {
              logger.log(
                `  ${chalk.cyan('Last Indexed:')}    ${new Date(metadata.indexed.timestamp).toLocaleString()}`
              );
              logger.log(`  ${chalk.cyan('Files Indexed:')}   ${metadata.indexed.files}`);
              logger.log(`  ${chalk.cyan('Components:')}      ${metadata.indexed.components}`);
            }
          }
        } catch {
          // Metadata not available
        }
      } else {
        logger.log('');
        logger.log(chalk.gray('No indexes found. Run "dev index" to create indexes.'));
      }

      logger.log('');
    } catch (error) {
      spinner.fail('Failed to load storage information');
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

export { storageCommand };
