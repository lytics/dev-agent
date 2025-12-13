/**
 * Metrics Module
 *
 * Provides persistent storage for repository metrics and snapshots.
 */

export {
  type FileMetrics,
  getConcentratedOwnership,
  getFileMetrics,
  getFileTrend,
  getLargestFiles,
  getMostActive,
  getSnapshotSummary,
} from './analytics.js';
export { buildCodeMetadata } from './collector.js';
export { initializeDatabase, METRICS_SCHEMA_V1 } from './schema.js';
export { MetricsStore } from './store.js';
export type {
  CodeMetadata,
  CodeMetadataQuery,
  Hotspot,
  MetricsConfig,
  Snapshot,
  SnapshotQuery,
} from './types.js';
export {
  CodeMetadataSchema,
  DEFAULT_METRICS_CONFIG,
  HotspotSchema,
  SnapshotQuerySchema,
} from './types.js';
