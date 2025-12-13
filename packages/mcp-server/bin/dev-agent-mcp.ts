#!/usr/bin/env node
/**
 * dev-agent MCP Server Entry Point
 * Starts the MCP server with stdio transport for AI tools (Claude, Cursor, etc.)
 */

import {
  CoordinatorService,
  ensureStorageDirectory,
  GitHubService,
  GitIndexer,
  getStorageFilePaths,
  getStoragePath,
  LocalGitExtractor,
  RepositoryIndexer,
  SearchService,
  StatsService,
  saveMetadata,
  VectorStorage,
} from '@lytics/dev-agent-core';
import type { SubagentCoordinator } from '@lytics/dev-agent-subagents';
import {
  ExploreAdapter,
  GitHubAdapter,
  HealthAdapter,
  HistoryAdapter,
  MapAdapter,
  PlanAdapter,
  RefsAdapter,
  SearchAdapter,
  StatusAdapter,
} from '../src/adapters/built-in';
import { MCPServer } from '../src/server/mcp-server';

// Get config from environment with smart workspace detection
// Priority: WORKSPACE_FOLDER_PATHS (Cursor dynamic) > REPOSITORY_PATH (explicit) > cwd (fallback)
const repositoryPath =
  process.env.WORKSPACE_FOLDER_PATHS || process.env.REPOSITORY_PATH || process.cwd();
const logLevel = (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info';

console.error('[MCP] Workspace detection:', {
  detected: repositoryPath,
  source: process.env.WORKSPACE_FOLDER_PATHS
    ? 'WORKSPACE_FOLDER_PATHS'
    : process.env.REPOSITORY_PATH
      ? 'REPOSITORY_PATH'
      : 'cwd',
});

// Lazy-loaded indexer
let indexer: RepositoryIndexer | undefined;
let lastAccessed = Date.now();
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Ensure indexer is loaded (lazy loading)
 * This will be called on first tool use
 */
async function _ensureIndexer(): Promise<RepositoryIndexer> {
  if (!indexer) {
    // Get centralized storage path
    const storagePath = await getStoragePath(repositoryPath);
    await ensureStorageDirectory(storagePath);
    const filePaths = getStorageFilePaths(storagePath);

    // Initialize repository indexer with centralized storage
    indexer = new RepositoryIndexer({
      repositoryPath,
      vectorStorePath: filePaths.vectors,
      statePath: filePaths.indexerState,
    });

    await indexer.initialize();

    // Update metadata
    await saveMetadata(storagePath, repositoryPath);

    console.error(`[MCP] Loaded indexes from ${storagePath}`);
  }

  lastAccessed = Date.now();
  return indexer;
}

/**
 * Auto-unload indexer after idle period
 * TODO: Enable idle monitoring in future iteration
 */
function _startIdleMonitor(): void {
  setInterval(() => {
    const idleTime = Date.now() - lastAccessed;

    if (idleTime > IDLE_TIMEOUT && indexer) {
      indexer
        .close()
        .then(() => {
          indexer = undefined;
          const idleMinutes = Math.floor(idleTime / 60000);
          console.error(`[MCP] Unloaded indexes (idle timeout: ${idleMinutes} minutes)`);
        })
        .catch((error) => {
          console.error('[MCP] Error unloading indexes:', error);
        });
    }
  }, 60000); // Check every minute
}

async function main() {
  try {
    // Get centralized storage paths
    const storagePath = await getStoragePath(repositoryPath);
    await ensureStorageDirectory(storagePath);
    const filePaths = getStorageFilePaths(storagePath);

    // Initialize repository indexer with centralized storage
    // TODO: Make this truly lazy (only initialize on first tool call)
    // For now, initialize eagerly but use centralized storage
    const indexer = new RepositoryIndexer({
      repositoryPath,
      vectorStorePath: filePaths.vectors,
      statePath: filePaths.indexerState,
    });

    await indexer.initialize();

    // Update metadata
    await saveMetadata(storagePath, repositoryPath);

    // Create and configure the subagent coordinator using CoordinatorService
    const coordinatorService = new CoordinatorService({
      repositoryPath,
      maxConcurrentTasks: 5,
      defaultMessageTimeout: 30000,
      logLevel,
    });
    // Type assertion: CoordinatorService returns a minimal interface, but it's
    // structurally compatible with the full SubagentCoordinator type
    const coordinator = (await coordinatorService.createCoordinator(
      indexer
    )) as SubagentCoordinator;

    // Create services
    const searchService = new SearchService({ repositoryPath });
    const githubService = new GitHubService({ repositoryPath }, async (config) => {
      const { GitHubIndexer } = await import('@lytics/dev-agent-subagents');
      return new GitHubIndexer(config);
    });
    const statsService = new StatsService({ repositoryPath });

    // Create and register adapters
    const searchAdapter = new SearchAdapter({
      searchService,
      repositoryPath,
      defaultFormat: 'compact',
      defaultLimit: 10,
    });

    const statusAdapter = new StatusAdapter({
      statsService,
      repositoryPath,
      vectorStorePath: filePaths.vectors,
      githubService,
      defaultSection: 'summary',
    });

    // Create git extractor and indexer (needed by plan and history adapters)
    const gitExtractor = new LocalGitExtractor(repositoryPath);
    const gitVectorStorage = new VectorStorage({
      storePath: `${filePaths.vectors}-git`,
    });
    await gitVectorStorage.initialize();

    const gitIndexer = new GitIndexer({
      extractor: gitExtractor,
      vectorStorage: gitVectorStorage,
    });

    const planAdapter = new PlanAdapter({
      repositoryIndexer: indexer,
      gitIndexer,
      repositoryPath,
      defaultFormat: 'compact',
      timeout: 60000, // 60 seconds
    });

    const exploreAdapter = new ExploreAdapter({
      repositoryPath,
      searchService,
      defaultLimit: 10,
      defaultThreshold: 0.7,
      defaultFormat: 'compact',
    });

    const githubAdapter = new GitHubAdapter({
      githubService,
      repositoryPath,
      defaultLimit: 10,
      defaultFormat: 'compact',
    });

    const healthAdapter = new HealthAdapter({
      repositoryPath,
      vectorStorePath: filePaths.vectors,
      githubStatePath: filePaths.githubState,
    });

    const refsAdapter = new RefsAdapter({
      searchService,
      defaultLimit: 20,
    });

    const mapAdapter = new MapAdapter({
      repositoryIndexer: indexer,
      repositoryPath,
      defaultDepth: 2,
      defaultTokenBudget: 2000,
    });

    const historyAdapter = new HistoryAdapter({
      gitIndexer,
      gitExtractor,
      defaultLimit: 10,
      defaultTokenBudget: 2000,
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
      adapters: [
        searchAdapter,
        statusAdapter,
        planAdapter,
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
      await server.stop();
      await indexer.close();
      await gitVectorStorage.close();
      // Close GitHub service
      await githubService.shutdown();
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
