/**
 * Tests for stats export utilities
 */

import { describe, expect, it } from 'vitest';
import type { DetailedIndexStats } from '../../types';
import {
  exportLanguageStatsAsMarkdown,
  exportPackageStatsAsMarkdown,
  exportStatsAsCsv,
  exportStatsAsJson,
} from '../export';

describe('exportStatsAsJson', () => {
  it('should export basic stats as JSON', () => {
    const stats: DetailedIndexStats = {
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

    const json = exportStatsAsJson(stats);
    const parsed = JSON.parse(json);

    expect(parsed.filesScanned).toBe(100);
    expect(parsed.documentsIndexed).toBe(500);
    expect(parsed.repositoryPath).toBe('/test');
  });

  it('should include metadata when present', () => {
    const stats: DetailedIndexStats = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-01'),
      repositoryPath: '/test',
      statsMetadata: {
        isIncremental: false,
        lastFullIndex: new Date('2024-01-01'),
        lastUpdate: new Date('2024-01-01'),
        incrementalUpdatesSince: 0,
      },
    };

    const json = exportStatsAsJson(stats);
    const parsed = JSON.parse(json);

    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.isIncremental).toBe(false);
  });

  it('should include details when present', () => {
    const stats: DetailedIndexStats = {
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
      },
    };

    const json = exportStatsAsJson(stats);
    const parsed = JSON.parse(json);

    expect(parsed.byLanguage).toBeDefined();
    expect(parsed.byLanguage.typescript.files).toBe(80);
  });

  it('should support pretty option', () => {
    const stats: DetailedIndexStats = {
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

    const compact = exportStatsAsJson(stats, { pretty: false });
    const pretty = exportStatsAsJson(stats, { pretty: true });

    expect(compact.includes('\n')).toBe(false);
    expect(pretty.includes('\n')).toBe(true);
  });
});

describe('exportStatsAsCsv', () => {
  it('should export stats as CSV', () => {
    const stats: DetailedIndexStats = {
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

    const csv = exportStatsAsCsv(stats);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('category,subcategory,metric,value');
    expect(lines).toContain('overview,files,total,100');
    expect(lines).toContain('overview,documents,total,500');
  });

  it('should include language stats in CSV', () => {
    const stats: DetailedIndexStats = {
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

    const csv = exportStatsAsCsv(stats);

    expect(csv).toContain('language,typescript,files,80');
    expect(csv).toContain('language,typescript,lines,10000');
    expect(csv).toContain('language,typescript,avg_commits_per_file,5.5');
  });

  it('should include package stats in CSV', () => {
    const stats: DetailedIndexStats = {
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
          languages: {},
          totalCommits: 125,
        },
      },
    };

    const csv = exportStatsAsCsv(stats);

    expect(csv).toContain('package,@test/core,files,50');
    expect(csv).toContain('package,@test/core,total_commits,125');
  });
});

describe('exportLanguageStatsAsMarkdown', () => {
  it('should export language stats as markdown table', () => {
    const byLanguage = {
      typescript: {
        files: 80,
        components: 400,
        lines: 10000,
        avgCommitsPerFile: 5.5,
      },
      javascript: {
        files: 20,
        components: 100,
        lines: 2000,
      },
    };

    const markdown = exportLanguageStatsAsMarkdown(byLanguage);
    const lines = markdown.split('\n');

    expect(lines[0]).toContain('| Language |');
    expect(lines[1]).toContain('|----------|');
    expect(lines[2]).toContain('| typescript |');
    expect(lines[2]).toContain('| 80 |');
    expect(lines[2]).toContain('| 5.5 |');
    expect(lines[3]).toContain('| javascript |');
    expect(lines[3]).toContain('| N/A |');
  });
});

describe('exportPackageStatsAsMarkdown', () => {
  it('should export package stats as markdown table', () => {
    const byPackage = {
      'packages/core': {
        name: '@test/core',
        path: 'packages/core',
        files: 50,
        components: 250,
        languages: {},
        totalCommits: 125,
      },
      'packages/cli': {
        name: '@test/cli',
        path: 'packages/cli',
        files: 30,
        components: 150,
        languages: {},
      },
    };

    const markdown = exportPackageStatsAsMarkdown(byPackage);
    const lines = markdown.split('\n');

    expect(lines[0]).toContain('| Package |');
    expect(lines[2]).toContain('| @test/core |');
    expect(lines[2]).toContain('| 125 |');
    expect(lines[3]).toContain('| @test/cli |');
    expect(lines[3]).toContain('| N/A |');
  });
});
