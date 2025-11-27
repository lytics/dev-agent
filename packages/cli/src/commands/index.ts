import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ensureStorageDirectory,
  GitIndexer,
  getStorageFilePaths,
  getStoragePath,
  LocalGitExtractor,
  RepositoryIndexer,
  updateIndexedStats,
  VectorStorage,
} from '@lytics/dev-agent-core';
import { GitHubIndexer } from '@lytics/dev-agent-subagents';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { getDefaultConfig, loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

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
      const indexer = new RepositoryIndexer({
        repositoryPath: resolvedRepoPath,
        vectorStorePath: filePaths.vectors,
        statePath: filePaths.indexerState,
        excludePatterns: config.repository?.excludePatterns || config.excludePatterns,
        languages: config.repository?.languages || config.languages,
        embeddingModel: config.embeddingModel,
        embeddingDimension: config.dimension,
      });

      await indexer.initialize();

      spinner.text = 'Scanning repository...';

      const startTime = Date.now();
      let lastUpdate = startTime;

      const stats = await indexer.index({
        force: options.force,
        onProgress: (progress) => {
          const now = Date.now();
          // Update spinner every 100ms to avoid flickering
          if (now - lastUpdate > 100) {
            const percent = progress.percentComplete || 0;
            const currentFile = progress.currentFile ? ` ${progress.currentFile}` : '';
            spinner.text = `${progress.phase}:${currentFile} (${percent.toFixed(0)}%)`;
            lastUpdate = now;
          }
        },
      });

      // Update metadata with indexing stats
      await updateIndexedStats(storagePath, {
        files: stats.filesScanned,
        components: stats.documentsIndexed,
        size: 0, // TODO: Calculate actual size
      });

      await indexer.close();

      const codeDuration = ((Date.now() - startTime) / 1000).toFixed(2);

      spinner.succeed(chalk.green('Code indexed successfully!'));

      // Show code stats
      logger.log('');
      logger.log(chalk.bold('Code Indexing:'));
      logger.log(`  ${chalk.cyan('Files scanned:')}      ${stats.filesScanned}`);
      logger.log(`  ${chalk.cyan('Documents extracted:')} ${stats.documentsExtracted}`);
      logger.log(`  ${chalk.cyan('Documents indexed:')}   ${stats.documentsIndexed}`);
      logger.log(`  ${chalk.cyan('Vectors stored:')}      ${stats.vectorsStored}`);
      logger.log(`  ${chalk.cyan('Duration:')}            ${codeDuration}s`);

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

        gitStats = await gitIndexer.index({ limit: options.gitLimit });
        await gitVectorStore.close();

        spinner.succeed(chalk.green('Git history indexed!'));
        logger.log('');
        logger.log(chalk.bold('Git History:'));
        logger.log(`  ${chalk.cyan('Commits indexed:')}    ${gitStats.commitsIndexed}`);
        logger.log(
          `  ${chalk.cyan('Duration:')}            ${(gitStats.durationMs / 1000).toFixed(2)}s`
        );
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

        ghStats = await ghIndexer.index({});
        spinner.succeed(chalk.green('GitHub indexed!'));
        logger.log('');
        logger.log(chalk.bold('GitHub:'));
        logger.log(`  ${chalk.cyan('Issues/PRs indexed:')} ${ghStats.totalDocuments}`);
        logger.log(
          `  ${chalk.cyan('Duration:')}            ${(ghStats.indexDuration / 1000).toFixed(2)}s`
        );
      }

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

      logger.log('');
      logger.log(chalk.bold('Summary:'));
      logger.log(`  ${chalk.cyan('Total duration:')}     ${totalDuration}s`);
      logger.log(`  ${chalk.cyan('Storage:')}            ${storagePath}`);

      if (stats.errors.length > 0) {
        logger.log('');
        logger.warn(`${stats.errors.length} error(s) occurred during indexing`);
        if (options.verbose) {
          for (const error of stats.errors) {
            logger.error(`  ${error.file}: ${error.message}`);
          }
        }
      }

      logger.log('');
      logger.log(`Now you can search with: ${chalk.yellow('dev search "<query>"')}`);
    } catch (error) {
      spinner.fail('Failed to index repository');
      logger.error(error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });
