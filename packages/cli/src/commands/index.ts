import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  AsyncEventBus,
  ensureStorageDirectory,
  GitIndexer,
  getStorageFilePaths,
  getStoragePath,
  type IndexUpdatedEvent,
  LocalGitExtractor,
  MetricsStore,
  RepositoryIndexer,
  updateIndexedStats,
  VectorStorage,
} from '@lytics/dev-agent-core';
import { GitHubIndexer } from '@lytics/dev-agent-subagents';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { getDefaultConfig, loadConfig } from '../utils/config.js';
import { formatBytes, getDirectorySize } from '../utils/file.js';
import { createIndexLogger, logger } from '../utils/logger.js';
import { formatIndexSummary, output } from '../utils/output.js';

/**
 * Check if a command is available
 */
function isCommandAvailable(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if directory is a git repository
 */
function isGitRepository(path: string): boolean {
  return existsSync(join(path, '.git'));
}

/**
 * Check if gh CLI is authenticated
 */
function isGhAuthenticated(): boolean {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export const indexCommand = new Command('index')
  .description('Index a repository (code, git history, GitHub issues/PRs)')
  .argument('[path]', 'Repository path to index', process.cwd())
  .option('-f, --force', 'Force re-index even if unchanged', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('--no-git', 'Skip git history indexing')
  .option('--no-github', 'Skip GitHub issues/PRs indexing')
  .option('--git-limit <number>', 'Max git commits to index (default: 500)', Number.parseInt, 500)
  .option('--gh-limit <number>', 'Max GitHub issues/PRs to fetch (default: 500)', Number.parseInt)
  .action(async (repositoryPath: string, options) => {
    const spinner = ora('Checking prerequisites...').start();

    try {
      const resolvedRepoPath = repositoryPath;

      // Check prerequisites upfront
      const isGitRepo = isGitRepository(resolvedRepoPath);
      const hasGhCli = isCommandAvailable('gh');
      const ghAuthenticated = hasGhCli && isGhAuthenticated();

      // Determine what we can index
      const canIndexGit = isGitRepo && options.git !== false;
      const canIndexGitHub = isGitRepo && hasGhCli && ghAuthenticated && options.github !== false;

      // Show what will be indexed
      spinner.stop();
      logger.log('');
      logger.log(chalk.bold('Indexing plan:'));
      logger.log(`  ${chalk.green('✓')} Code (always)`);
      if (canIndexGit) {
        logger.log(`  ${chalk.green('✓')} Git history`);
      } else if (options.git === false) {
        logger.log(`  ${chalk.gray('○')} Git history (skipped via --no-git)`);
      } else {
        logger.log(`  ${chalk.yellow('○')} Git history (not a git repository)`);
      }
      if (canIndexGitHub) {
        logger.log(`  ${chalk.green('✓')} GitHub issues/PRs`);
      } else if (options.github === false) {
        logger.log(`  ${chalk.gray('○')} GitHub (skipped via --no-github)`);
      } else if (!isGitRepo) {
        logger.log(`  ${chalk.yellow('○')} GitHub (not a git repository)`);
      } else if (!hasGhCli) {
        logger.log(`  ${chalk.yellow('○')} GitHub (gh CLI not installed)`);
      } else {
        logger.log(`  ${chalk.yellow('○')} GitHub (gh not authenticated - run "gh auth login")`);
      }
      logger.log('');

      spinner.start('Loading configuration...');

      // Load config or use defaults
      let config = await loadConfig();
      if (!config) {
        spinner.info('No config found, using defaults');
        config = getDefaultConfig(repositoryPath);
      }

      // Get centralized storage path
      spinner.text = 'Resolving storage path...';
      const storagePath = await getStoragePath(resolvedRepoPath);
      await ensureStorageDirectory(storagePath);
      const filePaths = getStorageFilePaths(storagePath);

      spinner.text = 'Initializing indexer...';

      // Create event bus for metrics (no logger in CLI to keep it simple)
      const eventBus = new AsyncEventBus();

      // Initialize metrics store (no logger in CLI to avoid noise)
      const metricsDbPath = join(storagePath, 'metrics.db');
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
          // Log error but don't fail indexing - metrics are non-critical
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
          embeddingModel: config.embeddingModel,
          embeddingDimension: config.dimension,
        },
        eventBus
      );

      await indexer.initialize();

      spinner.text = 'Scanning repository...';

      // Create logger for indexing (verbose mode shows debug logs)
      const indexLogger = createIndexLogger(options.verbose);

      const startTime = Date.now();
      let lastUpdate = startTime;

      const stats = await indexer.index({
        force: options.force,
        logger: indexLogger,
        onProgress: (progress) => {
          const now = Date.now();
          // Update spinner every 100ms to avoid flickering
          if (now - lastUpdate > 100) {
            if (progress.phase === 'storing' && progress.totalDocuments) {
              // Show document count with percentage
              const pct = Math.round((progress.documentsIndexed / progress.totalDocuments) * 100);
              spinner.text = `Embedding ${progress.documentsIndexed}/${progress.totalDocuments} documents (${pct}%)`;
            } else {
              const percent = progress.percentComplete || 0;
              spinner.text = `${progress.phase} (${percent.toFixed(0)}%)`;
            }
            lastUpdate = now;
          }
        },
      });

      // Update metadata with indexing stats (calculate actual storage size)
      const storageSize = await getDirectorySize(storagePath);
      await updateIndexedStats(storagePath, {
        files: stats.filesScanned,
        components: stats.documentsIndexed,
        size: storageSize,
      });

      await indexer.close();
      metricsStore.close();

      const codeDuration = (Date.now() - startTime) / 1000;

      spinner.succeed(chalk.green('Code indexed successfully!'));

      // Index git history if available
      let gitStats = { commitsIndexed: 0, durationMs: 0 };
      if (canIndexGit) {
        spinner.start('Indexing git history...');
        const gitVectorPath = `${filePaths.vectors}-git`;
        const gitExtractor = new LocalGitExtractor(resolvedRepoPath);
        const gitVectorStore = new VectorStorage({ storePath: gitVectorPath });
        await gitVectorStore.initialize();

        const gitIndexer = new GitIndexer({
          extractor: gitExtractor,
          vectorStorage: gitVectorStore,
        });

        gitStats = await gitIndexer.index({
          limit: options.gitLimit,
          logger: indexLogger,
          onProgress: (progress) => {
            if (progress.phase === 'storing' && progress.totalCommits > 0) {
              const pct = Math.round((progress.commitsProcessed / progress.totalCommits) * 100);
              spinner.text = `Embedding ${progress.commitsProcessed}/${progress.totalCommits} commits (${pct}%)`;
            }
          },
        });
        await gitVectorStore.close();

        spinner.succeed(chalk.green('Git history indexed!'));
      }

      // Index GitHub issues/PRs if available
      let ghStats = { totalDocuments: 0, indexDuration: 0 };
      if (canIndexGitHub) {
        spinner.start('Indexing GitHub issues/PRs...');
        const ghVectorPath = `${filePaths.vectors}-github`;
        const ghIndexer = new GitHubIndexer({
          vectorStorePath: ghVectorPath,
          statePath: filePaths.githubState,
          autoUpdate: false,
        });
        await ghIndexer.initialize();

        ghStats = await ghIndexer.index({
          limit: options.ghLimit,
          logger: indexLogger,
          onProgress: (progress) => {
            if (progress.phase === 'fetching') {
              spinner.text = 'Fetching GitHub issues/PRs...';
            } else if (progress.phase === 'embedding') {
              spinner.text = `Embedding ${progress.documentsProcessed}/${progress.totalDocuments} GitHub docs`;
            }
          },
        });
        spinner.succeed(chalk.green('GitHub indexed!'));
      }

      const totalDuration = (Date.now() - startTime) / 1000;

      // Compact summary output
      output.log('');
      output.log(
        formatIndexSummary({
          code: {
            files: stats.filesScanned,
            documents: stats.documentsIndexed,
            vectors: stats.vectorsStored,
            duration: codeDuration,
            size: formatBytes(storageSize),
          },
          git: canIndexGit
            ? { commits: gitStats.commitsIndexed, duration: gitStats.durationMs / 1000 }
            : undefined,
          github: canIndexGitHub
            ? { documents: ghStats.totalDocuments, duration: ghStats.indexDuration / 1000 }
            : undefined,
          total: {
            duration: totalDuration,
            storage: storagePath,
          },
        })
      );

      // Show errors if any
      if (stats.errors.length > 0) {
        output.log('');
        output.warn(`${stats.errors.length} error(s) occurred during indexing`);
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
      spinner.fail('Failed to index repository');
      logger.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });
