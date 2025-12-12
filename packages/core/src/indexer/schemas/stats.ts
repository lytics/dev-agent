/**
 * Zod schemas for indexer statistics
 * Provides runtime validation and type inference for all stats types
 */

import { z } from 'zod';

/**
 * Supported languages for detailed statistics
 */
export const SupportedLanguageSchema = z.enum(['typescript', 'javascript', 'go', 'markdown']);

/**
 * Statistics for a specific language
 */
export const LanguageStatsSchema = z.object({
  /** Number of files in this language */
  files: z.number().int().nonnegative(),

  /** Number of components extracted from this language */
  components: z.number().int().nonnegative(),

  /** Total lines of code (approximate from component ranges) */
  lines: z.number().int().nonnegative(),

  /** Average commits per file (change frequency) */
  avgCommitsPerFile: z.number().nonnegative().optional(),

  /** Most recently modified file timestamp */
  lastModified: z.coerce.date().optional(),
});

/**
 * Statistics for a package/module in a monorepo
 */
export const PackageStatsSchema = z.object({
  /** Package name (from package.json or go.mod) */
  name: z.string().min(1),

  /** Package path relative to repository root */
  path: z.string().min(1),

  /** Number of files in this package */
  files: z.number().int().nonnegative(),

  /** Number of components in this package */
  components: z.number().int().nonnegative(),

  /** Language breakdown within this package - Partial<Record> allows any subset of languages */
  languages: z.record(z.string(), z.number().int().nonnegative()),

  /** Total commits affecting this package */
  totalCommits: z.number().int().nonnegative().optional(),

  /** Most recently modified file timestamp */
  lastModified: z.coerce.date().optional(),
});

/**
 * Metadata about the freshness and source of statistics
 */
export const StatsMetadataSchema = z.object({
  /** Whether this is from an incremental update (vs full index) */
  isIncremental: z.boolean(),

  /** Timestamp of the last full index */
  lastFullIndex: z.coerce.date(),

  /** Timestamp of the last update (full or incremental) */
  lastUpdate: z.coerce.date(),

  /** Number of incremental updates since last full index */
  incrementalUpdatesSince: z.number().int().nonnegative(),

  /** Languages affected by this update (only set for incremental updates) */
  affectedLanguages: z.array(SupportedLanguageSchema).optional(),

  /** Warning message if stats may be stale */
  warning: z.string().optional(),
});

/**
 * Error during indexing
 */
export const IndexErrorSchema = z.object({
  /** Type of error */
  type: z.enum(['scanner', 'embedder', 'storage', 'filesystem']),

  /** File that caused the error (if applicable) */
  file: z.string().optional(),

  /** Error message */
  message: z.string(),

  /** Timestamp when error occurred */
  timestamp: z.coerce.date(),
});

/**
 * Base statistics from an indexing operation
 */
export const IndexStatsSchema = z.object({
  /** Number of files scanned */
  filesScanned: z.number().int().nonnegative(),

  /** Number of documents extracted */
  documentsExtracted: z.number().int().nonnegative(),

  /** Number of documents indexed (embedded + stored) */
  documentsIndexed: z.number().int().nonnegative(),

  /** Number of vectors stored */
  vectorsStored: z.number().int().nonnegative(),

  /** Duration in milliseconds */
  duration: z.number().nonnegative(),

  /** Errors encountered during indexing */
  errors: z.array(IndexErrorSchema),

  /** Timestamp when indexing started */
  startTime: z.coerce.date(),

  /** Timestamp when indexing completed */
  endTime: z.coerce.date(),

  /** Repository path that was indexed */
  repositoryPath: z.string().min(1),

  /** Metadata about stats freshness and source */
  statsMetadata: StatsMetadataSchema.optional(),
});

/**
 * Detailed statistics with language, component type, and package breakdowns
 */
export const DetailedIndexStatsSchema = IndexStatsSchema.extend({
  /** Statistics broken down by language - partial record allows any supported language */
  byLanguage: z.record(z.string(), LanguageStatsSchema).optional(),

  /** Statistics broken down by component type */
  byComponentType: z.record(z.string(), z.number().int().nonnegative()).optional(),

  /** Statistics broken down by package (for monorepos) */
  byPackage: z.record(z.string(), PackageStatsSchema).optional(),
});

/**
 * Metadata tracked for each indexed file
 */
export const FileMetadataSchema = z.object({
  /** File path relative to repository root */
  path: z.string().min(1),

  /** Content hash (for change detection) */
  hash: z.string().min(1),

  /** Last modified timestamp */
  lastModified: z.coerce.date(),

  /** Last indexed timestamp */
  lastIndexed: z.coerce.date(),

  /** Document IDs extracted from this file */
  documentIds: z.array(z.string()),

  /** File size in bytes */
  size: z.number().int().nonnegative(),

  /** Language detected */
  language: z.string().min(1),
});

/**
 * Indexer state persisted to disk
 */
export const IndexerStateSchema = z.object({
  /** Version of the indexer (for compatibility) */
  version: z.string().min(1),

  /** Embedding model used */
  embeddingModel: z.string().min(1),

  /** Embedding dimension */
  embeddingDimension: z.number().int().positive(),

  /** Repository path */
  repositoryPath: z.string().min(1),

  /** Last full index timestamp */
  lastIndexTime: z.coerce.date(),

  /** Last update timestamp (full or incremental) */
  lastUpdate: z.coerce.date().optional(),

  /** Number of incremental updates since last full index */
  incrementalUpdatesSince: z.number().int().nonnegative().optional(),

  /** File metadata map (path -> metadata) */
  files: z.record(z.string(), FileMetadataSchema),

  /** Total statistics */
  stats: z.object({
    totalFiles: z.number().int().nonnegative(),
    totalDocuments: z.number().int().nonnegative(),
    totalVectors: z.number().int().nonnegative(),
    byLanguage: z.record(z.string(), LanguageStatsSchema).optional(),
    byComponentType: z.record(z.string(), z.number().int().nonnegative()).optional(),
    byPackage: z.record(z.string(), PackageStatsSchema).optional(),
  }),
});

// Type inference from schemas
export type LanguageStats = z.infer<typeof LanguageStatsSchema>;
export type PackageStats = z.infer<typeof PackageStatsSchema>;
export type StatsMetadata = z.infer<typeof StatsMetadataSchema>;
export type IndexError = z.infer<typeof IndexErrorSchema>;
export type IndexStats = z.infer<typeof IndexStatsSchema>;
export type DetailedIndexStats = z.infer<typeof DetailedIndexStatsSchema>;
export type FileMetadata = z.infer<typeof FileMetadataSchema>;
export type IndexerState = z.infer<typeof IndexerStateSchema>;
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;
