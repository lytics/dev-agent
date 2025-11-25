#!/usr/bin/env node
/**
 * dev-agent MCP Server Entry Point
 * Starts the MCP server with stdio transport for AI tools (Claude, Cursor, etc.)
 */

import { RepositoryIndexer } from '@lytics/dev-agent-core';
import { GitHubIndexer } from '@lytics/dev-agent-subagents';
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

    // Initialize GitHub indexer
    const githubIndexer = new GitHubIndexer({
      vectorStorePath: `${repositoryPath}/.dev-agent/github-vectors.lance`,
      statePath: `${repositoryPath}/.dev-agent/github-state.json`,
      autoUpdate: false, // Don't auto-update on server start
    });

    // Initialize GitHub indexer (lazy - will be ready when first used)
    await githubIndexer.initialize();

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
      githubIndexer,
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
        logLevel,
      },
      transport: 'stdio',
      adapters: [searchAdapter, statusAdapter, planAdapter, exploreAdapter, githubAdapter],
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      await server.stop();
      await indexer.close();
      await githubIndexer.close();
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
