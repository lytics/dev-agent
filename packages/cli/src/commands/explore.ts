import * as path from 'node:path';
import {
  ensureStorageDirectory,
  getStorageFilePaths,
  getStoragePath,
  RepositoryIndexer,
} from '@lytics/dev-agent-core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const explore = new Command('explore').description('🔍 Explore and analyze code patterns');

// Pattern search subcommand
explore
  .command('pattern')
  .description('Search for code patterns using semantic search')
  .argument('<query>', 'Pattern to search for')
  .option('-l, --limit <number>', 'Number of results', '10')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.7')
  .action(async (query: string, options) => {
    const spinner = ora('Searching for patterns...').start();

    try {
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first');
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

      const indexer = new RepositoryIndexer({
        repositoryPath: resolvedRepoPath,
        vectorStorePath: filePaths.vectors,
        statePath: filePaths.indexerState,
        excludePatterns: config.repository?.excludePatterns || config.excludePatterns,
        languages: config.repository?.languages || config.languages,
      });

      await indexer.initialize();

      spinner.text = `Searching: "${query}"`;
      const results = await indexer.search(query, {
        limit: Number.parseInt(options.limit, 10),
        scoreThreshold: Number.parseFloat(options.threshold),
      });

      spinner.succeed(`Found ${results.length} results`);

      if (results.length === 0) {
        logger.warn('No patterns found');
        await indexer.close();
        return;
      }

      console.log(chalk.cyan(`\n📊 Pattern Results for: "${query}"\n`));

      for (const [i, result] of results.entries()) {
        const meta = result.metadata as {
          path: string;
          name?: string;
          type: string;
          startLine?: number;
        };

        console.log(chalk.white(`${i + 1}. ${meta.name || meta.type}`));
        console.log(chalk.gray(`   ${meta.path}${meta.startLine ? `:${meta.startLine}` : ''}`));
        console.log(chalk.green(`   ${(result.score * 100).toFixed(1)}% match\n`));
      }

      await indexer.close();
    } catch (error) {
      spinner.fail('Pattern search failed');
      logger.error((error as Error).message);
      process.exit(1);
    }
  });

// Similar code subcommand
explore
  .command('similar')
  .description('Find code similar to a file')
  .argument('<file>', 'File path')
  .option('-l, --limit <number>', 'Number of results', '5')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.5')
  .action(async (file: string, options) => {
    const spinner = ora('Finding similar code...').start();

    try {
      const config = await loadConfig();
      if (!config) {
        spinner.fail('No config found');
        logger.error('Run "dev init" first');
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

      // Prepare file for search (read content, resolve paths)
      spinner.text = 'Reading file content...';
      const { prepareFileForSearch } = await import('../utils/file.js');

      let fileInfo: Awaited<ReturnType<typeof prepareFileForSearch>>;
      try {
        fileInfo = await prepareFileForSearch(resolvedRepoPath, file);
      } catch (error) {
        spinner.fail((error as Error).message);
        process.exit(1);
        return;
      }

      const indexer = new RepositoryIndexer({
        repositoryPath: resolvedRepoPath,
        vectorStorePath: filePaths.vectors,
        statePath: filePaths.indexerState,
        excludePatterns: config.repository?.excludePatterns || config.excludePatterns,
        languages: config.repository?.languages || config.languages,
      });

      await indexer.initialize();

      // Search using file content, not filename
      spinner.text = 'Searching for similar code...';
      const results = await indexer.search(fileInfo.content, {
        limit: Number.parseInt(options.limit, 10) + 1,
        scoreThreshold: Number.parseFloat(options.threshold),
      });

      // Filter out the file itself (exact path match)
      const similar = results
        .filter((r) => {
          const meta = r.metadata as { path: string };
          return meta.path !== fileInfo.relativePath;
        })
        .slice(0, Number.parseInt(options.limit, 10));

      spinner.succeed(`Found ${similar.length} similar files`);

      if (similar.length === 0) {
        logger.warn('No similar code found');
        await indexer.close();
        return;
      }

      console.log(chalk.cyan(`\n🔍 Similar Code to: ${file}\n`));

      for (const [i, result] of similar.entries()) {
        const meta = result.metadata as {
          path: string;
          name?: string;
          type: string;
          startLine?: number;
        };

        console.log(chalk.white(`${i + 1}. ${meta.name || meta.type}`));
        console.log(chalk.gray(`   ${meta.path}${meta.startLine ? `:${meta.startLine}` : ''}`));
        console.log(chalk.green(`   ${(result.score * 100).toFixed(1)}% similar\n`));
      }

      await indexer.close();
    } catch (error) {
      spinner.fail('Similar code search failed');
      logger.error((error as Error).message);
      process.exit(1);
    }
  });

export { explore as exploreCommand };
