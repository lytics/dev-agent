/**
 * GitHub Document Indexer
 * Indexes GitHub issues, PRs, and discussions for semantic search
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { VectorStorage } from '@lytics/dev-agent-core';
import type {
  GitHubContext,
  GitHubDocument,
  GitHubIndexerConfig,
  GitHubIndexerState,
  GitHubIndexOptions,
  GitHubIndexStats,
  GitHubSearchOptions,
  GitHubSearchResult,
} from './types';
import { enrichDocument, fetchAllDocuments, getCurrentRepository } from './utils/index';

const INDEXER_VERSION = '1.0.0';
const DEFAULT_STATE_PATH = '.dev-agent/github-state.json';
const DEFAULT_STALE_THRESHOLD = 15 * 60 * 1000; // 15 minutes

/**
 * GitHub Document Indexer
 * Stores GitHub documents and provides semantic search functionality
 *
 * Uses VectorStorage for persistent semantic search and maintains state for incremental updates.
 */
export class GitHubIndexer {
  private vectorStorage: VectorStorage;
  private repository: string;
  private state: GitHubIndexerState | null = null;
  private readonly config: Required<GitHubIndexerConfig>;
  private readonly statePath: string;

  constructor(config: GitHubIndexerConfig, repository?: string) {
    this.repository = repository || getCurrentRepository();

    // Set defaults
    this.config = {
      autoUpdate: true,
      staleThreshold: DEFAULT_STALE_THRESHOLD,
      statePath: DEFAULT_STATE_PATH,
      ...config,
    };

    // Resolve state path relative to current working directory
    // This works correctly when CLI is run from repo root
    const repoRoot = process.cwd();
    this.statePath = path.isAbsolute(this.config.statePath)
      ? this.config.statePath
      : path.join(repoRoot, this.config.statePath);

    // Initialize vector storage
    this.vectorStorage = new VectorStorage({
      storePath: this.config.vectorStorePath,
    });
  }

  /**
   * Initialize the indexer (load state and vector storage)
   */
  async initialize(): Promise<void> {
    await this.vectorStorage.initialize();
    await this.loadState();
  }

  /**
   * Close the indexer and cleanup resources
   */
  async close(): Promise<void> {
    await this.vectorStorage.close();
  }

