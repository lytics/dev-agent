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
