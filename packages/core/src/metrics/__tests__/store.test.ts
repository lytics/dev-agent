/**
 * Tests for MetricsStore
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDetailedIndexStats } from '../../indexer/__tests__/test-factories.js';
import { MetricsStore } from '../store.js';

describe('MetricsStore', () => {
  let tempDbPath: string;
  let store: MetricsStore;

  beforeEach(() => {
    // Create temp database path
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-test-'));
    tempDbPath = path.join(tempDir, 'test-metrics.db');
    store = new MetricsStore(tempDbPath);
  });

  afterEach(() => {
    // Clean up
    store.close();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
      const tempDir = path.dirname(tempDbPath);
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('recordSnapshot', () => {
    it('should record a snapshot successfully', () => {
      const stats = createDetailedIndexStats({
        repositoryPath: '/test/repo',
        filesScanned: 10,
        documentsIndexed: 20,
        vectorsStored: 20,
        duration: 1000,
      });

      const id = store.recordSnapshot(stats, 'index');

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should generate unique IDs for each snapshot', () => {
      const stats = createDetailedIndexStats();

      const id1 = store.recordSnapshot(stats, 'index');
      const id2 = store.recordSnapshot(stats, 'update');

      expect(id1).not.toBe(id2);
    });

    it('should store both index and update triggers', () => {
      const stats = createDetailedIndexStats();

      const indexId = store.recordSnapshot(stats, 'index');
      const updateId = store.recordSnapshot(stats, 'update');

      const indexSnapshot = store.getSnapshot(indexId);
      const updateSnapshot = store.getSnapshot(updateId);

      expect(indexSnapshot?.trigger).toBe('index');
      expect(updateSnapshot?.trigger).toBe('update');
    });
  });

  describe('getSnapshot', () => {
    it('should retrieve a snapshot by ID', () => {
      const stats = createDetailedIndexStats({
        repositoryPath: '/test/repo',
        filesScanned: 10,
        documentsIndexed: 20,
      });

      const id = store.recordSnapshot(stats, 'index');
      const snapshot = store.getSnapshot(id);

      expect(snapshot).toBeTruthy();
      expect(snapshot?.id).toBe(id);
      expect(snapshot?.repositoryPath).toBe('/test/repo');
      expect(snapshot?.stats.filesScanned).toBe(10);
      expect(snapshot?.stats.documentsIndexed).toBe(20);
      expect(snapshot?.trigger).toBe('index');
    });

    it('should return null for non-existent ID', () => {
      const snapshot = store.getSnapshot('non-existent-id');
      expect(snapshot).toBeNull();
    });
  });

  describe('getSnapshots', () => {
    beforeEach(() => {
      // Seed with multiple snapshots
      const repo1 = '/test/repo1';
      const repo2 = '/test/repo2';

      store.recordSnapshot(createDetailedIndexStats({ repositoryPath: repo1 }), 'index');
      store.recordSnapshot(createDetailedIndexStats({ repositoryPath: repo1 }), 'update');
      store.recordSnapshot(createDetailedIndexStats({ repositoryPath: repo2 }), 'index');
    });

    it('should retrieve all snapshots with default limit', () => {
      const snapshots = store.getSnapshots({});
      expect(snapshots.length).toBe(3);
    });

    it('should filter by repository path', () => {
      const snapshots = store.getSnapshots({ repositoryPath: '/test/repo1' });
      expect(snapshots.length).toBe(2);
      expect(snapshots.every((s) => s.repositoryPath === '/test/repo1')).toBe(true);
    });

    it('should filter by trigger type', () => {
      const snapshots = store.getSnapshots({ trigger: 'index' });
      expect(snapshots.length).toBe(2);
      expect(snapshots.every((s) => s.trigger === 'index')).toBe(true);
    });

    it('should respect limit parameter', () => {
      const snapshots = store.getSnapshots({ limit: 2 });
      expect(snapshots.length).toBe(2);
    });

    it('should return snapshots in descending timestamp order', () => {
      const snapshots = store.getSnapshots({});
      expect(snapshots.length).toBeGreaterThan(1);

      for (let i = 1; i < snapshots.length; i++) {
        expect(snapshots[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          snapshots[i].timestamp.getTime()
        );
      }
    });

    it('should filter by since date', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      const snapshots = store.getSnapshots({ since: oneHourAgo });
      expect(snapshots.length).toBeGreaterThan(0);
    });

    it('should filter by until date', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const snapshots = store.getSnapshots({ until: futureDate });
      expect(snapshots.length).toBe(3);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return the most recent snapshot', async () => {
      const stats1 = createDetailedIndexStats({ filesScanned: 10 });
      const stats2 = createDetailedIndexStats({ filesScanned: 20 });

      store.recordSnapshot(stats1, 'index');
      // Wait 1ms to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));
      const latestId = store.recordSnapshot(stats2, 'update');

      const latest = store.getLatestSnapshot();
      expect(latest?.id).toBe(latestId);
      expect(latest?.stats.filesScanned).toBe(20);
    });

    it('should filter by repository path', async () => {
      store.recordSnapshot(createDetailedIndexStats({ repositoryPath: '/repo1' }), 'index');
      // Wait 1ms to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));
      const repo2Id = store.recordSnapshot(
        createDetailedIndexStats({ repositoryPath: '/repo2' }),
        'index'
      );

      const latest = store.getLatestSnapshot('/repo2');
      expect(latest?.id).toBe(repo2Id);
    });

    it('should return null when no snapshots exist', () => {
      const latest = store.getLatestSnapshot();
      expect(latest).toBeNull();
    });
  });

  describe('getCount', () => {
    it('should return correct count of all snapshots', () => {
      store.recordSnapshot(createDetailedIndexStats(), 'index');
      store.recordSnapshot(createDetailedIndexStats(), 'update');
      store.recordSnapshot(createDetailedIndexStats(), 'index');

      expect(store.getCount()).toBe(3);
    });

    it('should return correct count filtered by repository path', () => {
      store.recordSnapshot(createDetailedIndexStats({ repositoryPath: '/repo1' }), 'index');
      store.recordSnapshot(createDetailedIndexStats({ repositoryPath: '/repo1' }), 'update');
      store.recordSnapshot(createDetailedIndexStats({ repositoryPath: '/repo2' }), 'index');

      expect(store.getCount('/repo1')).toBe(2);
      expect(store.getCount('/repo2')).toBe(1);
    });

    it('should return 0 for empty database', () => {
      expect(store.getCount()).toBe(0);
    });
  });

  describe('pruneOldSnapshots', () => {
    it('should delete snapshots older than retention period', async () => {
      // Record a snapshot
      store.recordSnapshot(createDetailedIndexStats(), 'index');

      // Wait 2ms to ensure the snapshot is in the past
      await new Promise((resolve) => setTimeout(resolve, 2));

      // Prune snapshots older than 0 days (should delete all)
      const deleted = store.pruneOldSnapshots(0);
      expect(deleted).toBeGreaterThan(0);
      expect(store.getCount()).toBe(0);
    });

    it('should not delete recent snapshots', () => {
      store.recordSnapshot(createDetailedIndexStats(), 'index');
      store.recordSnapshot(createDetailedIndexStats(), 'update');

      // Prune snapshots older than 90 days (should delete none)
      const deleted = store.pruneOldSnapshots(90);
      expect(deleted).toBe(0);
      expect(store.getCount()).toBe(2);
    });

    it('should return 0 when no snapshots to prune', () => {
      const deleted = store.pruneOldSnapshots(30);
      expect(deleted).toBe(0);
    });
  });

  describe('close', () => {
    it('should close database without error', () => {
      expect(() => store.close()).not.toThrow();
    });

    it('should not throw when closed multiple times', () => {
      store.close();
      expect(() => store.close()).not.toThrow();
    });
  });

  describe('logger integration', () => {
    it('should work without a logger', () => {
      const storeWithoutLogger = new MetricsStore(tempDbPath);
      const stats = createDetailedIndexStats();

      expect(() => {
        storeWithoutLogger.recordSnapshot(stats, 'index');
      }).not.toThrow();

      storeWithoutLogger.close();
    });

    it('should call logger methods when provided', () => {
      const mockLogger = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn(),
        startTimer: vi.fn(),
        isLevelEnabled: vi.fn(),
        level: 'info' as const,
      };

      const tempDbPath2 = path.join(path.dirname(tempDbPath), 'test-metrics-2.db');
      const storeWithLogger = new MetricsStore(tempDbPath2, mockLogger);
      const stats = createDetailedIndexStats();

      storeWithLogger.recordSnapshot(stats, 'index');

      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();

      storeWithLogger.close();
      fs.unlinkSync(tempDbPath2);
    });
  });
});
