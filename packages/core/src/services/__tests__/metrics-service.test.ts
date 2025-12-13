/**
 * Tests for MetricsService
 */

import { describe, expect, it, vi } from 'vitest';
import type { FileMetrics } from '../../metrics/analytics.js';
import type { MetricsStore } from '../../metrics/store.js';
import type { CodeMetadata, Snapshot } from '../../metrics/types.js';
import { MetricsService } from '../metrics-service.js';

vi.mock('../../storage/path.js', () => ({
  getStoragePath: vi.fn().mockResolvedValue('/mock/storage'),
  getStorageFilePaths: vi.fn().mockReturnValue({
    vectors: '/mock/storage/vectors',
    indexerState: '/mock/storage/indexer-state.json',
    metrics: '/mock/storage/metrics.db',
  }),
}));

describe('MetricsService', () => {
  const mockSnapshot: Snapshot = {
    id: 'snapshot-1',
    repositoryPath: '/test/repo',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    trigger: 'index',
    stats: {
      filesScanned: 100,
      documentsIndexed: 250,
      documentsExtracted: 250,
      vectorsStored: 250,
      repositoryPath: '/test/repo',
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-01T00:01:00Z'),
      duration: 60000,
      errors: [],
    },
  };

  describe('getMostActive', () => {
    it('should return most active files', async () => {
      const mockMetrics: FileMetrics[] = [
        {
          filePath: 'src/file1.ts',
          activity: 'high',
          commitCount: 50,
          size: 'medium',
          linesOfCode: 200,
          ownership: 'small-team',
          authorCount: 3,
          lastModified: new Date(),
          numFunctions: 10,
          numImports: 5,
        },
      ];

      const mockStore: MetricsStore = {
        getLatestSnapshot: vi.fn().mockReturnValue(mockSnapshot),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      // Mock the analytics function
      const analytics = await import('../../metrics/analytics.js');
      vi.spyOn(analytics, 'getMostActive').mockReturnValue(mockMetrics);

      const result = await service.getMostActive(10);

      expect(result).toEqual(mockMetrics);
      expect(mockStore.close).toHaveBeenCalledOnce();
    });

    it('should return empty array when no snapshot exists', async () => {
      const mockStore: MetricsStore = {
        getLatestSnapshot: vi.fn().mockReturnValue(null),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.getMostActive();

      expect(result).toEqual([]);
      expect(mockStore.close).toHaveBeenCalledOnce();
    });
  });

  describe('getLargestFiles', () => {
    it('should return largest files', async () => {
      const mockMetrics: FileMetrics[] = [
        {
          filePath: 'src/large.ts',
          activity: 'low',
          commitCount: 10,
          size: 'large',
          linesOfCode: 1000,
          ownership: 'shared',
          authorCount: 5,
          lastModified: new Date(),
          numFunctions: 50,
          numImports: 20,
        },
      ];

      const mockStore: MetricsStore = {
        getLatestSnapshot: vi.fn().mockReturnValue(mockSnapshot),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      const analytics = await import('../../metrics/analytics.js');
      vi.spyOn(analytics, 'getLargestFiles').mockReturnValue(mockMetrics);

      const result = await service.getLargestFiles(10);

      expect(result).toEqual(mockMetrics);
    });
  });

  describe('getConcentratedOwnership', () => {
    it('should return files with concentrated ownership', async () => {
      const mockMetrics: FileMetrics[] = [
        {
          filePath: 'src/solo.ts',
          activity: 'medium',
          commitCount: 30,
          size: 'medium',
          linesOfCode: 500,
          ownership: 'single',
          authorCount: 1,
          lastModified: new Date(),
          numFunctions: 20,
          numImports: 8,
        },
      ];

      const mockStore: MetricsStore = {
        getLatestSnapshot: vi.fn().mockReturnValue(mockSnapshot),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      const analytics = await import('../../metrics/analytics.js');
      vi.spyOn(analytics, 'getConcentratedOwnership').mockReturnValue(mockMetrics);

      const result = await service.getConcentratedOwnership(10);

      expect(result).toEqual(mockMetrics);
    });
  });

  describe('getFileTrend', () => {
    it('should return file trend history', async () => {
      const mockTrend: CodeMetadata[] = [
        {
          filePath: 'src/file.ts',
          commitCount: 10,
          lastModified: new Date('2024-01-01'),
          authorCount: 3,
          linesOfCode: 200,
          numFunctions: 5,
          numImports: 3,
        },
      ];

      const mockStore: MetricsStore = {
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      const analytics = await import('../../metrics/analytics.js');
      vi.spyOn(analytics, 'getFileTrend').mockReturnValue(mockTrend);

      const result = await service.getFileTrend('src/file.ts', 10);

      expect(result).toEqual(mockTrend);
    });
  });

  describe('getSummary', () => {
    it('should return snapshot summary', async () => {
      const mockSummary = {
        totalFiles: 100,
        totalLOC: 10000,
        totalFunctions: 500,
        avgLOC: 100,
        veryActiveFiles: 5,
        highActivityFiles: 10,
        veryActivePercent: 5,
        veryLargeFiles: 3,
        largeFiles: 8,
        veryLargePercent: 3,
        singleAuthorFiles: 20,
        pairAuthorFiles: 15,
        singleAuthorPercent: 20,
      };

      const mockStore: MetricsStore = {
        getLatestSnapshot: vi.fn().mockReturnValue(mockSnapshot),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      const analytics = await import('../../metrics/analytics.js');
      vi.spyOn(analytics, 'getSnapshotSummary').mockReturnValue(mockSummary);

      const result = await service.getSummary();

      expect(result).toEqual(mockSummary);
    });

    it('should return null when no snapshot exists', async () => {
      const mockStore: MetricsStore = {
        getLatestSnapshot: vi.fn().mockReturnValue(null),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.getSummary();

      expect(result).toBeNull();
    });
  });

  describe('getSnapshots', () => {
    it('should query snapshots', async () => {
      const mockStore: MetricsStore = {
        getSnapshots: vi.fn().mockReturnValue([mockSnapshot]),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.getSnapshots({ limit: 10 });

      expect(result).toEqual([mockSnapshot]);
      expect(mockStore.getSnapshots).toHaveBeenCalledWith({
        limit: 10,
        repositoryPath: '/test/repo',
      });
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return latest snapshot', async () => {
      const mockStore: MetricsStore = {
        getLatestSnapshot: vi.fn().mockReturnValue(mockSnapshot),
        close: vi.fn(),
      } as unknown as MetricsStore;

      const mockFactory = vi.fn().mockReturnValue(mockStore);
      const service = new MetricsService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.getLatestSnapshot();

      expect(result).toEqual(mockSnapshot);
    });
  });
});
