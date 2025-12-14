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
import { createIndexLogger, logger } from '../utils/logger.js';
import { output } from '../utils/output.js';
import { ProgressRenderer } from '../utils/progress.js';

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

      // Create logger for updating (verbose mode shows debug logs)
      const indexLogger = createIndexLogger(options.verbose);

      // Stop spinner and switch to section-based progress
      spinner.stop();

      // Initialize progress renderer
      const progressRenderer = new ProgressRenderer({ verbose: options.verbose });
      progressRenderer.setSections(['Scanning Changed Files', 'Embedding Vectors']);

      const startTime = Date.now();
      const scanStartTime = startTime;
      let embeddingStartTime = 0;
      let inEmbeddingPhase = false;

      const stats = await indexer.update({
        logger: indexLogger,
        onProgress: (progress) => {
          if (progress.phase === 'storing' && progress.totalDocuments) {
            // Transitioning to embedding phase
            if (!inEmbeddingPhase) {
              const scanDuration = (Date.now() - scanStartTime) / 1000;
              progressRenderer.completeSection(
                `${progress.totalDocuments.toLocaleString()} components updated`,
                scanDuration
              );
              embeddingStartTime = Date.now();
              inEmbeddingPhase = true;
            }

            // Update embedding progress
            const pct = Math.round((progress.documentsIndexed / progress.totalDocuments) * 100);
            const embeddingElapsed = (Date.now() - embeddingStartTime) / 1000;
            const docsPerSec =
              embeddingElapsed > 0 ? progress.documentsIndexed / embeddingElapsed : 0;
            progressRenderer.updateSection(
              `${progress.documentsIndexed.toLocaleString()}/${progress.totalDocuments.toLocaleString()} documents (${pct}%, ${docsPerSec.toFixed(0)} docs/sec)`
            );
          } else {
            // Scanning phase
            const percent = progress.percentComplete || 0;
            progressRenderer.updateSection(`${percent.toFixed(0)}% complete`);
          }
        },
      });

      // Complete embedding section
      if (inEmbeddingPhase) {
        const embeddingDuration = (Date.now() - embeddingStartTime) / 1000;
        progressRenderer.completeSection(
          `${stats.documentsIndexed.toLocaleString()} documents`,
          embeddingDuration
        );
      } else {
        // If we never entered embedding phase (no changes), complete scanning
        const scanDuration = (Date.now() - scanStartTime) / 1000;
        progressRenderer.completeSection(
          `${stats.filesScanned.toLocaleString()} files checked`,
          scanDuration
        );
      }

      await indexer.close();
      metricsStore.close();

      const duration = (Date.now() - startTime) / 1000;

      // Finalize progress display
      progressRenderer.done();

      // Show completion message
      output.log('');
      if (stats.filesScanned === 0) {
        output.success('No changes detected');
      } else {
        output.success(
          `Updated ${stats.filesScanned.toLocaleString()} files in ${duration.toFixed(1)}s`
        );
      }
      output.log('');

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
