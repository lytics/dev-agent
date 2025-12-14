import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
// Storage size calculation moved to on-demand in `dev stats` command
import { createIndexLogger, logger } from '../utils/logger.js';
import { output } from '../utils/output.js';
import { formatFinalSummary, ProgressRenderer } from '../utils/progress.js';

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
      const resolvedRepoPath = resolve(repositoryPath);

      // Check prerequisites upfront
      const isGitRepo = isGitRepository(resolvedRepoPath);
      const hasGhCli = isCommandAvailable('gh');
      const ghAuthenticated = hasGhCli && isGhAuthenticated();

      // Determine what we can index
      const canIndexGit = isGitRepo && options.git !== false;
      const canIndexGitHub = isGitRepo && hasGhCli && ghAuthenticated && options.github !== false;

      // Show what will be indexed (clean output without timestamps)
      spinner.stop();
      console.log('');
      console.log(chalk.bold('Indexing Plan:'));
      console.log(`  ${chalk.green('✓')} Code (always)`);
      if (canIndexGit) {
        console.log(`  ${chalk.green('✓')} Git history`);
      } else if (options.git === false) {
        console.log(`  ${chalk.gray('○')} Git history (skipped via --no-git)`);
      } else {
        console.log(`  ${chalk.yellow('○')} Git history (not a git repository)`);
      }
      if (canIndexGitHub) {
        console.log(`  ${chalk.green('✓')} GitHub issues/PRs`);
      } else if (options.github === false) {
        console.log(`  ${chalk.gray('○')} GitHub (skipped via --no-github)`);
      } else if (!isGitRepo) {
        console.log(`  ${chalk.yellow('○')} GitHub (not a git repository)`);
      } else if (!hasGhCli) {
        console.log(`  ${chalk.yellow('○')} GitHub (gh CLI not installed)`);
      } else {
        console.log(`  ${chalk.yellow('○')} GitHub (gh not authenticated - run "gh auth login")`);
      }
      console.log('');

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

      // Create logger for indexing (verbose mode shows debug logs)
      const indexLogger = createIndexLogger(options.verbose);

      // Stop spinner and switch to section-based progress (unless verbose)
      spinner.stop();

      // Initialize progress renderer
      const progressRenderer = new ProgressRenderer({ verbose: options.verbose });
      const sections: string[] = ['Scanning Repository', 'Embedding Vectors'];
      if (canIndexGit) sections.push('Git History');
      if (canIndexGitHub) sections.push('GitHub Issues/PRs');
      progressRenderer.setSections(sections);

      const startTime = Date.now();
      const scanStartTime = startTime;
      let embeddingStartTime = 0;
      let inEmbeddingPhase = false;

      const stats = await indexer.index({
        force: options.force,
        logger: indexLogger,
        onProgress: (progress) => {
          if (progress.phase === 'storing' && progress.totalDocuments) {
            // Transitioning to embedding phase
            if (!inEmbeddingPhase) {
              // Complete scanning section and move to embedding
              const scanDuration = (Date.now() - scanStartTime) / 1000;
              progressRenderer.completeSection(
                `${progress.totalDocuments.toLocaleString()} components extracted`,
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
        // If we never entered embedding phase (edge case), complete scanning
        const scanDuration = (Date.now() - scanStartTime) / 1000;
        progressRenderer.completeSection(
          `${stats.filesScanned.toLocaleString()} files → ${stats.documentsIndexed.toLocaleString()} components`,
          scanDuration
        );
      }

      // Finalize indexing (silent - no UI update needed)
      await indexer.close();
      metricsStore.close();

      // Update metadata with indexing stats (storage size calculated on-demand)
      await updateIndexedStats(storagePath, {
        files: stats.filesScanned,
        components: stats.documentsIndexed,
        size: 0, // Calculated on-demand in `dev stats`
      });

      // Index git history if available
      let gitStats = { commitsIndexed: 0, durationMs: 0 };
      if (canIndexGit) {
        const gitStartTime = Date.now();
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
              progressRenderer.updateSection(
                `${progress.commitsProcessed}/${progress.totalCommits} commits (${pct}%)`
              );
            }
          },
        });
        await gitVectorStore.close();

        const gitDuration = (Date.now() - gitStartTime) / 1000;
        progressRenderer.completeSection(
          `${gitStats.commitsIndexed.toLocaleString()} commits`,
          gitDuration
        );
      }

      // Index GitHub issues/PRs if available
      let ghStats = { totalDocuments: 0, indexDuration: 0 };
      if (canIndexGitHub) {
        const ghStartTime = Date.now();
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
              progressRenderer.updateSection('Fetching issues/PRs...');
            } else if (progress.phase === 'embedding') {
              const pct = Math.round((progress.documentsProcessed / progress.totalDocuments) * 100);
              progressRenderer.updateSection(
                `${progress.documentsProcessed}/${progress.totalDocuments} documents (${pct}%)`
              );
            }
          },
        });

        const ghDuration = (Date.now() - ghStartTime) / 1000;
        progressRenderer.completeSection(
          `${ghStats.totalDocuments.toLocaleString()} documents`,
          ghDuration
        );
      }

      const totalDuration = (Date.now() - startTime) / 1000;

      // Finalize progress display
      progressRenderer.done();

      // Show final summary with next steps
      output.log(
        formatFinalSummary({
          code: {
            files: stats.filesScanned,
            documents: stats.documentsIndexed,
          },
          git: canIndexGit ? { commits: gitStats.commitsIndexed } : undefined,
          github: canIndexGitHub ? { documents: ghStats.totalDocuments } : undefined,
          totalDuration,
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
