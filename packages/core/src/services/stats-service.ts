/**
 * Stats Service
 *
 * Shared service for retrieving repository statistics.
 * Used by both MCP adapters and Dashboard API routes.
 */

import type { Logger } from '@lytics/kero';
import type { RepositoryIndexer } from '../indexer/index.js';
import type { DetailedIndexStats } from '../indexer/types.js';

export interface StatsServiceConfig {
  repositoryPath: string;
  logger?: Logger;
}

/**
 * Factory function for creating RepositoryIndexer instances
 * Can be overridden in tests
 */
export type IndexerFactory = (config: {
  repositoryPath: string;
  vectorStorePath: string;
  statePath: string;
  logger?: Logger;
}) => Promise<RepositoryIndexer>;

/**
 * Service for retrieving repository statistics
 *
 * Encapsulates indexer initialization and stats retrieval.
 * Ensures consistent behavior across MCP and Dashboard.
 */
export class StatsService {
  private repositoryPath: string;
  private logger?: Logger;
  private createIndexer: IndexerFactory;

  constructor(config: StatsServiceConfig, createIndexer?: IndexerFactory) {
    this.repositoryPath = config.repositoryPath;
    this.logger = config.logger;

    // Use provided factory or default implementation
    this.createIndexer = createIndexer || this.defaultIndexerFactory;
  }

  /**
   * Default factory that creates a real RepositoryIndexer
   */
  private async defaultIndexerFactory(
    config: Parameters<IndexerFactory>[0]
  ): Promise<RepositoryIndexer> {
    const { RepositoryIndexer: Indexer } = await import('../indexer/index.js');
    const { getStoragePath, getStorageFilePaths } = await import('../storage/path.js');

    const storagePath = await getStoragePath(config.repositoryPath);
    const filePaths = getStorageFilePaths(storagePath);

    return new Indexer({
      repositoryPath: config.repositoryPath,
      vectorStorePath: filePaths.vectors,
      statePath: filePaths.indexerState,
      logger: config.logger,
    });
  }

  /**
   * Get current repository statistics
   *
   * Initializes indexer, retrieves stats, and cleans up.
   * Thread-safe and idempotent.
   *
   * @returns Detailed index statistics or null if not indexed
   * @throws Error if stats unavailable
   */
  async getStats(): Promise<DetailedIndexStats | null> {
    const indexer = await this.createIndexer({
      repositoryPath: this.repositoryPath,
      vectorStorePath: '', // Filled by factory
      statePath: '', // Filled by factory
      logger: this.logger,
    });

    try {
      await indexer.initialize();
      const stats = await indexer.getStats();
      return stats;
    } finally {
      await indexer.close();
    }
  }

  /**
   * Check if repository is indexed
   *
   * @returns True if indexer state exists
   */
  async isIndexed(): Promise<boolean> {
    try {
      const stats = await this.getStats();
      return stats !== null;
    } catch (_error) {
      return false;
    }
  }
}
