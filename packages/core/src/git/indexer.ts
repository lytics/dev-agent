/**
 * Git Indexer
 *
 * Indexes git commits into the vector store for semantic search.
 */

import type { VectorStorage } from '../vector';
import type { EmbeddingDocument } from '../vector/types';
import type { GitExtractor } from './extractor';
import type { GetCommitsOptions, GitCommit, GitIndexResult } from './types';

/**
 * Configuration for the git indexer
 */
export interface GitIndexerConfig {
  /** Git extractor instance */
  extractor: GitExtractor;
  /** Vector storage instance */
  vectorStorage: VectorStorage;
  /** Maximum commits to index (default: 1000) */
  commitLimit?: number;
  /** Batch size for embedding (default: 32) */
  batchSize?: number;
}

/**
 * Options for indexing git commits
 */
export interface GitIndexOptions {
  /** Maximum commits to index (overrides config) */
  limit?: number;
  /** Only index commits after this date */
  since?: string;
  /** Only index commits before this date */
  until?: string;
  /** Filter by author email */
  author?: string;
  /** Exclude merge commits (default: true) */
  noMerges?: boolean;
  /** Progress callback */
  onProgress?: (progress: GitIndexProgress) => void;
}

/**
 * Progress information for git indexing
 */
export interface GitIndexProgress {
  phase: 'extracting' | 'embedding' | 'storing' | 'complete';
  commitsProcessed: number;
  totalCommits: number;
  percentComplete: number;
}

/**
 * Document type marker for commits
 */
const COMMIT_DOC_TYPE = 'commit';

/**
 * Git Indexer - indexes commits for semantic search
 */
export class GitIndexer {
  private readonly extractor: GitExtractor;
  private readonly vectorStorage: VectorStorage;
  private readonly commitLimit: number;
  private readonly batchSize: number;

  constructor(config: GitIndexerConfig) {
    this.extractor = config.extractor;
    this.vectorStorage = config.vectorStorage;
    this.commitLimit = config.commitLimit ?? 1000;
    this.batchSize = config.batchSize ?? 32;
  }

  /**
   * Index git commits into the vector store
   */
  async index(options: GitIndexOptions = {}): Promise<GitIndexResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    const limit = options.limit ?? this.commitLimit;
    const onProgress = options.onProgress;

    // Phase 1: Extract commits
    onProgress?.({
      phase: 'extracting',
      commitsProcessed: 0,
      totalCommits: 0,
      percentComplete: 0,
    });

    const extractOptions: GetCommitsOptions = {
      limit,
      since: options.since,
      until: options.until,
      author: options.author,
      noMerges: options.noMerges ?? true,
    };

    let commits: GitCommit[];
    try {
      commits = await this.extractor.getCommits(extractOptions);
    } catch (error) {
      const message = `Failed to extract commits: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      return {
        commitsIndexed: 0,
        durationMs: Date.now() - startTime,
        errors,
      };
    }

    if (commits.length === 0) {
      onProgress?.({
        phase: 'complete',
        commitsProcessed: 0,
        totalCommits: 0,
        percentComplete: 100,
      });
      return {
        commitsIndexed: 0,
        durationMs: Date.now() - startTime,
        errors,
      };
    }

    // Phase 2: Prepare documents for embedding
    onProgress?.({
      phase: 'embedding',
      commitsProcessed: 0,
      totalCommits: commits.length,
      percentComplete: 25,
    });

    const documents = this.prepareCommitDocuments(commits);

    // Phase 3: Store in batches
    onProgress?.({
      phase: 'storing',
      commitsProcessed: 0,
      totalCommits: commits.length,
      percentComplete: 50,
    });

    let commitsIndexed = 0;
    for (let i = 0; i < documents.length; i += this.batchSize) {
      const batch = documents.slice(i, i + this.batchSize);

      try {
        await this.vectorStorage.addDocuments(batch);
        commitsIndexed += batch.length;

        onProgress?.({
          phase: 'storing',
          commitsProcessed: commitsIndexed,
          totalCommits: commits.length,
          percentComplete: 50 + (commitsIndexed / commits.length) * 50,
        });
      } catch (error) {
        const message = `Failed to store batch ${i / this.batchSize}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(message);
      }
    }

    // Phase 4: Complete
    onProgress?.({
      phase: 'complete',
      commitsProcessed: commitsIndexed,
      totalCommits: commits.length,
      percentComplete: 100,
    });

    return {
      commitsIndexed,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Search for commits by semantic query
   */
  async search(
    query: string,
    options: { limit?: number; scoreThreshold?: number } = {}
  ): Promise<GitCommit[]> {
    const results = await this.vectorStorage.search(query, {
      limit: options.limit ?? 10,
      scoreThreshold: options.scoreThreshold ?? 0,
      filter: { type: COMMIT_DOC_TYPE },
    });

    // Extract commits from metadata
    return results
      .map((result) => {
        const commit = result.metadata._commit as GitCommit | undefined;
        if (!commit) return null;
        return commit;
      })
      .filter((c): c is GitCommit => c !== null);
  }

  /**
   * Get commits for a specific file
   */
  async getFileHistory(filePath: string, options: { limit?: number } = {}): Promise<GitCommit[]> {
    // Use the extractor directly for file-specific history
    return this.extractor.getCommits({
      path: filePath,
      limit: options.limit ?? 20,
      follow: true,
      noMerges: true,
    });
  }

  /**
   * Get commit count in the index
   */
  async getIndexedCommitCount(): Promise<number> {
    // Search with a broad query to count commits
    // This is approximate - ideally we'd have a filter count method
    const results = await this.vectorStorage.search('commit', {
      limit: 10000,
      filter: { type: COMMIT_DOC_TYPE },
    });
    return results.length;
  }

  /**
   * Prepare commit documents for embedding
   */
  private prepareCommitDocuments(commits: GitCommit[]): EmbeddingDocument[] {
    return commits.map((commit) => {
      // Create a rich text representation for embedding
      const textParts = [
        commit.subject,
        commit.body,
        // Include file paths for context
        commit.files
          .map((f) => f.path)
          .join(' '),
      ].filter(Boolean);

      const text = textParts.join('\n\n');

      // Create unique ID from commit hash
      const id = `commit:${commit.hash}`;

      return {
        id,
        text,
        metadata: {
          type: COMMIT_DOC_TYPE,
          hash: commit.hash,
          shortHash: commit.shortHash,
          subject: commit.subject,
          author: commit.author.name,
          authorEmail: commit.author.email,
          date: commit.author.date,
          filesChanged: commit.stats.filesChanged,
          additions: commit.stats.additions,
          deletions: commit.stats.deletions,
          issueRefs: commit.refs.issueRefs,
          prRefs: commit.refs.prRefs,
          // Store full commit for retrieval
          _commit: commit,
        },
      };
    });
  }
}

/**
 * Create a git indexer with default configuration
 */
export function createGitIndexer(
  repositoryPath: string,
  vectorStorage: VectorStorage,
  options: Partial<GitIndexerConfig> = {}
): GitIndexer {
  // Import dynamically to avoid circular dependency
  const { LocalGitExtractor } = require('./extractor') as {
    LocalGitExtractor: typeof import('./extractor').LocalGitExtractor;
  };

  const extractor = new LocalGitExtractor(repositoryPath);

  return new GitIndexer({
    extractor,
    vectorStorage,
    ...options,
  });
}
