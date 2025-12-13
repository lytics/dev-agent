/**
 * Tests for HealthService
 */

import { describe, expect, it, vi } from 'vitest';
import type { RepositoryIndexer } from '../../indexer/index.js';
import type { MetricsStore } from '../../metrics/store.js';
import type { VectorStorage } from '../../vector/index.js';
import { HealthService } from '../health-service.js';

describe('HealthService', () => {
  describe('check', () => {
    it('should return healthy status when all checks pass', async () => {
      // Create mock components
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({
          filesScanned: 100,
          documentsIndexed: 250,
          endTime: new Date(),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockVectorStorage: VectorStorage = {
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as VectorStorage;

      const mockMetricsStore: MetricsStore = {
        getCount: vi.fn().mockReturnValue(10),
        close: vi.fn(),
      } as unknown as MetricsStore;

      // Inject mock factories
      const service = new HealthService(
        { repositoryPath: '/test/repo' },
        {
          createIndexer: vi.fn().mockResolvedValue(mockIndexer),
          createVectorStorage: vi.fn().mockResolvedValue(mockVectorStorage),
          createMetricsStore: vi.fn().mockReturnValue(mockMetricsStore),
        }
      );

      const result = await service.check();

      expect(result.status).toBe('healthy');
      expect(result.checks.indexer.status).toBe('ok');
      expect(result.checks.vectorStorage.status).toBe('ok');
      expect(result.checks.metricsStore.status).toBe('ok');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return degraded status when metrics check has warning', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({ endTime: new Date() }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockVectorStorage: VectorStorage = {
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as VectorStorage;

      const mockMetricsStore: MetricsStore = {
        getCount: vi.fn().mockImplementation(() => {
          throw new Error('Metrics unavailable');
        }),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const service = new HealthService(
        { repositoryPath: '/test/repo' },
        {
          createIndexer: vi.fn().mockResolvedValue(mockIndexer),
          createVectorStorage: vi.fn().mockResolvedValue(mockVectorStorage),
          createMetricsStore: vi.fn().mockReturnValue(mockMetricsStore),
        }
      );

      const result = await service.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.metricsStore.status).toBe('warning');
    });

    it('should return unhealthy status when indexer check fails', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockRejectedValue(new Error('Indexer error')),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockVectorStorage: VectorStorage = {
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as VectorStorage;

      const mockMetricsStore: MetricsStore = {
        getCount: vi.fn().mockReturnValue(10),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const service = new HealthService(
        { repositoryPath: '/test/repo' },
        {
          createIndexer: vi.fn().mockResolvedValue(mockIndexer),
          createVectorStorage: vi.fn().mockResolvedValue(mockVectorStorage),
          createMetricsStore: vi.fn().mockReturnValue(mockMetricsStore),
        }
      );

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.indexer.status).toBe('error');
      expect(result.checks.indexer.message).toBe('Indexer error');
    });

    it('should return unhealthy status when vector storage check fails', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({ endTime: new Date() }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockVectorStorage: VectorStorage = {
        initialize: vi.fn().mockRejectedValue(new Error('Vector storage error')),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as VectorStorage;

      const mockMetricsStore: MetricsStore = {
        getCount: vi.fn().mockReturnValue(10),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const service = new HealthService(
        { repositoryPath: '/test/repo' },
        {
          createIndexer: vi.fn().mockResolvedValue(mockIndexer),
          createVectorStorage: vi.fn().mockResolvedValue(mockVectorStorage),
          createMetricsStore: vi.fn().mockReturnValue(mockMetricsStore),
        }
      );

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.vectorStorage.status).toBe('error');
    });

    it('should run all checks in parallel', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({ endTime: new Date() }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockVectorStorage: VectorStorage = {
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as VectorStorage;

      const mockMetricsStore: MetricsStore = {
        getCount: vi.fn().mockReturnValue(10),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const service = new HealthService(
        { repositoryPath: '/test/repo' },
        {
          createIndexer: vi.fn().mockResolvedValue(mockIndexer),
          createVectorStorage: vi.fn().mockResolvedValue(mockVectorStorage),
          createMetricsStore: vi.fn().mockReturnValue(mockMetricsStore),
        }
      );

      const startTime = Date.now();
      await service.check();
      const duration = Date.now() - startTime;

      // If checks were sequential with 10ms delays, would take 30ms+
      // Parallel should complete much faster
      expect(duration).toBeLessThan(100);
    });
  });
});
