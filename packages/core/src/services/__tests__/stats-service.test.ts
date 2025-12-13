/**
 * Tests for StatsService
 */

import { describe, expect, it, vi } from 'vitest';
import type { RepositoryIndexer } from '../../indexer/index.js';
import type { DetailedIndexStats } from '../../indexer/types.js';
import { StatsService } from '../stats-service.js';

describe('StatsService', () => {
  describe('getStats', () => {
    it('should return repository statistics', async () => {
      // Create mock indexer
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({
          filesScanned: 100,
          documentsIndexed: 250,
          documentsExtracted: 250,
          vectorsStored: 250,
          repositoryPath: '/test/repo',
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-01T00:01:00Z'),
          duration: 60000,
          errors: [],
        } as DetailedIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      // Inject mock factory
      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new StatsService({ repositoryPath: '/test/repo' }, mockFactory);

      const stats = await service.getStats();

      expect(stats).toBeDefined();
      expect(stats).not.toBeNull();
      if (stats) {
        expect(stats.filesScanned).toBe(100);
        expect(stats.documentsIndexed).toBe(250);
      }
      expect(mockIndexer.initialize).toHaveBeenCalledOnce();
      expect(mockIndexer.getStats).toHaveBeenCalledOnce();
      expect(mockIndexer.close).toHaveBeenCalledOnce();
    });

    it('should clean up indexer even on error', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockRejectedValue(new Error('Stats error')),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new StatsService({ repositoryPath: '/test/repo' }, mockFactory);

      await expect(service.getStats()).rejects.toThrow('Stats error');
      expect(mockIndexer.close).toHaveBeenCalledOnce();
    });
  });

  describe('isIndexed', () => {
    it('should return true when repository is indexed', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({
          filesScanned: 100,
        } as DetailedIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new StatsService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(true);
    });

    it('should return false when repository is not indexed', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue(null),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new StatsService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockRejectedValue(new Error('Init error')),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new StatsService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(false);
    });
  });
});
