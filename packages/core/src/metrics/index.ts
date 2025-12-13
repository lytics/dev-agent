/**
 * Metrics Module
 *
 * Provides persistent storage for repository metrics and snapshots.
 */

export { initializeDatabase, METRICS_SCHEMA_V1 } from './schema.js';
export { MetricsStore } from './store.js';
export type {
  MetricsConfig,
  Snapshot,
  SnapshotQuery,
} from './types.js';
export {
  DEFAULT_METRICS_CONFIG,
  SnapshotQuerySchema,
} from './types.js';
