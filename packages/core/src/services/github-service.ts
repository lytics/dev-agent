/**
 * GitHub Service
 *
 * Shared service for GitHub operations (issues, PRs, indexing).
 * Used by MCP GitHub adapter and CLI gh commands.
 */

import type {
  GitHubDocument,
  GitHubIndexerInstance,
  GitHubIndexOptions,
  GitHubIndexStats,
  GitHubSearchOptions,
  GitHubSearchResult,
} from '@lytics/dev-agent-types/github';
import type { Logger } from '@lytics/kero';

export interface GitHubServiceConfig {
  repositoryPath: string;
  logger?: Logger;
}

// Generic indexer interface to avoid importing the actual GitHubIndexer class
export type GitHubIndexerFactory = (config: {
  vectorStorePath: string;
  statePath: string;
  autoUpdate?: boolean;
  staleThreshold?: number;
  logger?: Logger;
}) => Promise<GitHubIndexerInstance>;

export class GitHubService {
  private readonly repositoryPath: string;
  private readonly logger?: Logger;
  private readonly githubIndexerFactory: GitHubIndexerFactory;
  private githubIndexer: GitHubIndexerInstance | null = null;

  constructor(config: GitHubServiceConfig, githubIndexerFactory: GitHubIndexerFactory) {
    this.repositoryPath = config.repositoryPath;
    this.logger = config.logger;
    this.githubIndexerFactory = githubIndexerFactory;
  }

  private async getIndexer(): Promise<GitHubIndexerInstance> {
    if (this.githubIndexer) {
      return this.githubIndexer;
    }

    const { getStoragePath, getStorageFilePaths } = await import('../storage/path.js');
    const storagePath = await getStoragePath(this.repositoryPath);
    const filePaths = getStorageFilePaths(storagePath);
    const vectorStorePath = `${filePaths.vectors}-github`;

    this.githubIndexer = await this.githubIndexerFactory({
      vectorStorePath,
      statePath: filePaths.githubState,
      autoUpdate: true,
      staleThreshold: 15 * 60 * 1000, // 15 minutes
      logger: this.logger,
    });
    await this.githubIndexer.initialize();
    return this.githubIndexer;
  }

  async index(options?: GitHubIndexOptions): Promise<GitHubIndexStats> {
    const indexer = await this.getIndexer();
    try {
      const stats = await indexer.index(options);
      return stats;
    } catch (error) {
      this.logger?.error({ error }, 'GitHub indexing failed');
      throw error;
    }
  }

  async search(query: string, options?: GitHubSearchOptions): Promise<GitHubSearchResult[]> {
    const indexer = await this.getIndexer();
    try {
      return await indexer.search(query, options);
    } catch (error) {
      this.logger?.error({ error }, 'GitHub search failed');
      return [];
    }
  }

  async getContext(issueNumber: number): Promise<GitHubDocument | null> {
    const indexer = await this.getIndexer();
    try {
      const results = await indexer.search(String(issueNumber), { limit: 1 });
      // Find exact match by issue number
      const exactMatch = results.find((r) => r.document?.number === issueNumber);
      return exactMatch?.document || null;
    } catch (error) {
      this.logger?.error({ error }, `Failed to get GitHub context for issue ${issueNumber}`);
      return null;
    }
  }

  async findRelated(issueNumber: number, limit = 5): Promise<GitHubSearchResult[]> {
    const indexer = await this.getIndexer();
    try {
      const contextDoc = await this.getContext(issueNumber);
      if (!contextDoc) {
        return [];
      }
      // Search for similar issues using title as query
      const results = await indexer.search(contextDoc.title, { limit: limit + 1 });
      // Filter out the original issue and return search results with real scores
      return results
        .filter((r: GitHubSearchResult) => r.document.number !== issueNumber)
        .slice(0, limit);
    } catch (error) {
      this.logger?.error({ error }, `Failed to find related GitHub items for issue ${issueNumber}`);
      return [];
    }
  }

  async getStats(): Promise<GitHubIndexStats | null> {
    const indexer = await this.getIndexer();
    try {
      return indexer.getStats();
    } catch (error) {
      this.logger?.error({ error }, 'Failed to get GitHub index stats');
      return null;
    }
  }

  async isIndexed(): Promise<boolean> {
    try {
      const indexer = await this.getIndexer();
      const stats = await indexer.getStats();
      return stats !== null && stats.totalDocuments > 0;
    } catch (error) {
      this.logger?.debug({ error }, 'GitHub repository not indexed or error during check');
      return false;
    }
  }

  /**
   * Shutdown the GitHub service and close the indexer
   */
  async shutdown(): Promise<void> {
    if (this.githubIndexer) {
      await this.githubIndexer.close();
      this.githubIndexer = null;
    }
  }
}
