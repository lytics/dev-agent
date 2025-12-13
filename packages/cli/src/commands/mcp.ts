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
import {
  output,
  printMcpInstallSuccess,
  printMcpServers,
  printMcpUninstallSuccess,
} from '../utils/output';

export const mcpCommand = new Command('mcp')
  .description('MCP (Model Context Protocol) server integration')
  .addHelpText(
    'after',
    `
Examples:
  $ dev mcp install                     Install for Claude Code
  $ dev mcp install --cursor            Install for Cursor IDE
  $ dev mcp list --cursor               Show configured MCP servers
  $ dev mcp start                       Start MCP server (usually automatic)

Setup:
  1. Index your repository first: dev index
  2. Install MCP integration: dev mcp install --cursor
  3. Restart Cursor to activate

Available Tools (9):
  dev_search, dev_status, dev_plan, dev_explore, dev_gh,
  dev_health, dev_refs, dev_map, dev_history
`
  )
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
              output.log();
              output.log(`Server name: ${chalk.cyan(result.serverName)}`);
              output.log(`Repository:  ${chalk.gray(repositoryPath)}`);
              output.log();
              output.log(`Run ${chalk.cyan('dev mcp list --cursor')} to see all servers`);
              output.log();
            } else {
              spinner.succeed('MCP server installed');

              printMcpInstallSuccess({
                ide: 'Cursor',
                serverName: result.serverName,
                configPath: '~/.cursor/mcp.json',
                repository: repositoryPath,
              });
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

            let stdoutData = '';
            let stderrData = '';

            result.stdout?.on('data', (data) => {
              stdoutData += data.toString();
            });

            result.stderr?.on('data', (data) => {
              stderrData += data.toString();
            });

            result.on('close', (code) => {
              if (code === 0) {
                spinner.succeed('MCP server installed');

                printMcpInstallSuccess({
                  ide: 'Claude Code',
                  serverName: 'dev-agent',
                  configPath: '~/.claude/mcp.json',
                  repository: repositoryPath,
                });
              } else {
                // Check if error is due to server already existing
                const errorText = stderrData.toLowerCase();
                if (
                  errorText.includes('already exists') ||
                  errorText.includes('dev-agent already exists')
                ) {
                  spinner.info(chalk.yellow('MCP server already installed in Claude Code!'));
                  output.log();
                  output.log(`Server name: ${chalk.cyan('dev-agent')}`);
                  output.log(`Repository:  ${chalk.gray(repositoryPath)}`);
                  output.log();
                  output.log(`Run ${chalk.cyan('claude mcp list')} to see all servers`);
                  output.log();
                } else {
                  spinner.fail('Failed to install MCP server in Claude Code');
                  if (stderrData) {
                    logger.error(stderrData);
                  }
                  if (stdoutData) {
                    logger.log(stdoutData);
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
              spinner.succeed('MCP server removed');

              printMcpUninstallSuccess({
                ide: 'Cursor',
                serverName: 'dev-agent',
              });
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
                spinner.succeed('MCP server removed');

                printMcpUninstallSuccess({
                  ide: 'Claude Code',
                  serverName: 'dev-agent',
                });
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
            const spinner = ora('Checking MCP server health...').start();
            const servers = await listCursorServers();
            spinner.stop();

            // Add status check (simple check: does the command exist?)
            const serversWithStatus = servers.map((server) => ({
              ...server,
              status: 'active' as const, // For now, all listed servers are considered active
            }));

            printMcpServers({
              ide: 'Cursor',
              servers: serversWithStatus,
            });
          } else {
            // List Claude Code servers
            output.log();
            output.log(chalk.bold('MCP Servers (Claude Code)'));
            output.log();
            output.log('Running: claude mcp list');
            output.log();

            const result = spawn('claude', ['mcp', 'list'], {
              stdio: 'inherit',
            });

            result.on('close', (code) => {
              if (code !== 0) {
                output.error('Failed to list MCP servers');
                process.exit(1);
              }
            });
          }
        } catch (error) {
          output.error('Failed to list MCP servers');
          output.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      })
  );
