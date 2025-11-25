#!/usr/bin/env node
/**
 * dev-agent MCP Server Entry Point
 * Starts the MCP server with stdio transport for AI tools (Claude, Cursor, etc.)
 */

import { RepositoryIndexer } from '@lytics/dev-agent-core';
import {
  ExplorerAgent,
  PlannerAgent,
  PrAgent,
  SubagentCoordinator,
} from '@lytics/dev-agent-subagents';
import {
  ExploreAdapter,
  GitHubAdapter,
  PlanAdapter,
  SearchAdapter,
  StatusAdapter,
} from '../src/adapters/built-in';
import { MCPServer } from '../src/server/mcp-server';

// Get config from environment
const repositoryPath = process.env.REPOSITORY_PATH || process.cwd();
const vectorStorePath =
  process.env.VECTOR_STORE_PATH || `${repositoryPath}/.dev-agent/vectors.lance`;
const logLevel = (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info';

async function main() {
  try {
    // Initialize repository indexer
    const indexer = new RepositoryIndexer({
      repositoryPath,
      vectorStorePath,
    });

    await indexer.initialize();

    // Create and configure the subagent coordinator
    const coordinator = new SubagentCoordinator({
      maxConcurrentTasks: 5,
      defaultMessageTimeout: 30000,
      logLevel,
    });

    // Set up context manager with indexer
    coordinator.getContextManager().setIndexer(indexer);

    // Register subagents
    await coordinator.registerAgent(new ExplorerAgent());
    await coordinator.registerAgent(new PlannerAgent());
    await coordinator.registerAgent(new PrAgent());

    // Create and register adapters
    const searchAdapter = new SearchAdapter({
      repositoryIndexer: indexer,
      defaultFormat: 'compact',
      defaultLimit: 10,
    });

    const statusAdapter = new StatusAdapter({
      repositoryIndexer: indexer,
      repositoryPath,
      vectorStorePath,
      defaultSection: 'summary',
    });

    const planAdapter = new PlanAdapter({
      repositoryIndexer: indexer,
      repositoryPath,
      defaultFormat: 'compact',
      timeout: 60000, // 60 seconds
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
      // GitHubIndexer will be lazily initialized on first use
      vectorStorePath: `${vectorStorePath}-github`,
      statePath: `${repositoryPath}/.dev-agent/github-state.json`,
      defaultLimit: 10,
      defaultFormat: 'compact',
    });

    // Create MCP server with coordinator
    const server = new MCPServer({
      serverInfo: {
        name: 'dev-agent',
        version: '0.1.0',
      },
      config: {
        repositoryPath,
        logLevel,
      },
      transport: 'stdio',
      adapters: [searchAdapter, statusAdapter, planAdapter, exploreAdapter, githubAdapter],
      coordinator,
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      await server.stop();
      await indexer.close();
      // Close GitHub adapter if initialized
      if (githubAdapter.githubIndexer) {
        await githubAdapter.githubIndexer.close();
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start server
    await server.start();

    // Keep process alive (server runs until stdin closes or signal received)
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
