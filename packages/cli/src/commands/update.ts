import * as path from 'node:path';
import {
  AsyncEventBus,
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
  type IndexUpdatedEvent,
  MetricsStore,
  RepositoryIndexer,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { formatUpdateSummary, output } from '../utils/output.js';

export const updateCommand = new Command('update')
  .description('Update index with changed files')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (options) => {
    const spinner = ora('Checking for changes...').start();

    try {
      // Load config
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first to initialize dev-agent');
        process.exit(1);
        return; // TypeScript needs this
      }

      // Resolve repository path
      const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
      const resolvedRepoPath = path.resolve(repositoryPath);

      // Get centralized storage paths
      const storagePath = await getStoragePath(resolvedRepoPath);
      await ensureStorageDirectory(storagePath);
      const filePaths = getStorageFilePaths(storagePath);

      spinner.text = 'Initializing indexer...';

      // Create event bus for metrics (no logger in CLI to keep it simple)
      const eventBus = new AsyncEventBus();

      // Initialize metrics store (no logger in CLI to avoid noise)
      const metricsDbPath = path.join(storagePath, 'metrics.db');
      const metricsStore = new MetricsStore(metricsDbPath);

      // Subscribe to index.updated events for automatic metrics persistence
      eventBus.on<IndexUpdatedEvent>('index.updated', async (event) => {
        try {
          const snapshotId = metricsStore.recordSnapshot(
            event.stats,
            event.isIncremental ? 'update' : 'index'
          );

          // Store code metadata if available
          if (event.codeMetadata && event.codeMetadata.length > 0) {
            metricsStore.appendCodeMetadata(snapshotId, event.codeMetadata);
          }
        } catch (error) {
          // Log error but don't fail update - metrics are non-critical
          logger.error(
            `Failed to record metrics: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      });

      const indexer = new RepositoryIndexer(
        {
          repositoryPath: resolvedRepoPath,
          vectorStorePath: filePaths.vectors,
          statePath: filePaths.indexerState,
          excludePatterns: config.repository?.excludePatterns || config.excludePatterns,
          languages: config.repository?.languages || config.languages,
        },
        eventBus
      );

      await indexer.initialize();

      spinner.text = 'Detecting changed files...';

      const startTime = Date.now();
      let lastUpdate = startTime;

      const stats = await indexer.update({
        onProgress: (progress) => {
          const now = Date.now();
          if (now - lastUpdate > 100) {
            const percent = progress.percentComplete || 0;
            const currentFile = progress.currentFile ? ` ${progress.currentFile}` : '';
            spinner.text = `${progress.phase}:${currentFile} (${percent.toFixed(0)}%)`;
            lastUpdate = now;
          }
        },
      });

      await indexer.close();
      metricsStore.close();

      const duration = (Date.now() - startTime) / 1000;

      spinner.stop();

      // Compact output
      output.log('');
      output.log(
        formatUpdateSummary({
          filesUpdated: stats.filesScanned,
          documentsReindexed: stats.documentsIndexed,
          duration: Number.parseFloat(duration.toFixed(2)),
        })
      );

      // Show errors if any
      if (stats.errors.length > 0) {
        output.log('');
        output.warn(`${stats.errors.length} error(s) occurred during update`);
        if (options.verbose) {
          for (const error of stats.errors) {
            output.log(`  ${chalk.gray(error.file)}: ${error.message}`);
          }
        } else {
          output.log(
            `  ${chalk.gray('Run with')} ${chalk.cyan('--verbose')} ${chalk.gray('to see details')}`
          );
        }
      }

      output.log('');
    } catch (error) {
      spinner.fail('Failed to update index');
      logger.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });
