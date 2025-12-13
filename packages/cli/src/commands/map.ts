/**
 * Map Command
 * Show codebase structure with component counts and change frequency
 */

import * as path from 'node:path';
import {
  ensureStorageDirectory,
  formatCodebaseMap,
  generateCodebaseMap,
  getStorageFilePaths,
  getStoragePath,
  LocalGitExtractor,
  type MapOptions,
  RepositoryIndexer,
} from '@lytics/dev-agent-core';
import { createLogger } from '@lytics/kero';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { output } from '../utils/output.js';

export const mapCommand = new Command('map')
  .description('Show codebase structure with component counts')
  .option('-d, --depth <number>', 'Directory depth to show (1-5)', '2')
  .option('-f, --focus <path>', 'Focus on a specific directory path')
  .option('--no-exports', 'Hide exported symbols')
  .option('--change-frequency', 'Include git change frequency (hotspots)', false)
  .option('--token-budget <number>', 'Maximum tokens for output', '2000')
  .option('--verbose', 'Enable debug logging', false)
  .addHelpText(
    'after',
    `
Examples:
  $ dev map                           Show structure at depth 2
  $ dev map --depth 3                 Show deeper nesting
  $ dev map --focus packages/core     Focus on specific directory
  $ dev map --change-frequency        Show git activity hotspots

What You'll See:
  📊 Directory structure with component counts
  📦 Classes, functions, interfaces per directory
  🔥 Hot files (with --change-frequency)
  📤 Key exports per directory

Use Case:
  - Understanding codebase organization
  - Finding where code lives
  - Identifying hotspots and frequently changed areas
  - Better than 'ls' or 'tree' for code exploration
`
  )
  .action(async (options) => {
    const startTime = Date.now();

    // Create logger with debug enabled if --verbose
    const mapLogger = createLogger({
      level: options.verbose ? 'debug' : 'info',
      format: 'pretty',
    });

    const spinner = ora('Loading configuration...').start();

    try {
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first to initialize dev-agent');
        process.exit(1);
      }

      const repositoryPath = config.repository?.path || config.repositoryPath || process.cwd();
      const resolvedRepoPath = path.resolve(repositoryPath);

      spinner.text = 'Initializing indexer...';
      const t1 = Date.now();
      mapLogger.info({ repositoryPath: resolvedRepoPath }, 'Loading repository configuration');

      const storagePath = await getStoragePath(resolvedRepoPath);
      await ensureStorageDirectory(storagePath);
      const filePaths = getStorageFilePaths(storagePath);
      mapLogger.debug({ storagePath, filePaths }, 'Storage paths resolved');

      const indexer = new RepositoryIndexer({
        repositoryPath: resolvedRepoPath,
        vectorStorePath: filePaths.vectors,
        statePath: filePaths.indexerState,
      });

      // Skip embedder initialization for read-only map generation (10-20x faster)
      mapLogger.info('Initializing indexer (skipping embedder for fast read-only access)');
      await indexer.initialize({ skipEmbedder: true });
      const t2 = Date.now();
      mapLogger.info({ duration_ms: t2 - t1 }, 'Indexer initialized');
      spinner.text = `Indexer initialized (${t2 - t1}ms). Generating map...`;

      // Check if repository is indexed (use fast basic stats - skips git enrichment)
      mapLogger.debug('Checking if repository is indexed');
      const stats = await indexer.getBasicStats();
      if (!stats || stats.filesScanned === 0) {
        spinner.fail('Repository not indexed');
        logger.error('Run "dev index" first to index your repository');
        await indexer.close();
        process.exit(1);
      }

      mapLogger.info(
        {
          filesScanned: stats.filesScanned,
          documentsIndexed: stats.documentsIndexed,
        },
        'Repository index loaded'
      );

      spinner.text = 'Generating codebase map...';

      // Parse options
      mapLogger.debug(
        { rawDepth: options.depth, rawTokenBudget: options.tokenBudget },
        'Parsing options'
      );
      const depth = Number.parseInt(options.depth, 10);
      if (Number.isNaN(depth) || depth < 1 || depth > 5) {
        spinner.fail('Invalid depth');
        logger.error('Depth must be between 1 and 5');
        await indexer.close();
        process.exit(1);
      }

      const tokenBudget = Number.parseInt(options.tokenBudget, 10);
      if (Number.isNaN(tokenBudget) || tokenBudget < 500) {
        spinner.fail('Invalid token budget');
        logger.error('Token budget must be at least 500');
        await indexer.close();
        process.exit(1);
      }

      // Create git extractor for change frequency if requested
      const gitExtractor = options.changeFrequency
        ? new LocalGitExtractor(resolvedRepoPath)
        : undefined;

      if (options.changeFrequency) {
        mapLogger.info('Git change frequency analysis enabled');
      }

      // Generate map
      const mapOptions: MapOptions = {
        depth,
        focus: options.focus,
        includeExports: options.exports,
        tokenBudget,
        includeChangeFrequency: options.changeFrequency,
      };

      mapLogger.info(
        {
          depth,
          focus: options.focus || '(all)',
          includeExports: options.exports,
          tokenBudget,
          includeChangeFrequency: options.changeFrequency,
        },
        'Starting map generation'
      );

      const t3 = Date.now();
      const map = await generateCodebaseMap(
        {
          indexer,
          gitExtractor,
          logger: mapLogger,
        },
        mapOptions
      );
      const t4 = Date.now();

      mapLogger.success(
        {
          totalDuration_ms: t4 - startTime,
          initDuration_ms: t2 - t1,
          mapDuration_ms: t4 - t3,
          totalComponents: map.totalComponents,
          totalDirectories: map.totalDirectories,
        },
        'Map generation complete'
      );

      spinner.succeed(
        `Map generated in ${t4 - startTime}ms (init: ${t2 - t1}ms, map: ${t4 - t3}ms)`
      );

      // Format and display
      mapLogger.debug('Formatting map output');
      const t5 = Date.now();
      const formatted = formatCodebaseMap(map, {
        includeExports: options.exports,
        includeChangeFrequency: options.changeFrequency,
      });
      const t6 = Date.now();
      mapLogger.debug({ duration_ms: t6 - t5, outputLength: formatted.length }, 'Map formatted');

      output.log('');
      output.log(formatted);
      output.log('');

      // Show summary
      output.log(
        `📊 Total: ${map.totalComponents.toLocaleString()} components across ${map.totalDirectories.toLocaleString()} directories`
      );
      if (map.hotPaths.length > 0) {
        output.log(`🔥 ${map.hotPaths.length} hot paths identified`);
      }
      output.log('');

      mapLogger.info('Closing indexer');
      await indexer.close();
      mapLogger.debug('Indexer closed');
    } catch (error) {
      spinner.fail('Failed to generate map');
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
