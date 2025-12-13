/**
 * Metrics Module
 *
 * Provides persistent storage for repository metrics and snapshots.
 */

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
