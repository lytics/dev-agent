/**
 * Metrics Store Types
 *
 * Type definitions for the metrics storage system.
 */

import { z } from 'zod';
import type { DetailedIndexStats } from '../indexer/types.js';

/**
 * A single metrics snapshot
 */
export interface Snapshot {
  id: string;
  timestamp: Date;
  repositoryPath: string;
  stats: DetailedIndexStats;
  trigger: 'index' | 'update';
}

/**
 * Query parameters for retrieving snapshots
 */
export interface SnapshotQuery {
  /** Start date (inclusive) */
  since?: Date;

  /** End date (inclusive) */
  until?: Date;

  /** Maximum number of results (default: 100, max: 1000) */
  limit?: number;

  /** Filter by repository path */
  repositoryPath?: string;

  /** Filter by trigger type */
  trigger?: 'index' | 'update';
}

/**
 * Zod schema for validating snapshot queries
 */
export const SnapshotQuerySchema = z.object({
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  repositoryPath: z.string().optional(),
  trigger: z.enum(['index', 'update']).optional(),
});

/**
 * Metrics store configuration
 */
export interface MetricsConfig {
  /** Enable metrics collection (default: true) */
  enabled?: boolean;

  /** Retention period in days (default: 90) */
  retentionDays?: number;

  /** Maximum database size in MB (default: 100) */
  maxSizeMB?: number;
}

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: Required<MetricsConfig> = {
  enabled: true,
  retentionDays: 90,
  maxSizeMB: 100,
};

/**
 * Per-file code metadata for hotspot detection
 */
export interface CodeMetadata {
  filePath: string;
  commitCount?: number;
  lastModified?: Date;
  authorCount?: number;
  linesOfCode: number;
  numFunctions: number;
  numImports: number;
  riskScore?: number;
}

/**
 * Zod schema for code metadata
 */
export const CodeMetadataSchema = z.object({
  filePath: z.string().min(1),
  commitCount: z.number().int().nonnegative().optional(),
  lastModified: z.coerce.date().optional(),
  authorCount: z.number().int().positive().optional(),
  linesOfCode: z.number().int().nonnegative(),
  numFunctions: z.number().int().nonnegative(),
  numImports: z.number().int().nonnegative(),
  riskScore: z.number().nonnegative().optional(),
});

/**
 * Query parameters for retrieving code metadata
 */
export interface CodeMetadataQuery {
  /** Snapshot ID to query */
  snapshotId: string;

  /** Minimum risk score threshold */
  minRiskScore?: number;

  /** Maximum number of results (default: 100) */
  limit?: number;

  /** Sort order (default: 'risk_desc') */
  sortBy?: 'risk_desc' | 'risk_asc' | 'lines_desc' | 'commits_desc';
}

/**
 * Hotspot detection result
 */
export interface Hotspot {
  filePath: string;
  riskScore: number;
  commitCount: number;
  authorCount: number;
  linesOfCode: number;
  numFunctions: number;
  lastModified?: Date;
  reason: string; // Human-readable explanation
}

/**
 * Zod schema for hotspot results
 */
export const HotspotSchema = z.object({
  filePath: z.string(),
  riskScore: z.number().nonnegative(),
  commitCount: z.number().int().nonnegative(),
  authorCount: z.number().int().positive(),
  linesOfCode: z.number().int().nonnegative(),
  numFunctions: z.number().int().nonnegative(),
  lastModified: z.coerce.date().optional(),
  reason: z.string(),
});
