import type { DetailedIndexStats, LanguageStats } from '@lytics/dev-agent-core';
import { describe, expect, it } from 'vitest';
import {
  createComponentTypesTable,
  createHealthIndicator,
  createLanguageTable,
  createOverviewSection,
  formatBytes,
  formatDetailedStats,
  formatNumber,
  getTerminalWidth,
} from '../formatters';

describe('formatters', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    });

    it('should handle fractional values', () => {
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(42)).toBe('42');
    });
  });

  describe('getTerminalWidth', () => {
    it('should return a positive number', () => {
      const width = getTerminalWidth();
      expect(width).toBeGreaterThan(0);
      expect(typeof width).toBe('number');
    });

    it('should have fallback to 80', () => {
      const width = getTerminalWidth();
      // Should be at least 80 (either detected or fallback)
      expect(width).toBeGreaterThanOrEqual(80);
    });
  });

  describe('createLanguageTable', () => {
    it('should create table with language stats', () => {
      const byLanguage: Partial<Record<string, LanguageStats>> = {
        typescript: { files: 10, components: 50, lines: 1000 },
        javascript: { files: 5, components: 25, lines: 500 },
      };

      const table = createLanguageTable(byLanguage);
      const output = table.toString();

      expect(output).toContain('TypeScript');
      expect(output).toContain('JavaScript');
      expect(output).toContain('10');
      expect(output).toContain('50');
      expect(output).toContain('1,000');
    });

    it('should sort by component count descending', () => {
      const byLanguage: Partial<Record<string, LanguageStats>> = {
        javascript: { files: 5, components: 100, lines: 500 },
        typescript: { files: 10, components: 50, lines: 1000 },
      };

      const table = createLanguageTable(byLanguage);
      const output = table.toString();
      const jsIndex = output.indexOf('JavaScript');
      const tsIndex = output.indexOf('TypeScript');

      // JavaScript should appear first (more components)
      expect(jsIndex).toBeLessThan(tsIndex);
    });

    it('should include totals row', () => {
      const byLanguage: Partial<Record<string, LanguageStats>> = {
        typescript: { files: 10, components: 50, lines: 1000 },
        javascript: { files: 5, components: 25, lines: 500 },
      };

      const table = createLanguageTable(byLanguage);
      const output = table.toString();

      expect(output).toContain('Total');
      expect(output).toContain('15'); // 10 + 5 files
      expect(output).toContain('75'); // 50 + 25 components
    });
  });

  describe('createComponentTypesTable', () => {
    it('should create table with component types', () => {
      const byComponentType: Record<string, number> = {
        function: 50,
        class: 25,
        interface: 15,
      };

      const table = createComponentTypesTable(byComponentType);
      const output = table.toString();

      expect(output).toContain('Function');
      expect(output).toContain('Class');
      expect(output).toContain('Interface');
      expect(output).toContain('50');
      expect(output).toContain('25');
      expect(output).toContain('15');
    });

    it('should calculate percentages correctly', () => {
      const byComponentType: Record<string, number> = {
        function: 50,
        class: 50,
      };

      const table = createComponentTypesTable(byComponentType);
      const output = table.toString();

      expect(output).toContain('50.0%');
    });

    it('should sort by count descending', () => {
      const byComponentType: Record<string, number> = {
        class: 10,
        function: 50,
        interface: 5,
      };

      const table = createComponentTypesTable(byComponentType);
      const output = table.toString();

      const funcIndex = output.indexOf('Function');
      const classIndex = output.indexOf('Class');
      const interfaceIndex = output.indexOf('Interface');

      expect(funcIndex).toBeLessThan(classIndex);
      expect(classIndex).toBeLessThan(interfaceIndex);
    });
  });

  describe('createHealthIndicator', () => {
    it('should show healthy status for good stats', () => {
      const stats: DetailedIndexStats = {
        filesScanned: 100,
        documentsExtracted: 500,
        documentsIndexed: 500,
        vectorsStored: 500,
        duration: 5000,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        repositoryPath: '/test',
      };

      const health = createHealthIndicator(stats);
      expect(health).toContain('Healthy');
      expect(health).toContain('●'); // Indicator dot
    });

    it('should show error status for no files', () => {
      const stats: DetailedIndexStats = {
        filesScanned: 0,
        documentsExtracted: 0,
        documentsIndexed: 0,
        vectorsStored: 0,
        duration: 0,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        repositoryPath: '/test',
      };

      const health = createHealthIndicator(stats);
      expect(health).toContain('No files indexed');
    });

    it('should show warning for incomplete index', () => {
      const stats: DetailedIndexStats = {
        filesScanned: 100,
        documentsExtracted: 500,
        documentsIndexed: 0,
        vectorsStored: 0,
        duration: 5000,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        repositoryPath: '/test',
      };

      const health = createHealthIndicator(stats);
      expect(health).toContain('Incomplete index');
    });

    it('should show warning for high error rate', () => {
      const stats: DetailedIndexStats = {
        filesScanned: 100,
        documentsExtracted: 100,
        documentsIndexed: 100,
        vectorsStored: 100,
        duration: 5000,
        errors: Array(20).fill({ type: 'scanner', message: 'error' }),
        startTime: new Date(),
        endTime: new Date(),
        repositoryPath: '/test',
      };

      const health = createHealthIndicator(stats);
      expect(health).toContain('High error rate');
    });
  });

  describe('createOverviewSection', () => {
    it('should create overview with all fields', () => {
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

      const lines = createOverviewSection(stats, '/test/repo');

      expect(lines.join('\n')).toContain('Repository Overview');
      expect(lines.join('\n')).toContain('/test/repo');
      expect(lines.join('\n')).toContain('100');
      expect(lines.join('\n')).toContain('500');
      expect(lines.join('\n')).toContain('5.00s');
    });
  });

  describe('formatDetailedStats', () => {
    it('should format complete stats', () => {
      const stats: DetailedIndexStats = {
        filesScanned: 100,
        documentsExtracted: 500,
        documentsIndexed: 500,
        vectorsStored: 500,
        duration: 5000,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        repositoryPath: '/test',
        byLanguage: {
          typescript: { files: 50, components: 250, lines: 5000 },
          javascript: { files: 50, components: 250, lines: 5000 },
          go: { files: 0, components: 0, lines: 0 },
          markdown: { files: 0, components: 0, lines: 0 },
        },
        byComponentType: {
          function: 250,
          class: 150,
          interface: 100,
        },
      };

      const output = formatDetailedStats(stats, '/test/repo');

      expect(output).toContain('Repository Overview');
      expect(output).toContain('Language Breakdown');
      expect(output).toContain('Component Types');
      expect(output).toContain('TypeScript');
      expect(output).toContain('Function');
    });

    it('should handle stats without detailed breakdowns', () => {
      const stats: DetailedIndexStats = {
        filesScanned: 100,
        documentsExtracted: 500,
        documentsIndexed: 500,
        vectorsStored: 500,
        duration: 5000,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        repositoryPath: '/test',
      };

      const output = formatDetailedStats(stats, '/test/repo');

      expect(output).toContain('Repository Overview');
      expect(output).not.toContain('Language Breakdown');
      expect(output).not.toContain('Component Types');
    });

    it('should show packages when requested and available', () => {
      const stats: DetailedIndexStats = {
        filesScanned: 100,
        documentsExtracted: 500,
        documentsIndexed: 500,
        vectorsStored: 500,
        duration: 5000,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        repositoryPath: '/test',
        byPackage: {
          'packages/core': {
            name: '@lytics/dev-agent-core',
            path: 'packages/core',
            files: 50,
            components: 250,
            languages: {},
          },
        },
      };

      const output = formatDetailedStats(stats, '/test/repo', { showPackages: true });

      expect(output).toContain('Packages');
      expect(output).toContain('@lytics/dev-agent-core');
    });
  });
});