  /**
   * Index all GitHub documents
   */
  async index(options: GitHubIndexOptions = {}): Promise<GitHubIndexStats> {
    const startTime = Date.now();
    const onProgress = options.onProgress;
    const logger = options.logger?.child({ component: 'github-indexer' });

    logger?.info(
      { repository: options.repository || this.repository },
      'Starting GitHub data fetch'
    );

    // Phase 1: Fetch all documents from GitHub
    onProgress?.({
      phase: 'fetching',
      documentsProcessed: 0,
      totalDocuments: 0,
      percentComplete: 0,
    });

    const documents = fetchAllDocuments({
      ...options,
      repository: options.repository || this.repository,
    });

    logger?.info({ documents: documents.length }, 'Fetched GitHub documents');

    // Phase 2: Enrich with relationships
    onProgress?.({
      phase: 'enriching',
      documentsProcessed: 0,
      totalDocuments: documents.length,
      percentComplete: 25,
    });

    logger?.debug({ documents: documents.length }, 'Enriching documents with relationships');
    const enrichedDocs = documents.map((doc) => enrichDocument(doc));

    // Calculate stats by type
    const byType = enrichedDocs.reduce(
      (acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    logger?.info(
      { issues: byType.issue || 0, prs: byType.pull_request || 0 },
      'Document breakdown'
    );

    // Phase 3: Convert and embed
    onProgress?.({
      phase: 'embedding',
      documentsProcessed: 0,
      totalDocuments: enrichedDocs.length,
      percentComplete: 50,
    });

    logger?.info({ documents: enrichedDocs.length }, 'Starting GitHub embedding');

    // Convert to vector storage format
    const vectorDocs = enrichedDocs.map((doc) => ({
      id: `${doc.type}-${doc.number}`,
      text: `${doc.title}\n\n${doc.body}`, // Use 'text' not 'content'
      metadata: {
        type: doc.type,
        number: doc.number,
        title: doc.title,
        state: doc.state,
        author: doc.author,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        url: doc.url,
        labels: doc.labels,
        repository: this.repository,
        // Store full document as JSON
        document: JSON.stringify(doc),
      },
    }));

    // Store in vector storage
    // Note: LanceDB doesn't support clearing, so we just add new documents
    // Duplicates are handled by ID (overwrites existing)
    await this.vectorStorage.addDocuments(vectorDocs);

    // Phase 4: Complete
    onProgress?.({
      phase: 'complete',
      documentsProcessed: enrichedDocs.length,
      totalDocuments: enrichedDocs.length,
      percentComplete: 100,
    });

    const byState = enrichedDocs.reduce(
      (acc, doc) => {
        acc[doc.state] = (acc[doc.state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate states per type for accurate reporting
    const issuesByState = { open: 0, closed: 0 };
    const prsByState = { open: 0, closed: 0, merged: 0 };

    for (const doc of enrichedDocs) {
      if (doc.type === 'issue') {
        if (doc.state === 'open') issuesByState.open++;
        else if (doc.state === 'closed') issuesByState.closed++;
      } else if (doc.type === 'pull_request') {
        if (doc.state === 'open') prsByState.open++;
        else if (doc.state === 'closed') prsByState.closed++;
        else if (doc.state === 'merged') prsByState.merged++;
      }
    }

    // Update state
    this.state = {
      version: INDEXER_VERSION,
      repository: this.repository,
      lastIndexed: new Date().toISOString(),
      totalDocuments: enrichedDocs.length,
      byType: byType as Record<'issue' | 'pull_request' | 'discussion', number>,
      byState: byState as Record<'open' | 'closed' | 'merged', number>,
      issuesByState,
      prsByState,
    };

    // Save state to disk
    await this.saveState();

    const durationMs = Date.now() - startTime;
    logger?.info(
      { documents: enrichedDocs.length, duration: `${durationMs}ms` },
      'GitHub indexing complete'
    );

    return {
      repository: this.repository,
      totalDocuments: enrichedDocs.length,
      byType: byType as Record<'issue' | 'pull_request' | 'discussion', number>,
      byState: byState as Record<'open' | 'closed' | 'merged', number>,
      issuesByState,
      prsByState,
      lastIndexed: this.state.lastIndexed,
      indexDuration: durationMs,
    };
  }

  /**
   * Search GitHub documents
   */
  async search(query: string, options: GitHubSearchOptions = {}): Promise<GitHubSearchResult[]> {
    // Auto-update if stale
    if (this.config.autoUpdate && this.isStale()) {
      // Background update (non-blocking)
      this.index({ since: this.state?.lastIndexed }).catch((err) => {
        console.warn('Background update failed:', err);
      });
    }

    // Check if indexed
    if (!this.state) {
      throw new Error('GitHub data not indexed. Run "dev gh index" first.');
    }

    // Semantic search using vector storage
    const vectorResults = await this.vectorStorage.search(query, {
      limit: options.limit || 10,
    });

    // Convert back to GitHubSearchResult format and apply filters
    const results: GitHubSearchResult[] = [];
    const seenIds = new Set<string>();

    for (const result of vectorResults) {
      const doc = JSON.parse(result.metadata.document as string) as GitHubDocument;

      // Deduplicate by document ID
      const docId = `${doc.type}-${doc.number}`;
      if (seenIds.has(docId)) continue;
      seenIds.add(docId);

      // Apply filters
      if (options.type && doc.type !== options.type) continue;
      if (options.state && doc.state !== options.state) continue;
      if (options.author && doc.author !== options.author) continue;

      if (options.labels && options.labels.length > 0) {
        const hasLabel = options.labels.some((label) => doc.labels.includes(label));
        if (!hasLabel) continue;
      }

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

      if (options.scoreThreshold && result.score < options.scoreThreshold) continue;

      results.push({
        document: doc,
        score: result.score,
        matchedFields: ['title', 'body'],
      });
    }

    return results;
  }

  /**
   * Check if indexed data is stale
   */
  private isStale(): boolean {
    if (!this.state?.lastIndexed) return true;

    const lastIndexedTime = new Date(this.state.lastIndexed).getTime();
    const now = Date.now();
    return now - lastIndexedTime > this.config.staleThreshold;
  }

  /**
   * Get full context for an issue or PR
   */
  async getContext(
    number: number,
    type: 'issue' | 'pull_request' = 'issue'
  ): Promise<GitHubContext | null> {
    // Find the document
    const document = await this.getDocument(number, type);

    if (!document) {
      return null;
    }

    // Find related issues
    const relatedIssues: GitHubDocument[] = [];
    for (const issueNum of document.relatedIssues) {
      const related = await this.getDocument(issueNum, 'issue');
      if (related) {
        relatedIssues.push(related);
      }
    }

    // Find related PRs
    const relatedPRs: GitHubDocument[] = [];
    for (const prNum of document.relatedPRs) {
      const related = await this.getDocument(prNum, 'pull_request');
      if (related) {
        relatedPRs.push(related);
      }
    }

    // Find linked code files (skip for now - requires RepositoryIndexer integration)
    const linkedCodeFiles: Array<{
      path: string;
      reason: string;
      score: number;
    }> = [];

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
  async getDocument(
    number: number,
    type: 'issue' | 'pull_request' = 'issue'
  ): Promise<GitHubDocument | null> {
    const id = `${type}-${number}`;

    try {
      // Use exact ID lookup instead of semantic search
      const result = await this.vectorStorage.getDocument(id);
      if (!result) return null;

      return JSON.parse(result.metadata.document as string) as GitHubDocument;
    } catch {
      return null;
    }
  }

  /**
   * Get all indexed documents
   */
  async getAllDocuments(): Promise<GitHubDocument[]> {
    // This is expensive - avoid using if possible
    // For now, return empty array and recommend using search instead
    console.warn('getAllDocuments() is expensive - use search() instead');
    return [];
  }

  /**
   * Check if indexer has been initialized
   */
  isIndexed(): boolean {
    return this.state !== null;
  }

  /**
   * Get indexing statistics
   */
  getStats(): GitHubIndexStats | null {
    if (!this.state) {
      return null;
    }

    return {
      repository: this.repository,
      totalDocuments: this.state.totalDocuments,
      byType: this.state.byType,
      byState: this.state.byState,
      issuesByState: this.state.issuesByState,
      prsByState: this.state.prsByState,
      lastIndexed: this.state.lastIndexed,
      indexDuration: 0,
    };
  }

  /**
   * Load indexer state from disk
   */
  private async loadState(): Promise<void> {
    try {
      const stateContent = await fs.readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(stateContent);

      // Validate version compatibility
      if (this.state?.version !== INDEXER_VERSION) {
        console.warn(`State version mismatch: ${this.state?.version} !== ${INDEXER_VERSION}`);
        this.state = null;
      }
    } catch {
      // State file doesn't exist or is corrupted
      this.state = null;
    }
  }

  /**
   * Save indexer state to disk
   */
  private async saveState(): Promise<void> {
    if (!this.state) {
      return;
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });

    // Write state
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }
}
