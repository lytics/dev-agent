/**
 * Metrics Service
 *
 * Shared service for querying analytics and metrics.
 * Used by both MCP adapters and Dashboard API routes.
 */

import type { Logger } from '@lytics/kero';
import type { FileMetrics } from '../metrics/analytics.js';
import type { MetricsStore } from '../metrics/store.js';
import type { CodeMetadata, Snapshot, SnapshotQuery } from '../metrics/types.js';

export interface MetricsServiceConfig {
  repositoryPath: string;
  logger?: Logger;
}

/**
 * Factory function for creating MetricsStore instances
 */
export type MetricsStoreFactory = (path: string, logger?: Logger) => MetricsStore;

/**
 * Service for querying metrics and analytics
 *
 * Encapsulates metrics store access and analytics queries.
 * Ensures consistent behavior across MCP and Dashboard.
 */
export class MetricsService {
  private repositoryPath: string;
  private logger?: Logger;
  private createStore: MetricsStoreFactory;

  constructor(config: MetricsServiceConfig, createStore?: MetricsStoreFactory) {
    this.repositoryPath = config.repositoryPath;
    this.logger = config.logger;

    // Use provided factory or default implementation
    this.createStore = createStore || this.defaultStoreFactory.bind(this);
  }

  /**
   * Default factory that creates a real MetricsStore
   */
  private defaultStoreFactory(path: string, logger?: Logger): MetricsStore {
    const { MetricsStore: Store } = require('../metrics/store.js');
    return new Store(path, logger);
  }

  /**
   * Get metrics store for this repository
   */
  private async getStore(): Promise<MetricsStore> {
    const { getStoragePath, getStorageFilePaths } = await import('../storage/path.js');
    const storagePath = await getStoragePath(this.repositoryPath);
    const filePaths = getStorageFilePaths(storagePath);
    return this.createStore(filePaths.metrics, this.logger);
  }

  /**
   * Get most active files by commit count
   */
  async getMostActive(limit = 10): Promise<FileMetrics[]> {
    const store = await this.getStore();
    try {
      const { getMostActive } = await import('../metrics/analytics.js');
      const latest = store.getLatestSnapshot(this.repositoryPath);
      if (!latest) {
        return [];
      }
      return getMostActive(store, latest.id, limit);
    } finally {
      store.close();
    }
  }

  /**
   * Get largest files by LOC
   */
  async getLargestFiles(limit = 10): Promise<FileMetrics[]> {
    const store = await this.getStore();
    try {
      const { getLargestFiles } = await import('../metrics/analytics.js');
      const latest = store.getLatestSnapshot(this.repositoryPath);
      if (!latest) {
        return [];
      }
      return getLargestFiles(store, latest.id, limit);
    } finally {
      store.close();
    }
  }

  /**
   * Get files with concentrated ownership
   */
  async getConcentratedOwnership(limit = 10): Promise<FileMetrics[]> {
    const store = await this.getStore();
    try {
      const { getConcentratedOwnership } = await import('../metrics/analytics.js');
      const latest = store.getLatestSnapshot(this.repositoryPath);
      if (!latest) {
        return [];
      }
      return getConcentratedOwnership(store, latest.id, limit);
    } finally {
      store.close();
    }
  }

  /**
   * Get file trend history
   */
  async getFileTrend(filePath: string, limit = 10): Promise<CodeMetadata[]> {
    const store = await this.getStore();
    try {
      const { getFileTrend } = await import('../metrics/analytics.js');
      return getFileTrend(store, filePath, limit);
    } finally {
      store.close();
    }
  }

  /**
   * Get snapshot summary statistics
   */
  async getSummary(): Promise<ReturnType<
    typeof import('../metrics/analytics.js').getSnapshotSummary
  > | null> {
    const store = await this.getStore();
    try {
      const { getSnapshotSummary } = await import('../metrics/analytics.js');
      const latest = store.getLatestSnapshot(this.repositoryPath);
      if (!latest) {
        return null;
      }
      return getSnapshotSummary(store, latest.id);
    } finally {
      store.close();
    }
  }

  /**
   * Query historical snapshots
   */
  async getSnapshots(query: SnapshotQuery): Promise<Snapshot[]> {
    const store = await this.getStore();
    try {
      return store.getSnapshots({
        ...query,
        repositoryPath: query.repositoryPath || this.repositoryPath,
      });
    } finally {
      store.close();
    }
  }

  /**
   * Get latest snapshot
   */
  async getLatestSnapshot(): Promise<Snapshot | null> {
    const store = await this.getStore();
    try {
      return store.getLatestSnapshot(this.repositoryPath);
    } finally {
      store.close();
    }
  }
}
