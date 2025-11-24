/**
 * GitHub Document Indexer
 * Indexes GitHub issues, PRs, and discussions for semantic search
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import type {
  GitHubContext,
  GitHubDocument,
  GitHubIndexOptions,
  GitHubIndexStats,
  GitHubSearchOptions,
  GitHubSearchResult,
} from './types';
import {
  calculateRelevance,
  enrichDocument,
  fetchAllDocuments,
  getCurrentRepository,
  matchesQuery,
} from './utils/index';

/**
 * GitHub Document Indexer
 * Stores GitHub documents and provides search functionality
 *
 * Note: Currently uses in-memory storage with text search.
 * Future: Integrate with VectorStorage for semantic search.
 */
export class GitHubIndexer {
  private codeIndexer: RepositoryIndexer;
  private repository: string;
  private documents: Map<string, GitHubDocument> = new Map();
  private lastIndexed?: Date;

  constructor(codeIndexer: RepositoryIndexer, repository?: string) {
    this.codeIndexer = codeIndexer;
    this.repository = repository || getCurrentRepository();
  }

  /**
   * Index all GitHub documents
   */
  async index(options: GitHubIndexOptions = {}): Promise<GitHubIndexStats> {
    const startTime = Date.now();

    // Fetch all documents from GitHub
    const documents = fetchAllDocuments({
      ...options,
      repository: options.repository || this.repository,
    });

    // Enrich with relationships
    const enrichedDocs = documents.map((doc) => enrichDocument(doc));

    // Store in memory
    this.documents.clear();
    for (const doc of enrichedDocs) {
      const key = `${doc.type}-${doc.number}`;
      this.documents.set(key, doc);
    }

    this.lastIndexed = new Date();

    // Calculate stats
    const byType = enrichedDocs.reduce(
      (acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byState = enrichedDocs.reduce(
      (acc, doc) => {
        acc[doc.state] = (acc[doc.state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      repository: this.repository,
      totalDocuments: enrichedDocs.length,
      byType: byType as Record<'issue' | 'pull_request' | 'discussion', number>,
      byState: byState as Record<'open' | 'closed' | 'merged', number>,
      lastIndexed: this.lastIndexed.toISOString(),
      indexDuration: Date.now() - startTime,
    };
  }

  /**
   * Search GitHub documents
   */
  async search(query: string, options: GitHubSearchOptions = {}): Promise<GitHubSearchResult[]> {
    const results: GitHubSearchResult[] = [];

    for (const doc of this.documents.values()) {
      // Filter by type
      if (options.type && doc.type !== options.type) continue;

      // Filter by state
      if (options.state && doc.state !== options.state) continue;

      // Filter by labels
      if (options.labels && options.labels.length > 0) {
        const hasLabel = options.labels.some((label) => doc.labels.includes(label));
        if (!hasLabel) continue;
      }

      // Filter by author
      if (options.author && doc.author !== options.author) continue;

      // Filter by date
      if (options.since) {
        const createdAt = new Date(doc.createdAt);
        const since = new Date(options.since);
        if (createdAt < since) continue;
      }

      if (options.until) {
        const createdAt = new Date(doc.createdAt);
        const until = new Date(options.until);
        if (createdAt > until) continue;
      }

      // Check if matches query
      if (!matchesQuery(doc, query)) continue;

      // Calculate relevance score
      const score = calculateRelevance(doc, query) / 100; // Normalize to 0-1

      // Apply score threshold
      if (options.scoreThreshold && score < options.scoreThreshold) continue;

      results.push({
        document: doc,
        score,
        matchedFields: ['title', 'body'],
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = options.limit || 10;
    return results.slice(0, limit);
  }

  /**
   * Get full context for an issue or PR
   */
  async getContext(
    number: number,
    type: 'issue' | 'pull_request' = 'issue'
  ): Promise<GitHubContext | null> {
    // Find the document
    const key = `${type}-${number}`;
    const document = this.documents.get(key);

    if (!document) {
      return null;
    }

    // Find related issues
    const relatedIssues: GitHubDocument[] = [];
    for (const issueNum of document.relatedIssues) {
      const related = this.documents.get(`issue-${issueNum}`);
      if (related) {
        relatedIssues.push(related);
      }
    }

    // Find related PRs
    const relatedPRs: GitHubDocument[] = [];
    for (const prNum of document.relatedPRs) {
      const related = this.documents.get(`pull_request-${prNum}`);
      if (related) {
        relatedPRs.push(related);
      }
    }

    // Find linked code files using the code indexer
    const linkedCodeFiles: Array<{
      path: string;
      reason: string;
      score: number;
    }> = [];

    for (const filePath of document.linkedFiles.slice(0, 10)) {
      try {
        const codeResults = await this.codeIndexer.search(filePath, {
          limit: 1,
          scoreThreshold: 0.3,
        });

        if (codeResults.length > 0) {
          const metadata = codeResults[0].metadata as { path?: string };
          linkedCodeFiles.push({
            path: metadata.path || filePath,
            reason: 'Mentioned in issue/PR',
            score: codeResults[0].score,
          });
        }
      } catch {
        // Ignore errors finding code files
      }
    }

    return {
      document,
      relatedIssues,
      relatedPRs,
      linkedCodeFiles,
    };
  }

  /**
   * Find related issues/PRs for a given number
   */
  async findRelated(
    number: number,
    type: 'issue' | 'pull_request' = 'issue'
  ): Promise<GitHubDocument[]> {
    const context = await this.getContext(number, type);
    if (!context) {
      return [];
    }

    return [...context.relatedIssues, ...context.relatedPRs];
  }

  /**
   * Get a specific document by number
   */
  getDocument(number: number, type: 'issue' | 'pull_request' = 'issue'): GitHubDocument | null {
    const key = `${type}-${number}`;
    return this.documents.get(key) || null;
  }

  /**
   * Get all indexed documents
   */
  getAllDocuments(): GitHubDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Check if indexer has been initialized
   */
  isIndexed(): boolean {
    return this.documents.size > 0;
  }

  /**
   * Get indexing statistics
   */
  getStats(): GitHubIndexStats | null {
    if (!this.lastIndexed) {
      return null;
    }

    const byType = Array.from(this.documents.values()).reduce(
      (acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byState = Array.from(this.documents.values()).reduce(
      (acc, doc) => {
        acc[doc.state] = (acc[doc.state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      repository: this.repository,
      totalDocuments: this.documents.size,
      byType: byType as Record<'issue' | 'pull_request' | 'discussion', number>,
      byState: byState as Record<'open' | 'closed' | 'merged', number>,
      lastIndexed: this.lastIndexed.toISOString(),
      indexDuration: 0,
    };
  }
}
