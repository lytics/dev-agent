/**
 * Git History Service
 *
 * Shared service for git history indexing and search.
 * Used by MCP adapters (HistoryAdapter, PlanAdapter) and CLI commands.
 */

import type { Logger } from '@lytics/kero';

// Re-define types to avoid cross-package TypeScript issues
export interface GitExtractor {
  extractCommits(options?: unknown): Promise<unknown[]>;
}

export interface VectorStorage {
  initialize(): Promise<void>;
  close(): Promise<void>;
  add(vectors: unknown[]): Promise<void>;
  search(query: string, options?: unknown): Promise<unknown[]>;
}

export interface GitIndexer {
  index(options?: unknown): Promise<unknown>;
  search(query: string, options?: unknown): Promise<unknown[]>;
  getCommits(options?: unknown): Promise<unknown[]>;
}

export interface GitHistoryServiceConfig {
  repositoryPath: string;
  logger?: Logger;
}

export interface GitIndexerFactoryConfig {
  extractor: GitExtractor;
  vectorStorage: VectorStorage;
}

/**
 * Factory functions for creating git components
 */
export type GitExtractorFactory = (repositoryPath: string) => Promise<GitExtractor>;
export type VectorStorageFactory = (storePath: string) => Promise<VectorStorage>;
export type GitIndexerFactory = (config: GitIndexerFactoryConfig) => Promise<GitIndexer>;

export interface GitHistoryFactories {
  createExtractor?: GitExtractorFactory;
  createVectorStorage?: VectorStorageFactory;
  createGitIndexer?: GitIndexerFactory;
}

/**
 * Service for git history operations
 *
 * Encapsulates the setup of:
 * - LocalGitExtractor
 * - VectorStorage for git commits
 * - GitIndexer
 *
 * Makes git history operations testable and consistent.
 */
export class GitHistoryService {
  private repositoryPath: string;
  private logger?: Logger;
  private factories: Required<GitHistoryFactories>;
  private cachedGitIndexer?: GitIndexer;
  private cachedVectorStorage?: VectorStorage;

  constructor(config: GitHistoryServiceConfig, factories?: GitHistoryFactories) {
    this.repositoryPath = config.repositoryPath;
    this.logger = config.logger;

    // Use provided factories or defaults
    this.factories = {
      createExtractor: factories?.createExtractor || this.defaultExtractorFactory.bind(this),
      createVectorStorage:
        factories?.createVectorStorage || this.defaultVectorStorageFactory.bind(this),
      createGitIndexer: factories?.createGitIndexer || this.defaultGitIndexerFactory.bind(this),
    };
  }

  /**
   * Default factory implementations
   */
  private async defaultExtractorFactory(repositoryPath: string): Promise<GitExtractor> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LocalGitExtractor } = require('@lytics/dev-agent-core');
    return new LocalGitExtractor(repositoryPath) as GitExtractor;
  }

  private async defaultVectorStorageFactory(storePath: string): Promise<VectorStorage> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { VectorStorage: Storage } = require('@lytics/dev-agent-core');
    const storage = new Storage({ storePath }) as VectorStorage;
    await storage.initialize();
    return storage;
  }

  private async defaultGitIndexerFactory(config: GitIndexerFactoryConfig): Promise<GitIndexer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GitIndexer: Indexer } = require('@lytics/dev-agent-core');
    return new Indexer(config) as GitIndexer;
  }

  /**
   * Get or create git indexer
   *
   * Lazy initialization with caching.
   *
   * @returns Initialized git indexer
   */
  async getGitIndexer(): Promise<GitIndexer> {
    if (this.cachedGitIndexer) {
      return this.cachedGitIndexer;
    }

    this.logger?.debug('Initializing git history indexer');

    // Get storage path for git vectors
    const { getStoragePath, getStorageFilePaths } = await import('../storage/path.js');
    const storagePath = await getStoragePath(this.repositoryPath);
    const filePaths = getStorageFilePaths(storagePath);
    const gitVectorStorePath = `${filePaths.vectors}-git`;

    // Create components
    const extractor = await this.factories.createExtractor(this.repositoryPath);
    const vectorStorage = await this.factories.createVectorStorage(gitVectorStorePath);

    // Cache vector storage for cleanup
    this.cachedVectorStorage = vectorStorage;

    // Create git indexer
    this.cachedGitIndexer = await this.factories.createGitIndexer({
      extractor,
      vectorStorage,
    });

    this.logger?.debug('Git history indexer initialized');

    return this.cachedGitIndexer;
  }

  /**
   * Get git extractor
   *
   * Useful for direct commit extraction without indexing.
   *
   * @returns Git extractor
   */
  async getExtractor(): Promise<GitExtractor> {
    return this.factories.createExtractor(this.repositoryPath);
  }

  /**
   * Search git history semantically
   *
   * @param query - Search query
   * @param options - Search options (limit, etc.)
   * @returns Search results
   */
  async search(query: string, options?: { limit?: number }): Promise<unknown[]> {
    const gitIndexer = await this.getGitIndexer();
    return gitIndexer.search(query, { limit: options?.limit ?? 10 });
  }

  /**
   * Get commits with optional filtering
   *
   * @param options - Filter options (author, since, file, etc.)
   * @returns Filtered commits
   */
  async getCommits(options?: {
    author?: string;
    since?: string;
    file?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const gitIndexer = await this.getGitIndexer();
    return gitIndexer.getCommits(options);
  }

  /**
   * Index git history
   *
   * @param options - Indexing options
   * @returns Index statistics
   */
  async index(options?: { since?: string; limit?: number }): Promise<unknown> {
    const gitIndexer = await this.getGitIndexer();
    return gitIndexer.index(options);
  }

  /**
   * Close and cleanup resources
   *
   * Should be called when done with git history operations.
   */
  async close(): Promise<void> {
    if (this.cachedVectorStorage) {
      await this.cachedVectorStorage.close();
      this.cachedVectorStorage = undefined;
    }
    this.cachedGitIndexer = undefined;
  }
}
