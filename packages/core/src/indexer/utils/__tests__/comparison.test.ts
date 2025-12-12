/**
 * Tests for stats comparison utilities
 */

import { describe, expect, it } from 'vitest';
import type { DetailedIndexStats } from '../../types';
import { compareStats, formatDiffSummary } from '../comparison';

describe('compareStats', () => {
  it('should calculate file count changes', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
    };

    const after: DetailedIndexStats = {
      ...before,
      filesScanned: 120,
      endTime: new Date('2024-01-02'),
    };

    const diff = compareStats(before, after);

    expect(diff.files.before).toBe(100);
    expect(diff.files.after).toBe(120);
    expect(diff.files.absolute).toBe(20);
    expect(diff.files.percent).toBe(20);
  });

  it('should calculate language changes', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
      byLanguage: {
        typescript: { files: 80, components: 400, lines: 10000 },
        javascript: { files: 20, components: 100, lines: 2000 },
      },
    };

    const after: DetailedIndexStats = {
      ...before,
      endTime: new Date('2024-01-02'),
      byLanguage: {
        typescript: { files: 90, components: 450, lines: 11000 },
        javascript: { files: 20, components: 100, lines: 2000 },
        go: { files: 10, components: 50, lines: 1500 },
      },
    };

    const diff = compareStats(before, after);

    // TypeScript grew
    expect(diff.languages.typescript.files.absolute).toBe(10);
    expect(diff.languages.typescript.lines.absolute).toBe(1000);

    // JavaScript stayed the same
    expect(diff.languages.javascript.files.absolute).toBe(0);

    // Go was added
    expect(diff.languages.go.files.before).toBe(0);
    expect(diff.languages.go.files.after).toBe(10);
    expect(diff.summary.languagesAdded).toContain('go');
  });

  it('should detect language removal', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
      byLanguage: {
        typescript: { files: 80, components: 400, lines: 10000 },
        javascript: { files: 20, components: 100, lines: 2000 },
      },
    };

    const after: DetailedIndexStats = {
      ...before,
      endTime: new Date('2024-01-02'),
      byLanguage: {
        typescript: { files: 100, components: 500, lines: 12000 },
      },
    };

    const diff = compareStats(before, after);

    expect(diff.summary.languagesRemoved).toContain('javascript');
    expect(diff.languages.javascript.files.after).toBe(0);
  });

  it('should calculate package changes', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
      byPackage: {
        'packages/core': {
          name: '@test/core',
          path: 'packages/core',
          files: 50,
          components: 250,
          languages: { typescript: 250 },
        },
      },
    };

    const after: DetailedIndexStats = {
      ...before,
      endTime: new Date('2024-01-02'),
      byPackage: {
        'packages/core': {
          name: '@test/core',
          path: 'packages/core',
          files: 60,
          components: 300,
          languages: { typescript: 300 },
        },
        'packages/cli': {
          name: '@test/cli',
          path: 'packages/cli',
          files: 30,
          components: 150,
          languages: { typescript: 150 },
        },
      },
    };

    const diff = compareStats(before, after);

    // Core package grew
    expect(diff.packages['packages/core'].files.absolute).toBe(10);
    expect(diff.packages['packages/core'].components.absolute).toBe(50);

    // CLI package was added
    expect(diff.packages['packages/cli'].files.before).toBe(0);
    expect(diff.packages['packages/cli'].files.after).toBe(30);
    expect(diff.summary.packagesAdded).toContain('packages/cli');
  });

  it('should calculate component type changes', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
      byComponentType: {
        function: 200,
        class: 50,
        interface: 100,
      },
    };

    const after: DetailedIndexStats = {
      ...before,
      endTime: new Date('2024-01-02'),
      byComponentType: {
        function: 220,
        class: 60,
        interface: 100,
        type: 30,
      },
    };

    const diff = compareStats(before, after);

    expect(diff.componentTypes.function.absolute).toBe(20);
    expect(diff.componentTypes.class.absolute).toBe(10);
    expect(diff.componentTypes.interface.absolute).toBe(0);
    expect(diff.componentTypes.type.before).toBe(0);
    expect(diff.componentTypes.type.after).toBe(30);
  });

  it('should calculate negative changes (shrinking codebase)', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
    };

    const after: DetailedIndexStats = {
      ...before,
      filesScanned: 80,
      documentsIndexed: 400,
      endTime: new Date('2024-01-02'),
    };

    const diff = compareStats(before, after);

    expect(diff.files.absolute).toBe(-20);
    expect(diff.files.percent).toBe(-20);
    expect(diff.documents.absolute).toBe(-100);
    expect(diff.summary.overallTrend).toBe('shrinking');
  });

  it('should calculate time delta', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-01T00:00:00Z'),
      repositoryPath: '/test',
    };

    const after: DetailedIndexStats = {
      ...before,
      endTime: new Date('2024-01-02T00:00:00Z'),
    };

    const diff = compareStats(before, after);

    expect(diff.timeDelta).toBe(86400000); // 24 hours in ms
  });

  it('should determine overall trend as growing', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
    };

    const after: DetailedIndexStats = {
      ...before,
      filesScanned: 130,
      endTime: new Date('2024-01-02'),
    };

    const diff = compareStats(before, after);

    expect(diff.summary.overallTrend).toBe('growing');
  });

  it('should determine overall trend as stable', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
    };

    const after: DetailedIndexStats = {
      ...before,
      filesScanned: 105,
      endTime: new Date('2024-01-02'),
    };

    const diff = compareStats(before, after);

    expect(diff.summary.overallTrend).toBe('stable');
  });

  it('should handle change frequency in language stats', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
      byLanguage: {
        typescript: {
          files: 80,
          components: 400,
          lines: 10000,
          avgCommitsPerFile: 5.5,
        },
      },
    };

    const after: DetailedIndexStats = {
      ...before,
      endTime: new Date('2024-01-02'),
      byLanguage: {
        typescript: {
          files: 80,
          components: 400,
          lines: 10000,
          avgCommitsPerFile: 6.2,
        },
      },
    };

    const diff = compareStats(before, after);

    expect(diff.languages.typescript.avgCommitsPerFile).toBeDefined();
    expect(diff.languages.typescript.avgCommitsPerFile?.absolute).toBeCloseTo(0.7, 1);
  });
});

describe('formatDiffSummary', () => {
  it('should format a growing codebase summary', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
      byLanguage: {
        typescript: { files: 100, components: 500, lines: 10000 },
      },
    };

    const after: DetailedIndexStats = {
      ...before,
      filesScanned: 120,
      endTime: new Date('2024-01-02'),
      byLanguage: {
        typescript: { files: 110, components: 550, lines: 11000 },
        go: { files: 10, components: 50, lines: 1500 },
      },
    };

    const diff = compareStats(before, after);
    const summary = formatDiffSummary(diff);

    expect(summary).toContain('added 20 files');
    expect(summary).toContain('added 2,500 lines');
    expect(summary).toContain('new languages: go');
    expect(summary).toContain('trend: growing');
  });

  it('should format a shrinking codebase summary', () => {
    const before: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
      byLanguage: {
        typescript: { files: 100, components: 500, lines: 10000 },
      },
    };

    const after: DetailedIndexStats = {
      ...before,
      filesScanned: 70,
      endTime: new Date('2024-01-02'),
      byLanguage: {
        typescript: { files: 70, components: 350, lines: 7000 },
      },
    };

    const diff = compareStats(before, after);
    const summary = formatDiffSummary(diff);

    expect(summary).toContain('removed 30 files');
    expect(summary).toContain('removed 3,000 lines');
    expect(summary).toContain('trend: shrinking');
  });
});
