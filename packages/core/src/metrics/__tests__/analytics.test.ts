/**
 * Tests for Metrics Analytics
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDetailedIndexStats } from '../../indexer/__tests__/test-factories.js';
import {
  getConcentratedOwnership,
  getFileMetrics,
  getFileTrend,
  getLargestFiles,
  getMostActive,
  getSnapshotSummary,
} from '../analytics.js';
import { MetricsStore } from '../store.js';
import type { CodeMetadata } from '../types.js';

describe('Metrics Analytics', () => {
  let tempDbPath: string;
  let store: MetricsStore;
  let snapshotId: string;

  beforeEach(() => {
    // Create temp database
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-test-'));
    tempDbPath = path.join(tempDir, 'test-metrics.db');
    store = new MetricsStore(tempDbPath);

    // Create a snapshot
    const stats = createDetailedIndexStats({
      repositoryPath: '/test/repo',
      filesScanned: 5,
      documentsIndexed: 10,
    });
    snapshotId = store.recordSnapshot(stats, 'index');

    // Add code metadata for testing
    const metadata: CodeMetadata[] = [
      {
        filePath: 'src/very-active.ts',
        commitCount: 100,
        authorCount: 1,
        linesOfCode: 2000,
        numFunctions: 50,
        numImports: 20,
      },
      {
        filePath: 'src/medium-active.ts',
        commitCount: 30,
        authorCount: 3,
        linesOfCode: 500,
        numFunctions: 15,
        numImports: 10,
      },
      {
        filePath: 'src/low-active.ts',
        commitCount: 5,
        authorCount: 5,
        linesOfCode: 100,
        numFunctions: 5,
        numImports: 3,
      },
    ];

    store.appendCodeMetadata(snapshotId, metadata);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
      const tempDir = path.dirname(tempDbPath);
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('getFileMetrics', () => {
    it('should return files with classified metrics', () => {
      const metrics = getFileMetrics(store, snapshotId);

      expect(metrics.length).toBe(3);
      expect(metrics[0].filePath).toBeDefined();
      expect(metrics[0].activity).toBeDefined();
      expect(metrics[0].size).toBeDefined();
      expect(metrics[0].ownership).toBeDefined();
    });

    it('should classify activity levels correctly', () => {
      const metrics = getFileMetrics(store, snapshotId);

      // Find by file path
      const veryActive = metrics.find((m) => m.filePath === 'src/very-active.ts');
      const mediumActive = metrics.find((m) => m.filePath === 'src/medium-active.ts');
      const lowActive = metrics.find((m) => m.filePath === 'src/low-active.ts');

      // 100 commits = very-high
      expect(veryActive?.activity).toBe('very-high');
      expect(veryActive?.commitCount).toBe(100);

      // 30 commits = medium
      expect(mediumActive?.activity).toBe('medium');
      expect(mediumActive?.commitCount).toBe(30);

      // 5 commits = low
      expect(lowActive?.activity).toBe('low');
      expect(lowActive?.commitCount).toBe(5);
    });

    it('should classify size correctly', () => {
      const metrics = getFileMetrics(store, snapshotId);

      const veryActive = metrics.find((m) => m.filePath === 'src/very-active.ts');
      const mediumActive = metrics.find((m) => m.filePath === 'src/medium-active.ts');
      const lowActive = metrics.find((m) => m.filePath === 'src/low-active.ts');

      // 2000 LOC = very-large
      expect(veryActive?.size).toBe('very-large');

      // 500 LOC = medium
      expect(mediumActive?.size).toBe('medium');

      // 100 LOC = small
      expect(lowActive?.size).toBe('small');
    });

    it('should classify ownership correctly', () => {
      const metrics = getFileMetrics(store, snapshotId);

      const veryActive = metrics.find((m) => m.filePath === 'src/very-active.ts');
      const mediumActive = metrics.find((m) => m.filePath === 'src/medium-active.ts');
      const lowActive = metrics.find((m) => m.filePath === 'src/low-active.ts');

      // 1 author = single
      expect(veryActive?.ownership).toBe('single');
      expect(veryActive?.authorCount).toBe(1);

      // 3 authors = small-team
      expect(mediumActive?.ownership).toBe('small-team');

      // 5 authors = small-team
      expect(lowActive?.ownership).toBe('small-team');
    });

    it('should respect limit parameter', () => {
      const metrics = getFileMetrics(store, snapshotId, { limit: 2 });
      expect(metrics.length).toBe(2);
    });

    it('should return empty array for non-existent snapshot', () => {
      const metrics = getFileMetrics(store, 'non-existent-id');
      expect(metrics.length).toBe(0);
    });
  });

  describe('getMostActive', () => {
    it('should return files sorted by activity', () => {
      const active = getMostActive(store, snapshotId, 10);

      expect(active.length).toBe(3);
      // Should be sorted by commit count descending
      expect(active[0].commitCount).toBeGreaterThanOrEqual(active[1].commitCount);
      expect(active[1].commitCount).toBeGreaterThanOrEqual(active[2].commitCount);
    });
  });

  describe('getLargestFiles', () => {
    it('should return files sorted by size', () => {
      const largest = getLargestFiles(store, snapshotId, 10);

      expect(largest.length).toBe(3);
      // Should be sorted by LOC descending
      expect(largest[0].linesOfCode).toBeGreaterThanOrEqual(largest[1].linesOfCode);
      expect(largest[1].linesOfCode).toBeGreaterThanOrEqual(largest[2].linesOfCode);
    });
  });

  describe('getConcentratedOwnership', () => {
    it('should return files with single or pair ownership', () => {
      const concentrated = getConcentratedOwnership(store, snapshotId, 10);

      expect(concentrated.length).toBeGreaterThan(0);
      // All should have single or pair ownership
      for (const file of concentrated) {
        expect(['single', 'pair']).toContain(file.ownership);
      }
    });
  });

  describe('getFileTrend', () => {
    it('should return file metadata across snapshots', async () => {
      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create a second snapshot
      const stats2 = createDetailedIndexStats({
        repositoryPath: '/test/repo',
        filesScanned: 5,
      });
      const snapshotId2 = store.recordSnapshot(stats2, 'update');

      // Add updated metadata
      const updatedMetadata: CodeMetadata[] = [
        {
          filePath: 'src/very-active.ts',
          commitCount: 110, // Increased
          authorCount: 2, // More authors
          linesOfCode: 2100, // More LOC
          numFunctions: 52,
          numImports: 22,
        },
      ];
      store.appendCodeMetadata(snapshotId2, updatedMetadata);

      const trend = getFileTrend(store, 'src/very-active.ts', 10);

      expect(trend.length).toBe(2);
      // Most recent first
      expect(trend[0].commitCount).toBe(110);
      expect(trend[1].commitCount).toBe(100);
    });

    it('should return empty array for non-existent file', () => {
      const trend = getFileTrend(store, 'src/non-existent.ts', 10);
      expect(trend.length).toBe(0);
    });
  });

  describe('getSnapshotSummary', () => {
    it('should calculate summary statistics', () => {
      const summary = getSnapshotSummary(store, snapshotId);

      expect(summary).toBeDefined();
      expect(summary?.totalFiles).toBe(3);
      expect(summary?.totalLOC).toBe(2600); // 2000 + 500 + 100
      expect(summary?.totalFunctions).toBe(70); // 50 + 15 + 5
      expect(summary?.avgLOC).toBe(867); // 2600 / 3, rounded
    });

    it('should categorize files by activity', () => {
      const summary = getSnapshotSummary(store, snapshotId);

      expect(summary).toBeDefined();
      // Should have activity metrics
      expect(summary?.veryActiveFiles).toBe(1); // very-active.ts has 100 commits
      expect(summary?.highActivityFiles).toBe(1); // Only 1 file >= 50 commits
      expect(summary?.veryActivePercent).toBeGreaterThan(0);
    });

    it('should categorize files by size', () => {
      const summary = getSnapshotSummary(store, snapshotId);

      expect(summary).toBeDefined();
      // Should have size metrics
      expect(summary?.veryLargeFiles).toBe(1); // very-active.ts has 2000 LOC
      expect(summary?.largeFiles).toBe(1); // Only 1 file >= 1000 LOC
      expect(summary?.veryLargePercent).toBeGreaterThan(0);
    });

    it('should categorize files by ownership', () => {
      const summary = getSnapshotSummary(store, snapshotId);

      expect(summary).toBeDefined();
      // Should have ownership metrics
      expect(summary?.singleAuthorFiles).toBe(1); // very-active.ts has 1 author
      expect(summary?.pairAuthorFiles).toBe(0); // No files with exactly 2 authors
      expect(summary?.singleAuthorPercent).toBeGreaterThan(0);
    });

    it('should return null for non-existent snapshot', () => {
      const summary = getSnapshotSummary(store, 'non-existent-id');
      expect(summary).toBeNull();
    });

    it('should return null for snapshot with no metadata', () => {
      const stats = createDetailedIndexStats({
        repositoryPath: '/test/repo2',
      });
      const emptySnapshotId = store.recordSnapshot(stats, 'index');

      const summary = getSnapshotSummary(store, emptySnapshotId);
      expect(summary).toBeNull();
    });
  });
});
