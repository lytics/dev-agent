/**
 * MCP (Model Context Protocol) Server Commands
 * Provides integration with AI tools like Claude Code, Cursor, etc.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getStorageFilePaths, getStoragePath, RepositoryIndexer } from '@lytics/dev-agent-core';
import {
  ExploreAdapter,
  GitHubAdapter,
  MCPServer,
  PlanAdapter,
  SearchAdapter,
  StatusAdapter,
} from '@lytics/dev-agent-mcp';
import {
  ExplorerAgent,
  PlannerAgent,
  PrAgent,
  SubagentCoordinator,
} from '@lytics/dev-agent-subagents';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { logger } from '../utils/logger.js';

export const mcpCommand = new Command('mcp')
  .description('MCP (Model Context Protocol) server integration')
  .addCommand(
    new Command('start')
      .description('Start MCP server for current repository')
      .option('-p, --port <port>', 'Port for HTTP transport (if not using stdio)')
      .option('-t, --transport <type>', 'Transport type: stdio (default) or http', 'stdio')
      .option('-v, --verbose', 'Verbose logging', false)
      .action(async (options) => {
        const repositoryPath = process.cwd();
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

          // Create and configure the subagent coordinator
          const coordinator = new SubagentCoordinator({
            maxConcurrentTasks: 5,
            defaultMessageTimeout: 30000,
            logLevel: logLevel as 'debug' | 'info' | 'warn' | 'error',
          });

          // Set up context manager with indexer
          coordinator.getContextManager().setIndexer(indexer);

          // Register subagents
          await coordinator.registerAgent(new ExplorerAgent());
          await coordinator.registerAgent(new PlannerAgent());
          await coordinator.registerAgent(new PrAgent());

          // Create all adapters
          const searchAdapter = new SearchAdapter({
            repositoryIndexer: indexer,
            defaultFormat: 'compact',
            defaultLimit: 10,
          });

          const statusAdapter = new StatusAdapter({
            repositoryIndexer: indexer,
            repositoryPath,
            vectorStorePath: vectors,
            defaultSection: 'summary',
          });

          const planAdapter = new PlanAdapter({
            repositoryIndexer: indexer,
            repositoryPath,
            defaultFormat: 'compact',
            timeout: 60000,
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
            vectorStorePath: `${vectors}-github`,
            statePath: getStorageFilePaths(storagePath).githubState,
            defaultLimit: 10,
            defaultFormat: 'compact',
          });

          // Create MCP server
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
            adapters: [searchAdapter, statusAdapter, planAdapter, exploreAdapter, githubAdapter],
            coordinator,
          });

          // Handle graceful shutdown
          const shutdown = async () => {
            logger.info('Shutting down MCP server...');
            await server.stop();
            await indexer.close();
            if (githubAdapter.githubIndexer) {
              await githubAdapter.githubIndexer.close();
            }
            process.exit(0);
          };

          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);

          // Start server
          await server.start();

          logger.info(chalk.green('MCP server started successfully!'));
          logger.info('Available tools: dev_search, dev_status, dev_plan, dev_explore, dev_gh');

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
      .description('Install dev-agent MCP server in Claude Code')
      .option(
        '-r, --repository <path>',
        'Repository path (default: current directory)',
        process.cwd()
      )
      .action(async (options) => {
        const repositoryPath = path.resolve(options.repository);
        const spinner = ora('Installing dev-agent MCP server in Claude Code...').start();

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

          // Add to Claude Code using claude CLI
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
              logger.log('');
              logger.log(`Repository: ${chalk.yellow(repositoryPath)}`);
              logger.log(`Storage: ${chalk.yellow(storagePath)}`);
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
          });
        } catch (error) {
          spinner.fail('Failed to install MCP server');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('uninstall')
      .description('Remove dev-agent MCP server from Claude Code')
      .action(async () => {
        const spinner = ora('Removing dev-agent MCP server from Claude Code...').start();

        try {
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
        } catch (error) {
          spinner.fail('Failed to remove MCP server');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all configured MCP servers in Claude Code')
      .action(async () => {
        try {
          const result = spawn('claude', ['mcp', 'list'], {
            stdio: 'inherit',
          });

          result.on('close', (code) => {
            if (code !== 0) {
              logger.error('Failed to list MCP servers');
              process.exit(1);
            }
          });
        } catch (error) {
          logger.error('Failed to list MCP servers');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      })
  );
