/**
 * MCP (Model Context Protocol) Server Commands
 * Provides integration with AI tools like Claude Code, Cursor, etc.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  CoordinatorService,
  type GitHubIndexerFactory,
  GitHubService,
  GitIndexer,
  getStorageFilePaths,
  getStoragePath,
  LocalGitExtractor,
  RepositoryIndexer,
  SearchService,
  StatsService,
  VectorStorage,
} from '@lytics/dev-agent-core';
import {
  ExploreAdapter,
  GitHubAdapter,
  HealthAdapter,
  HistoryAdapter,
  MapAdapter,
  MCPServer,
  PlanAdapter,
  RefsAdapter,
  SearchAdapter,
  StatusAdapter,
} from '@lytics/dev-agent-mcp';
import type { SubagentCoordinator } from '@lytics/dev-agent-subagents';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { addCursorServer, listCursorServers, removeCursorServer } from '../utils/cursor-config';
import { logger } from '../utils/logger';

export const mcpCommand = new Command('mcp')
  .description('MCP (Model Context Protocol) server integration')
  .addCommand(
    new Command('start')
      .description('Start MCP server for current repository')
      .option('-p, --port <port>', 'Port for HTTP transport (if not using stdio)')
      .option('-t, --transport <type>', 'Transport type: stdio (default) or http', 'stdio')
      .option('-v, --verbose', 'Verbose logging', false)
      .action(async (options) => {
        // Smart workspace detection:
        // Priority: WORKSPACE_FOLDER_PATHS (Cursor) > REPOSITORY_PATH (explicit) > cwd (fallback)
        const repositoryPath =
          process.env.WORKSPACE_FOLDER_PATHS || process.env.REPOSITORY_PATH || process.cwd();
        const logLevel = options.verbose ? 'debug' : 'info';

        try {
          // Check if repository is indexed
          const storagePath = await getStoragePath(repositoryPath);
          const { vectors } = getStorageFilePaths(storagePath);

          const vectorsExist = await fs
            .access(vectors)
            .then(() => true)
            .catch(() => false);
          if (!vectorsExist) {
            logger.error(`Repository not indexed. Run: ${chalk.yellow('dev index .')}`);
            process.exit(1);
          }

          // All imports are now at the top of the file

          logger.info(chalk.blue('Starting MCP server...'));
          logger.info(`Repository: ${chalk.cyan(repositoryPath)}`);
          logger.info(`Storage: ${chalk.cyan(storagePath)}`);
          logger.info(`Transport: ${chalk.cyan(options.transport)}`);

          // Initialize repository indexer
          const indexer = new RepositoryIndexer({
            repositoryPath,
            vectorStorePath: vectors,
            statePath: getStorageFilePaths(storagePath).indexerState,
          });

          await indexer.initialize();

          // Create and configure the subagent coordinator using CoordinatorService
          const coordinatorService = new CoordinatorService({
            repositoryPath,
            maxConcurrentTasks: 5,
            defaultMessageTimeout: 30000,
            logLevel: logLevel as 'debug' | 'info' | 'warn' | 'error',
          });
          // Type assertion: CoordinatorService returns a minimal interface
          const coordinator = (await coordinatorService.createCoordinator(
            indexer
          )) as SubagentCoordinator;

          // Create services
          const searchService = new SearchService({ repositoryPath });

          // Create all adapters
          const searchAdapter = new SearchAdapter({
            searchService,
            defaultFormat: 'compact',
            defaultLimit: 10,
          });

          const statsService = new StatsService({ repositoryPath });
          const createGitHubIndexer: GitHubIndexerFactory = async (config) => {
            const { GitHubIndexer } = await import('@lytics/dev-agent-subagents');
            // biome-ignore lint/suspicious/noExplicitAny: Dynamic import requires type coercion
            return new GitHubIndexer(config) as any;
          };

          const githubService = new GitHubService({ repositoryPath }, createGitHubIndexer);

          const statusAdapter = new StatusAdapter({
            statsService,
            githubService,
            repositoryPath,
            vectorStorePath: vectors,
            defaultSection: 'summary',
          });

          const exploreAdapter = new ExploreAdapter({
            repositoryPath,
            repositoryIndexer: indexer,
            defaultLimit: 10,
            defaultThreshold: 0.7,
            defaultFormat: 'compact',
          });

          const githubAdapter = new GitHubAdapter({
            repositoryPath,
            githubService,
            defaultLimit: 10,
            defaultFormat: 'compact',
          });

          const healthAdapter = new HealthAdapter({
            repositoryPath,
            vectorStorePath: vectors,
            githubStatePath: getStorageFilePaths(storagePath).githubState,
          });

          const refsAdapter = new RefsAdapter({
            repositoryIndexer: indexer,
            defaultLimit: 20,
          });

          const mapAdapter = new MapAdapter({
            repositoryIndexer: indexer,
            repositoryPath,
            defaultDepth: 2,
            defaultTokenBudget: 2000,
          });

          // Create git extractor and indexer (needed by plan and history adapters)
          const gitExtractor = new LocalGitExtractor(repositoryPath);
          const gitVectorStorage = new VectorStorage({
            storePath: `${vectors}-git`,
          });
          await gitVectorStorage.initialize();

          const gitIndexer = new GitIndexer({
            extractor: gitExtractor,
            vectorStorage: gitVectorStorage,
          });

          const historyAdapter = new HistoryAdapter({
            gitIndexer,
            gitExtractor,
            defaultLimit: 10,
            defaultTokenBudget: 2000,
          });

          // Update plan adapter to include git indexer
          const planAdapterWithGit = new PlanAdapter({
            repositoryIndexer: indexer,
            gitIndexer,
            repositoryPath,
            defaultFormat: 'compact',
            timeout: 60000,
          });

          // Create MCP server with all 9 adapters
          const server = new MCPServer({
            serverInfo: {
              name: 'dev-agent',
              version: '0.1.0',
            },
            config: {
              repositoryPath,
              logLevel: logLevel as 'debug' | 'info' | 'warn' | 'error',
            },
            transport: options.transport === 'stdio' ? 'stdio' : undefined,
            adapters: [
              searchAdapter,
              statusAdapter,
              planAdapterWithGit,
              exploreAdapter,
              githubAdapter,
              healthAdapter,
              refsAdapter,
              mapAdapter,
              historyAdapter,
            ],
            coordinator,
          });

          // Handle graceful shutdown
          const shutdown = async () => {
            logger.info('Shutting down MCP server...');
            await server.stop();
            await indexer.close();
            await gitVectorStorage.close();
            await githubService.shutdown();
            process.exit(0);
          };

          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);

          // Start server
          await server.start();

          logger.info(chalk.green('MCP server started successfully!'));
          logger.info(
            'Available tools: dev_search, dev_status, dev_plan, dev_explore, dev_gh, dev_health, dev_refs, dev_map, dev_history'
          );

          if (options.transport === 'stdio') {
            logger.info('Server running on stdio transport (for AI tools)');
          } else {
            logger.info(`Server running on http://localhost:${options.port || 3000}`);
          }
        } catch (error) {
          logger.error('Failed to start MCP server');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('install')
      .description('Install dev-agent MCP server in Claude Code or Cursor')
      .option(
        '-r, --repository <path>',
        'Repository path (default: current directory)',
        process.cwd()
      )
      .option('--cursor', 'Install for Cursor IDE instead of Claude Code')
      .action(async (options) => {
        const repositoryPath = path.resolve(options.repository);
        const targetIDE = options.cursor ? 'Cursor' : 'Claude Code';
        const spinner = ora(`Installing dev-agent MCP server in ${targetIDE}...`).start();

        try {
          // Check if repository is indexed
          const storagePath = await getStoragePath(repositoryPath);
          const { vectors } = getStorageFilePaths(storagePath);

          const vectorsExist = await fs
            .access(vectors)
            .then(() => true)
            .catch(() => false);
          if (!vectorsExist) {
            spinner.fail(`Repository not indexed. Run: ${chalk.yellow('dev index .')}`);
            process.exit(1);
          }

          if (options.cursor) {
            // Install for Cursor
            spinner.text = 'Checking Cursor configuration...';
            const result = await addCursorServer(repositoryPath);

            if (result.alreadyExists) {
              spinner.info(chalk.yellow('MCP server already installed in Cursor!'));
              logger.log('');
              logger.log(`Server name: ${chalk.cyan(result.serverName)}`);
              logger.log(`Repository: ${chalk.gray(repositoryPath)}`);
              logger.log('');
              logger.log(`Run ${chalk.cyan('dev mcp list --cursor')} to see all servers`);
            } else {
              spinner.succeed(chalk.green('MCP server installed in Cursor!'));
              logger.log('');
              logger.log(chalk.bold('Integration complete! 🎉'));
              logger.log('');
              logger.log(`Server name: ${chalk.cyan(result.serverName)}`);
              logger.log('Available tools in Cursor:');
              logger.log(`  ${chalk.cyan('dev_search')}  - Semantic code search`);
              logger.log(`  ${chalk.cyan('dev_status')}  - Repository status`);
              logger.log(`  ${chalk.cyan('dev_plan')}    - Generate development plans`);
              logger.log(`  ${chalk.cyan('dev_explore')} - Explore code patterns`);
              logger.log(`  ${chalk.cyan('dev_gh')}      - Search GitHub issues/PRs`);
              logger.log(`  ${chalk.cyan('dev_health')} - Server health checks`);
              logger.log(`  ${chalk.cyan('dev_refs')}    - Find symbol references`);
              logger.log(`  ${chalk.cyan('dev_map')}     - Generate codebase map`);
              logger.log(`  ${chalk.cyan('dev_history')} - Search git history`);
              logger.log('');
              logger.log(`Repository: ${chalk.yellow(repositoryPath)}`);
              logger.log(`Storage: ${chalk.yellow(storagePath)}`);
              logger.log('');
              logger.log(chalk.yellow('⚠️  Please restart Cursor to apply changes'));
            }
          } else {
            // Install for Claude Code using claude CLI
            const claudeAddCommand = [
              'claude',
              'mcp',
              'add',
              '--transport',
              'stdio',
              'dev-agent',
              '--env',
              `REPOSITORY_PATH=${repositoryPath}`,
              '--',
              'dev',
              'mcp',
              'start',
            ];

            spinner.text = 'Registering with Claude Code...';

            const result = spawn(claudeAddCommand[0], claudeAddCommand.slice(1), {
              stdio: ['inherit', 'pipe', 'pipe'],
            });

            let output = '';
            let error = '';

            result.stdout?.on('data', (data) => {
              output += data.toString();
            });

            result.stderr?.on('data', (data) => {
              error += data.toString();
            });

            result.on('close', (code) => {
              if (code === 0) {
                spinner.succeed(chalk.green('MCP server installed in Claude Code!'));
                logger.log('');
                logger.log(chalk.bold('Integration complete! 🎉'));
                logger.log('');
                logger.log('Available tools in Claude Code:');
                logger.log(`  ${chalk.cyan('dev_search')}  - Semantic code search`);
                logger.log(`  ${chalk.cyan('dev_status')}  - Repository status`);
                logger.log(`  ${chalk.cyan('dev_plan')}    - Generate development plans`);
                logger.log(`  ${chalk.cyan('dev_explore')} - Explore code patterns`);
                logger.log(`  ${chalk.cyan('dev_gh')}      - Search GitHub issues/PRs`);
                logger.log(`  ${chalk.cyan('dev_health')} - Server health checks`);
                logger.log(`  ${chalk.cyan('dev_refs')}    - Find symbol references`);
                logger.log(`  ${chalk.cyan('dev_map')}     - Generate codebase map`);
                logger.log(`  ${chalk.cyan('dev_history')} - Search git history`);
                logger.log('');
                logger.log(`Repository: ${chalk.yellow(repositoryPath)}`);
                logger.log(`Storage: ${chalk.yellow(storagePath)}`);
              } else {
                // Check if error is due to server already existing
                const errorText = error.toLowerCase();
                if (
                  errorText.includes('already exists') ||
                  errorText.includes('dev-agent already exists')
                ) {
                  spinner.info(chalk.yellow('MCP server already installed in Claude Code!'));
                  logger.log('');
                  logger.log(`Server name: ${chalk.cyan('dev-agent')}`);
                  logger.log(`Repository: ${chalk.gray(repositoryPath)}`);
                  logger.log('');
                  logger.log(`Run ${chalk.cyan('claude mcp list')} to see all servers`);
                } else {
                  spinner.fail('Failed to install MCP server in Claude Code');
                  if (error) {
                    logger.error(error);
                  }
                  if (output) {
                    logger.log(output);
                  }
                  process.exit(1);
                }
              }
            });
          }
        } catch (error) {
          spinner.fail('Failed to install MCP server');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('uninstall')
      .description('Remove dev-agent MCP server from Claude Code or Cursor')
      .option(
        '-r, --repository <path>',
        'Repository path (default: current directory)',
        process.cwd()
      )
      .option('--cursor', 'Uninstall from Cursor IDE instead of Claude Code')
      .action(async (options) => {
        const targetIDE = options.cursor ? 'Cursor' : 'Claude Code';
        const spinner = ora(`Removing dev-agent MCP server from ${targetIDE}...`).start();

        try {
          if (options.cursor) {
            // Remove from Cursor
            const repositoryPath = path.resolve(options.repository);
            const removed = await removeCursorServer(repositoryPath);

            if (removed) {
              spinner.succeed(chalk.green('MCP server removed from Cursor!'));
              logger.log('');
              logger.log(chalk.yellow('⚠️  Please restart Cursor to apply changes'));
            } else {
              spinner.warn('No MCP server found for this repository in Cursor');
            }
          } else {
            // Remove from Claude Code
            const result = spawn('claude', ['mcp', 'remove', 'dev-agent'], {
              stdio: ['inherit', 'pipe', 'pipe'],
            });

            result.on('close', (code) => {
              if (code === 0) {
                spinner.succeed(chalk.green('MCP server removed from Claude Code!'));
              } else {
                spinner.fail('Failed to remove MCP server from Claude Code');
                process.exit(1);
              }
            });
          }
        } catch (error) {
          spinner.fail('Failed to remove MCP server');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all configured MCP servers in Claude Code or Cursor')
      .option('--cursor', 'List servers in Cursor IDE instead of Claude Code')
      .action(async (options) => {
        try {
          if (options.cursor) {
            // List Cursor servers
            const servers = await listCursorServers();

            if (servers.length === 0) {
              logger.log(chalk.yellow('No MCP servers configured in Cursor'));
              logger.log('');
              logger.log(`Run ${chalk.cyan('dev mcp install --cursor')} to add one`);
              return;
            }

            logger.log('');
            logger.log(chalk.bold('MCP Servers in Cursor:'));
            logger.log('');

            for (const server of servers) {
              logger.log(`  ${chalk.cyan(server.name)}`);
              logger.log(`    Command: ${chalk.gray(server.command)}`);
              if (server.repository) {
                logger.log(`    Repository: ${chalk.gray(server.repository)}`);
              }
              logger.log('');
            }

            logger.log(`Total: ${chalk.yellow(servers.length)} server(s)`);
          } else {
            // List Claude Code servers
            const result = spawn('claude', ['mcp', 'list'], {
              stdio: 'inherit',
            });

            result.on('close', (code) => {
              if (code !== 0) {
                logger.error('Failed to list MCP servers');
                process.exit(1);
              }
            });
          }
        } catch (error) {
          logger.error('Failed to list MCP servers');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      })
  );
