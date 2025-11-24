#!/usr/bin/env node
/**
 * dev-agent MCP Server Entry Point
 * Starts the MCP server with stdio transport for AI tools (Claude, Cursor, etc.)
 */

import { RepositoryIndexer } from '@lytics/dev-agent-core';
import { SearchAdapter } from '../src/adapters/built-in/search-adapter';
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

    // Create and register adapters
    const searchAdapter = new SearchAdapter({
      repositoryIndexer: indexer,
      defaultFormat: 'compact',
      defaultLimit: 10,
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
      adapters: [searchAdapter],
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      await server.stop();
      await indexer.close();
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
