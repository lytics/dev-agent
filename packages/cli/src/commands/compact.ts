import * as path from 'node:path';
import {
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
  RepositoryIndexer,
} from '@lytics/dev-agent-core';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { printCompactResults } from '../utils/output.js';

export const compactCommand = new Command('compact')
  .description('🗜️  Optimize and compact the vector store')
  .option('-v, --verbose', 'Show detailed optimization information', false)
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      // Load config
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first to initialize the repository');
        process.exit(1);
        return;
      }

      // Resolve repository path
      const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
      const resolvedRepoPath = path.resolve(repositoryPath);

      // Get centralized storage paths
      const storagePath = await getStoragePath(resolvedRepoPath);
      await ensureStorageDirectory(storagePath);
      const filePaths = getStorageFilePaths(storagePath);

      spinner.text = 'Initializing indexer...';
      const indexer = new RepositoryIndexer({
        repositoryPath: resolvedRepoPath,
        vectorStorePath: filePaths.vectors,
        statePath: filePaths.indexerState,
        excludePatterns: config.repository?.excludePatterns || config.excludePatterns,
        languages: config.repository?.languages || config.languages,
      });

      await indexer.initialize();

      // Get stats before optimization
      const statsBefore = await indexer.getStats();
      if (!statsBefore) {
        spinner.fail('No index found');
        logger.error('Run "dev index" first to index the repository');
        await indexer.close();
        process.exit(1);
        return;
      }

      spinner.text = 'Optimizing vector store...';
      const startTime = Date.now();

      // Access the internal vector storage and call optimize
      // We need to access the private vectorStorage property
      // @ts-expect-error - accessing private property for optimization
      await indexer.vectorStorage.optimize();

      const duration = (Date.now() - startTime) / 1000;

      // Get stats after optimization
      const statsAfter = await indexer.getStats();

      await indexer.close();

      spinner.succeed('Vector store optimized');

      // Show results using new formatter
      printCompactResults({
        duration,
        before: {
          vectors: statsBefore.vectorsStored,
        },
        after: {
          vectors: statsAfter?.vectorsStored || 0,
        },
      });
    } catch (error) {
      spinner.fail('Failed to optimize vector store');
      logger.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });
