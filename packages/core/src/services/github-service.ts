/**
 * GitHub Service
 *
 * Shared service for GitHub operations (issues, PRs, indexing).
 * Used by MCP GitHub adapter and CLI gh commands.
 */

import type { Logger } from '@lytics/kero';

// Re-define types to avoid cross-package TypeScript issues
// These match the types from @lytics/dev-agent-subagents
export interface GitHubIndexStats {
  totalIssues: number;
  totalPullRequests: number;
  totalDocuments: number;
  vectorsStored: number;
  duration: number;
  startTime: Date;
  endTime: Date;
}

export interface GitHubSearchResult {
  score: number;
  metadata?: Record<string, unknown>;
}

export interface GitHubDocument {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  type: 'issue' | 'pull_request';
  author: string;
  createdAt: Date;
  updatedAt: Date;
  labels: string[];
  comments: unknown[];
  url: string;
}

// Generic indexer interface to avoid import issues
export interface GitHubIndexer {
  initialize(): Promise<void>;
  close(): Promise<void>;
  index(options?: unknown): Promise<GitHubIndexStats>;
  search(query: string, options?: unknown): Promise<GitHubSearchResult[]>;
  getStats(): Promise<GitHubIndexStats | null>;
}

export interface GitHubServiceConfig {
  repositoryPath: string;
  logger?: Logger;
}

export interface GitHubIndexOptions {
  types?: ('issue' | 'pull_request')[];
  state?: ('open' | 'closed' | 'merged')[];
  limit?: number;
  onProgress?: (progress: unknown) => void;
}

export interface GitHubSearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
}

export interface GitHubIndexerFactoryConfig {
  vectorStorePath: string;
  statePath: string;
  autoUpdate?: boolean;
  staleThreshold?: number;
}

/**
 * Factory function for creating GitHubIndexer instances
 */
export type GitHubIndexerFactory = (config: GitHubIndexerFactoryConfig) => Promise<GitHubIndexer>;

/**
 * Service for GitHub operations
 *
 * Encapsulates GitHub indexer initialization and operations.
 * Provides consistent behavior across CLI and MCP.
 */
export class GitHubService {
  private repositoryPath: string;
  private logger?: Logger;
  private createIndexer: GitHubIndexerFactory;

  constructor(config: GitHubServiceConfig, createIndexer?: GitHubIndexerFactory) {
    this.repositoryPath = config.repositoryPath;
    this.logger = config.logger;

    // Use provided factory or default implementation
    this.createIndexer = createIndexer || this.defaultIndexerFactory.bind(this);
  }

  /**
   * Default factory that creates a real GitHubIndexer
   */
  private async defaultIndexerFactory(config: GitHubIndexerFactoryConfig): Promise<GitHubIndexer> {
    // Dynamic import to avoid TypeScript cross-package issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GitHubIndexer: Indexer } = require('@lytics/dev-agent-subagents');
    return new Indexer({
      vectorStorePath: config.vectorStorePath,
      statePath: config.statePath,
      autoUpdate: config.autoUpdate ?? true,
      staleThreshold: config.staleThreshold ?? 15 * 60 * 1000, // 15 minutes
    }) as GitHubIndexer;
  }

  /**
   * Get initialized GitHub indexer
   */
  private async getIndexer(): Promise<GitHubIndexer> {
    const { getStoragePath, getStorageFilePaths } = await import('../storage/path.js');
    const storagePath = await getStoragePath(this.repositoryPath);
    const { vectors, githubState } = getStorageFilePaths(storagePath);

    // Validate paths
    if (
      !vectors ||
      vectors.includes('undefined') ||
      !githubState ||
      githubState.includes('undefined')
    ) {
      throw new Error(`Invalid storage paths: vectors=${vectors}, githubState=${githubState}`);
    }

    const vectorStorePath = `${vectors}-github`;

    if (vectorStorePath.includes('undefined')) {
      throw new Error(`Invalid GitHub vector storage path: ${vectorStorePath}`);
    }

    const indexer = await this.createIndexer({
      vectorStorePath,
      statePath: githubState,
      autoUpdate: true,
      staleThreshold: 15 * 60 * 1000,
    });

    await indexer.initialize();
    return indexer;
  }

  /**
   * Index GitHub issues and pull requests
   *
   * @param options - Indexing options (types, state, limit, progress callback)
   * @returns Index statistics
   */
  async index(options?: GitHubIndexOptions): Promise<GitHubIndexStats> {
    const indexer = await this.getIndexer();
    try {
      const stats = await indexer.index({
        types: options?.types,
        state: options?.state,
        limit: options?.limit,
        logger: this.logger,
        onProgress: options?.onProgress,
      });
      return stats;
    } finally {
      await indexer.close();
    }
  }

  /**
   * Search GitHub issues and pull requests semantically
   *
   * @param query - Search query
   * @param options - Search options (types, state, author, labels, limit)
   * @returns Search results
   */
  async search(query: string, options?: GitHubSearchOptions): Promise<GitHubSearchResult[]> {
    const indexer = await this.getIndexer();
    try {
      const results = await indexer.search(query, {
        limit: options?.limit ?? 10,
        filter: options?.filter,
      });
      return results;
    } finally {
      await indexer.close();
    }
  }

  /**
   * Get context for a specific GitHub issue or PR
   *
   * Retrieves the full document with all metadata.
   *
   * @param number - Issue or PR number
   * @returns GitHub document or null if not found
   */
  async getContext(number: number): Promise<GitHubDocument | null> {
    const indexer = await this.getIndexer();
    try {
      // Search by number in title/body
      const results = await indexer.search(`#${number}`, { limit: 10 });

      // Find exact match by number
      for (const result of results) {
        const meta = result.metadata;
        if (meta && typeof meta === 'object' && 'number' in meta && meta.number === number) {
          return {
            id: String(meta.number || number),
            number: meta.number as number,
            title: (meta.title as string) || '',
            body: (meta.body as string) || '',
            state: (meta.state as 'open' | 'closed' | 'merged') || 'open',
            type: (meta.type as 'issue' | 'pull_request') || 'issue',
            author: (meta.author as string) || '',
            createdAt: meta.created_at ? new Date(meta.created_at as string) : new Date(),
            updatedAt: meta.updated_at ? new Date(meta.updated_at as string) : new Date(),
            labels: Array.isArray(meta.labels) ? (meta.labels as string[]) : [],
            comments: Array.isArray(meta.comments) ? meta.comments : [],
            url: (meta.url as string) || '',
          };
        }
      }

      return null;
    } finally {
      await indexer.close();
    }
  }

  /**
   * Find related GitHub issues/PRs
   *
   * Uses semantic similarity to find related issues.
   *
   * @param number - Issue or PR number
   * @param limit - Maximum number of results
   * @returns Related GitHub documents
   */
  async findRelated(number: number, limit = 5): Promise<GitHubSearchResult[]> {
    const indexer = await this.getIndexer();
    try {
      // First get the target issue/PR
      const target = await this.getContext(number);
      if (!target) {
        return [];
      }

      // Search using title and body as query
      const query = `${target.title} ${target.body}`;
      const results = await indexer.search(query, { limit: limit + 1 });

      // Filter out the original issue
      return results.filter((r) => r.metadata?.number !== number).slice(0, limit);
    } finally {
      await indexer.close();
    }
  }

  /**
   * Get GitHub index statistics
   *
   * @returns Index stats or null if not indexed
   */
  async getStats(): Promise<GitHubIndexStats | null> {
    try {
      const indexer = await this.getIndexer();
      try {
        const stats = await indexer.getStats();
        return stats;
      } finally {
        await indexer.close();
      }
    } catch {
      return null;
    }
  }

  /**
   * Check if GitHub data is indexed
   *
   * @returns True if indexed
   */
  async isIndexed(): Promise<boolean> {
    try {
      const stats = await this.getStats();
      return stats !== null && stats.totalDocuments > 0;
    } catch {
      return false;
    }
  }
}
