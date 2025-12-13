/**
 * Search Service
 *
 * Shared service for semantic code search operations.
 * Used by MCP search/refs/explore adapters and CLI search command.
 */

import type { Logger } from '@lytics/kero';
import type { RepositoryIndexer } from '../indexer/index.js';
import type { SearchResult, SearchOptions as VectorSearchOptions } from '../vector/types.js';

export interface SearchServiceConfig {
  repositoryPath: string;
  logger?: Logger;
}

// Re-export SearchOptions from vector types for convenience
export type SearchOptions = VectorSearchOptions;

export interface SimilarityOptions {
  limit?: number;
  threshold?: number;
}

export interface IndexerFactoryConfig {
  repositoryPath: string;
  vectorStorePath: string;
  statePath: string;
  logger?: Logger;
  excludePatterns?: string[];
  languages?: string[];
}

/**
 * Factory function for creating RepositoryIndexer instances
 */
export type IndexerFactory = (config: IndexerFactoryConfig) => Promise<RepositoryIndexer>;

/**
 * Service for semantic code search
 *
 * Encapsulates indexer initialization and search operations.
 * Provides consistent search behavior across CLI and MCP.
 */
export class SearchService {
  private repositoryPath: string;
  private logger?: Logger;
  private createIndexer: IndexerFactory;

  constructor(config: SearchServiceConfig, createIndexer?: IndexerFactory) {
    this.repositoryPath = config.repositoryPath;
    this.logger = config.logger;

    // Use provided factory or default implementation
    this.createIndexer = createIndexer || this.defaultIndexerFactory.bind(this);
  }

  /**
   * Default factory that creates a real RepositoryIndexer
   */
  private async defaultIndexerFactory(config: IndexerFactoryConfig): Promise<RepositoryIndexer> {
    const { RepositoryIndexer: Indexer } = await import('../indexer/index.js');
    return new Indexer({
      repositoryPath: config.repositoryPath,
      vectorStorePath: config.vectorStorePath,
      statePath: config.statePath,
      logger: config.logger,
      excludePatterns: config.excludePatterns,
      languages: config.languages,
    });
  }

  /**
   * Get initialized indexer for this repository
   */
  private async getIndexer(options?: {
    excludePatterns?: string[];
    languages?: string[];
  }): Promise<RepositoryIndexer> {
    const { getStoragePath, getStorageFilePaths } = await import('../storage/path.js');
    const storagePath = await getStoragePath(this.repositoryPath);
    const filePaths = getStorageFilePaths(storagePath);

    const indexer = await this.createIndexer({
      repositoryPath: this.repositoryPath,
      vectorStorePath: filePaths.vectors,
      statePath: filePaths.indexerState,
      logger: this.logger,
      excludePatterns: options?.excludePatterns,
      languages: options?.languages,
    });

    await indexer.initialize();
    return indexer;
  }

  /**
   * Perform semantic code search
   *
   * @param query - Search query string
   * @param options - Search options (limit, scoreThreshold)
   * @returns Array of search results
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const indexer = await this.getIndexer();
    try {
      const results = await indexer.search(query, {
        limit: options?.limit ?? 10,
        scoreThreshold: options?.scoreThreshold ?? 0.7,
      });
      return results;
    } finally {
      await indexer.close();
    }
  }

  /**
   * Find similar code to a specific file
   *
   * @param filePath - Path to the file
   * @param options - Similarity options (limit, threshold)
   * @returns Array of similar files with scores
   */
  async findSimilar(filePath: string, options?: SimilarityOptions): Promise<SearchResult[]> {
    const indexer = await this.getIndexer();
    try {
      // Search for documents from the target file
      const fileResults = await indexer.search(filePath, { limit: 5 });
      if (fileResults.length === 0) {
        return [];
      }

      // Use the path as query to find similar code patterns
      const results = await indexer.search(filePath, {
        limit: (options?.limit ?? 10) + 1, // +1 to account for the file itself
        scoreThreshold: options?.threshold ?? 0.7,
      });

      // Filter out the original file
      return results.filter((r) => r.metadata.path !== filePath);
    } finally {
      await indexer.close();
    }
  }

  /**
   * Find related test files for a source file
   *
   * Uses naming conventions to find potential test files.
   *
   * @param filePath - Path to the source file
   * @returns Array of related test file paths
   */
  async findRelatedTests(filePath: string): Promise<string[]> {
    const indexer = await this.getIndexer();
    try {
      const baseName = filePath.replace(/\.(ts|js|tsx|jsx)$/, '').replace(/^.*\//, '');

      // Common test file patterns
      const patterns = [
        `${baseName}.test`,
        `${baseName}.spec`,
        `${baseName}_test`,
        `__tests__/${baseName}`,
      ];

      const relatedFiles: string[] = [];

      for (const pattern of patterns) {
        const results = await indexer.search(pattern, { limit: 5 });
        for (const result of results) {
          const file = result.metadata.path;
          if (
            file &&
            (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) &&
            !relatedFiles.includes(file)
          ) {
            relatedFiles.push(file);
          }
        }
      }

      return relatedFiles;
    } finally {
      await indexer.close();
    }
  }

  /**
   * Find a specific symbol (function, class, etc.) by name
   *
   * Useful for refs queries that need to locate a symbol first.
   *
   * @param name - Symbol name to search for
   * @returns Best matching result or null if not found
   */
  async findSymbol(name: string): Promise<SearchResult | null> {
    const indexer = await this.getIndexer();
    try {
      const results = await indexer.search(name, { limit: 10 });

      // Find best match by checking if the name appears in the result
      for (const result of results) {
        const metadata = result.metadata;
        if (
          metadata.name === name ||
          metadata.path?.includes(name) ||
          metadata.signature?.includes(name)
        ) {
          return result;
        }
      }

      // Return first result if no exact match
      return results.length > 0 ? results[0] : null;
    } finally {
      await indexer.close();
    }
  }

  /**
   * Check if repository is indexed
   *
   * @returns True if repository has been indexed
   */
  async isIndexed(): Promise<boolean> {
    try {
      const indexer = await this.getIndexer();
      try {
        const stats = await indexer.getStats();
        return stats !== null;
      } finally {
        await indexer.close();
      }
    } catch {
      return false;
    }
  }
}
