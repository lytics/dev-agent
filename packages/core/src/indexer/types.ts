/**
 * Repository Indexer types
 */

import type { Logger } from '@lytics/kero';

/**
 * Options for indexing a repository
 */
export interface IndexOptions {
  /** Documents per embedding batch (default: 32) */
  batchSize?: number;

  /** Glob patterns to exclude (in addition to defaults) */
  excludePatterns?: string[];

  /** Limit to specific languages */
  languages?: string[];

  /** Force re-index even if unchanged (default: false) */
  force?: boolean;

  /** Progress callback for tracking indexing */
  onProgress?: (progress: IndexProgress) => void;

  /** Logger for progress and debug output */
  logger?: Logger;
}

/**
 * Options for incremental updates
 */
export interface UpdateOptions extends IndexOptions {
  /** Only reindex files modified after this timestamp */
  since?: Date;
}

/**
 * Progress information during indexing
 */
export interface IndexProgress {
  /** Current phase of indexing */
  phase: 'scanning' | 'embedding' | 'storing' | 'complete';

  /** Files processed so far */
  filesProcessed: number;

  /** Total files to process */
  totalFiles: number;

  /** Documents indexed so far */
  documentsIndexed: number;

  /** Total documents to index (available during storing phase) */
  totalDocuments?: number;

  /** Current file being processed */
  currentFile?: string;

  /** Percentage complete (0-100) */
  percentComplete: number;
}

/**
 * Metadata about the freshness and source of statistics
 */
export interface StatsMetadata {
  /** Whether this is from an incremental update (vs full index) */
  isIncremental: boolean;

  /** Timestamp of the last full index */
  lastFullIndex: Date;

  /** Timestamp of the last update (full or incremental) */
  lastUpdate: Date;

  /** Number of incremental updates since last full index */
  incrementalUpdatesSince: number;

  /** Languages affected by this update (only set for incremental updates) */
  affectedLanguages?: SupportedLanguage[];

  /** Warning message if stats may be stale */
  warning?: string;
}

/**
 * Statistics from an indexing operation
 */
export interface IndexStats {
  /** Number of files scanned */
  filesScanned: number;

  /** Number of documents extracted */
  documentsExtracted: number;

  /** Number of documents indexed (embedded + stored) */
  documentsIndexed: number;

  /** Number of vectors stored */
  vectorsStored: number;

  /** Duration in milliseconds */
  duration: number;

  /** Errors encountered during indexing */
  errors: IndexError[];

  /** Timestamp when indexing started */
  startTime: Date;

  /** Timestamp when indexing completed */
  endTime: Date;

  /** Repository path that was indexed */
  repositoryPath: string;

  /** Metadata about stats freshness and source */
  statsMetadata?: StatsMetadata;
}

/**
 * Error during indexing
 */
export interface IndexError {
  /** Type of error */
  type: 'scanner' | 'embedder' | 'storage' | 'filesystem';

  /** File that caused the error (if applicable) */
  file?: string;

  /** Error message */
  message: string;

  /** Original error object */
  error?: Error;

  /** Timestamp when error occurred */
  timestamp: Date;
}

/**
 * Supported languages for detailed statistics
 */
export type SupportedLanguage = 'typescript' | 'javascript' | 'go' | 'markdown';

/**
 * Statistics for a specific language
 */
export interface LanguageStats {
  /** Number of files in this language */
  files: number;

  /** Number of components extracted from this language */
  components: number;

  /** Total lines of code (approximate from component ranges) */
  lines: number;
}

/**
 * Statistics for a package/module in a monorepo
 */
export interface PackageStats {
  /** Package name (from package.json or go.mod) */
  name: string;

  /** Package path relative to repository root */
  path: string;

  /** Number of files in this package */
  files: number;

  /** Number of components in this package */
  components: number;

  /** Language breakdown within this package */
  languages: Partial<Record<SupportedLanguage, number>>;
}

/**
 * Detailed statistics with language, component type, and package breakdowns
 * Extends IndexStats with optional detailed information for backward compatibility
 */
export interface DetailedIndexStats extends IndexStats {
  /** Statistics broken down by language */
  byLanguage?: Partial<Record<SupportedLanguage, LanguageStats>>;

  /** Statistics broken down by component type */
  byComponentType?: Partial<Record<string, number>>;

  /** Statistics broken down by package (for monorepos) */
  byPackage?: Record<string, PackageStats>;
}

/**
 * Metadata tracked for each indexed file
 */
export interface FileMetadata {
  /** File path relative to repository root */
  path: string;

  /** Content hash (for change detection) */
  hash: string;

  /** Last modified timestamp */
  lastModified: Date;

  /** Last indexed timestamp */
  lastIndexed: Date;

  /** Document IDs extracted from this file */
  documentIds: string[];

  /** File size in bytes */
  size: number;

  /** Language detected */
  language: string;
}

/**
 * Indexer state persisted to disk
 */
export interface IndexerState {
  /** Version of the indexer (for compatibility) */
  version: string;

  /** Embedding model used */
  embeddingModel: string;

  /** Embedding dimension */
  embeddingDimension: number;

  /** Repository path */
  repositoryPath: string;

  /** Last full index timestamp */
  lastIndexTime: Date;

  /** Last update timestamp (full or incremental) */
  lastUpdate?: Date;

  /** Number of incremental updates since last full index */
  incrementalUpdatesSince?: number;

  /** File metadata map (path -> metadata) */
  files: Record<string, FileMetadata>;

  /** Total statistics */
  stats: {
    totalFiles: number;
    totalDocuments: number;
    totalVectors: number;
    byLanguage?: Partial<Record<SupportedLanguage, LanguageStats>>;
    byComponentType?: Partial<Record<string, number>>;
    byPackage?: Record<string, PackageStats>;
  };
}

/**
 * Configuration for the Repository Indexer
 */
export interface IndexerConfig {
  /** Path to the repository to index */
  repositoryPath: string;

  /** Path to store vector data */
  vectorStorePath: string;

  /** Path to store indexer state (default: .dev-agent/indexer-state.json) */
  statePath?: string;

  /** Embedding model to use (default: Xenova/all-MiniLM-L6-v2) */
  embeddingModel?: string;

  /** Embedding dimension (default: 384) */
  embeddingDimension?: number;

  /** Batch size for embedding generation (default: 32) */
  batchSize?: number;

  /** Glob patterns to exclude */
  excludePatterns?: string[];

  /** Languages to index (default: all supported) */
  languages?: string[];
}
