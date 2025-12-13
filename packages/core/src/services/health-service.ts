/**
 * Health Service
 *
 * Shared service for component health checks.
 * Used by both MCP health adapter and Dashboard health API.
 */

import type { Logger } from '@lytics/kero';
import type { RepositoryIndexer } from '../indexer/index.js';
import type { MetricsStore } from '../metrics/store.js';
import type { VectorStorage } from '../vector/index.js';

export interface ComponentHealth {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    indexer: ComponentHealth;
    vectorStorage: ComponentHealth;
    metricsStore: ComponentHealth;
  };
}

export interface HealthServiceConfig {
  repositoryPath: string;
  logger?: Logger;
}

/**
 * Config types for component factories
 */
export interface IndexerFactoryConfig {
  repositoryPath: string;
  vectorStorePath: string;
  statePath: string;
  logger?: Logger;
}

export interface VectorStorageFactoryConfig {
  storePath: string;
  embeddingModel: string;
  dimension: number;
}

/**
 * Factory functions for creating component instances
 */
export interface HealthServiceFactories {
  createIndexer?: (config: IndexerFactoryConfig) => Promise<RepositoryIndexer>;
  createVectorStorage?: (config: VectorStorageFactoryConfig) => Promise<VectorStorage>;
  createMetricsStore?: (path: string, logger?: Logger) => MetricsStore;
}

/**
 * Service for checking component health
 *
 * Runs health checks on indexer, vector storage, and metrics store.
 * Returns structured health information.
 */
export class HealthService {
  private repositoryPath: string;
  private logger?: Logger;
  private factories: Required<HealthServiceFactories>;

  constructor(config: HealthServiceConfig, factories?: HealthServiceFactories) {
    this.repositoryPath = config.repositoryPath;
    this.logger = config.logger;

    // Use provided factories or defaults
    this.factories = {
      createIndexer: factories?.createIndexer || this.defaultIndexerFactory.bind(this),
      createVectorStorage:
        factories?.createVectorStorage || this.defaultVectorStorageFactory.bind(this),
      createMetricsStore:
        factories?.createMetricsStore || this.defaultMetricsStoreFactory.bind(this),
    };
  }

  /**
   * Default factory implementations
   */
  private async defaultIndexerFactory(config: IndexerFactoryConfig): Promise<RepositoryIndexer> {
    const { RepositoryIndexer: Indexer } = await import('../indexer/index.js');
    return new Indexer({
      repositoryPath: config.repositoryPath,
      vectorStorePath: config.vectorStorePath,
      statePath: config.statePath,
      logger: config.logger,
    });
  }

  private async defaultVectorStorageFactory(
    config: VectorStorageFactoryConfig
  ): Promise<VectorStorage> {
    const { VectorStorage: Storage } = await import('../vector/index.js');
    return new Storage({
      storePath: config.storePath,
      embeddingModel: config.embeddingModel,
      dimension: config.dimension,
    });
  }

  private defaultMetricsStoreFactory(path: string, logger?: Logger): MetricsStore {
    const { MetricsStore: Store } = require('../metrics/store.js');
    return new Store(path, logger);
  }

  /**
   * Run comprehensive health checks
   *
   * Checks all components in parallel for performance.
   *
   * @returns Health check results
   */
  async check(): Promise<HealthCheckResult> {
    const { getStoragePath, getStorageFilePaths } = await import('../storage/path.js');
    const storagePath = await getStoragePath(this.repositoryPath);
    const filePaths = getStorageFilePaths(storagePath);

    // Run checks in parallel
    const [indexer, vectorStorage, metricsStore] = await Promise.all([
      this.checkIndexer(filePaths),
      this.checkVectorStorage(filePaths),
      this.checkMetricsStore(filePaths),
    ]);

    // Determine overall status
    const hasError = [indexer, vectorStorage, metricsStore].some((c) => c.status === 'error');
    const hasWarning = [indexer, vectorStorage, metricsStore].some((c) => c.status === 'warning');

    const overallStatus = hasError ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date(),
      checks: {
        indexer,
        vectorStorage,
        metricsStore,
      },
    };
  }

  private async checkIndexer(filePaths: {
    vectors: string;
    indexerState: string;
    [key: string]: string;
  }): Promise<ComponentHealth> {
    try {
      const indexer = await this.factories.createIndexer({
        repositoryPath: this.repositoryPath,
        vectorStorePath: filePaths.vectors,
        statePath: filePaths.indexerState,
        logger: this.logger,
      });

      await indexer.initialize();
      const stats = await indexer.getStats();
      await indexer.close();

      if (!stats) {
        return {
          status: 'error',
          message: 'Repository not indexed',
        };
      }

      return {
        status: 'ok',
        details: {
          totalFiles: stats.filesScanned,
          totalDocuments: stats.documentsIndexed,
          lastIndexed: stats.endTime.toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Indexer check failed',
      };
    }
  }

  private async checkVectorStorage(filePaths: {
    vectors: string;
    [key: string]: string;
  }): Promise<ComponentHealth> {
    try {
      const vectorStorage = await this.factories.createVectorStorage({
        storePath: filePaths.vectors,
        embeddingModel: 'Xenova/all-MiniLM-L6-v2',
        dimension: 384,
      });

      await vectorStorage.initialize();
      await vectorStorage.close();

      return {
        status: 'ok',
        message: 'Vector storage operational',
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Vector storage check failed',
      };
    }
  }

  private async checkMetricsStore(filePaths: {
    metrics: string;
    [key: string]: string;
  }): Promise<ComponentHealth> {
    try {
      const metricsStore = this.factories.createMetricsStore(filePaths.metrics, this.logger);
      const count = metricsStore.getCount();
      metricsStore.close();

      return {
        status: 'ok',
        details: {
          snapshotCount: count,
        },
      };
    } catch (error) {
      // Metrics is optional, so warning instead of error
      return {
        status: 'warning',
        message: error instanceof Error ? error.message : 'Metrics store unavailable',
      };
    }
  }
}
