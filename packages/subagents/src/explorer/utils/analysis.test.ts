/**
 * Tests for code analysis utilities
 */

import { describe, expect, it } from 'vitest';
import { calculateCoverage, getCommonPatterns, sortAndLimitPatterns } from './analysis';

describe('Analysis Utilities', () => {
  describe('getCommonPatterns', () => {
    it('should return a predefined list of common patterns', () => {
      const patterns = getCommonPatterns();
      expect(patterns).toEqual([
        'class',
        'function',
        'interface',
        'type',
        'async',
        'export',
        'import',
        'const',
      ]);
    });

    it('should return the same list on multiple calls', () => {
      const patterns1 = getCommonPatterns();
      const patterns2 = getCommonPatterns();
      expect(patterns1).toEqual(patterns2);
    });

    it('should include TypeScript-specific patterns', () => {
      const patterns = getCommonPatterns();
      expect(patterns).toContain('interface');
      expect(patterns).toContain('type');
    });

    it('should include common JavaScript patterns', () => {
      const patterns = getCommonPatterns();
      expect(patterns).toContain('class');
      expect(patterns).toContain('function');
      expect(patterns).toContain('const');
    });

    it('should include module patterns', () => {
      const patterns = getCommonPatterns();
      expect(patterns).toContain('import');
      expect(patterns).toContain('export');
    });

    it('should include async pattern', () => {
      const patterns = getCommonPatterns();
      expect(patterns).toContain('async');
    });
  });

  describe('sortAndLimitPatterns', () => {
    const mockPatterns = [
      { pattern: 'function', count: 50, files: ['/src/a.ts', '/src/b.ts'] },
      { pattern: 'class', count: 100, files: ['/src/c.ts'] },
      { pattern: 'const', count: 25, files: ['/src/d.ts', '/src/e.ts', '/src/f.ts'] },
      { pattern: 'interface', count: 75, files: ['/src/g.ts'] },
      { pattern: 'type', count: 30, files: ['/src/h.ts'] },
    ];

    it('should sort patterns by count in descending order', () => {
      const sorted = sortAndLimitPatterns(mockPatterns, 10);
      expect(sorted[0].pattern).toBe('class');
      expect(sorted[1].pattern).toBe('interface');
      expect(sorted[2].pattern).toBe('function');
      expect(sorted[3].pattern).toBe('type');
      expect(sorted[4].pattern).toBe('const');
    });

    it('should limit results to specified count', () => {
      const limited = sortAndLimitPatterns(mockPatterns, 3);
      expect(limited).toHaveLength(3);
      expect(limited.map((p) => p.pattern)).toEqual(['class', 'interface', 'function']);
    });

    it('should handle limit larger than array size', () => {
      const all = sortAndLimitPatterns(mockPatterns, 100);
      expect(all).toHaveLength(5);
    });

    it('should handle limit of 0', () => {
      const none = sortAndLimitPatterns(mockPatterns, 0);
      expect(none).toHaveLength(0);
    });

    it('should handle limit of 1', () => {
      const one = sortAndLimitPatterns(mockPatterns, 1);
      expect(one).toHaveLength(1);
      expect(one[0].pattern).toBe('class');
    });

    it('should handle empty array', () => {
      const empty = sortAndLimitPatterns([], 10);
      expect(empty).toHaveLength(0);
    });

    it('should preserve pattern data', () => {
      const sorted = sortAndLimitPatterns(mockPatterns, 3);
      expect(sorted[0]).toEqual({ pattern: 'class', count: 100, files: ['/src/c.ts'] });
    });

    it('should sort patterns with equal counts consistently', () => {
      const equalCounts = [
        { pattern: 'a', count: 10, files: [] },
        { pattern: 'b', count: 10, files: [] },
        { pattern: 'c', count: 10, files: [] },
      ];

      const sorted = sortAndLimitPatterns(equalCounts, 10);
      expect(sorted).toHaveLength(3);
      // All have same count, so order is maintained
      for (const item of sorted) {
        expect(item.count).toBe(10);
      }
    });

    it('should handle patterns with zero count', () => {
      const withZero = [
        { pattern: 'function', count: 10, files: [] },
        { pattern: 'class', count: 0, files: [] },
        { pattern: 'const', count: 5, files: [] },
      ];

      const sorted = sortAndLimitPatterns(withZero, 10);
      expect(sorted[0].pattern).toBe('function');
      expect(sorted[1].pattern).toBe('const');
      expect(sorted[2].pattern).toBe('class');
    });

    it('should handle top 10 use case', () => {
      const manyPatterns = Array.from({ length: 20 }, (_, i) => ({
        pattern: `pattern${i}`,
        count: 100 - i * 5,
        files: [],
      }));

      const top10 = sortAndLimitPatterns(manyPatterns, 10);
      expect(top10).toHaveLength(10);
      expect(top10[0].count).toBe(100);
      expect(top10[9].count).toBe(55);
    });
  });

  describe('calculateCoverage', () => {
    it('should calculate coverage correctly for non-zero total', () => {
      const coverage = calculateCoverage(50, 100);
      expect(coverage).toEqual({ indexed: 50, total: 100, percentage: 50 });
    });

    it('should handle zero total gracefully', () => {
      const coverage = calculateCoverage(0, 0);
      expect(coverage).toEqual({ indexed: 0, total: 0, percentage: 0 });
    });

    it('should handle zero indexed items', () => {
      const coverage = calculateCoverage(0, 100);
      expect(coverage).toEqual({ indexed: 0, total: 100, percentage: 0 });
    });

    it('should handle 100% coverage', () => {
      const coverage = calculateCoverage(100, 100);
      expect(coverage).toEqual({ indexed: 100, total: 100, percentage: 100 });
    });

    it('should calculate decimal percentages correctly', () => {
      const coverage = calculateCoverage(33, 100);
      expect(coverage.percentage).toBe(33);
    });

    it('should handle partial coverage', () => {
      const coverage = calculateCoverage(850, 1000);
      expect(coverage).toEqual({ indexed: 850, total: 1000, percentage: 85 });
    });

    it('should handle very small percentages', () => {
      const coverage = calculateCoverage(1, 1000);
      expect(coverage.percentage).toBe(0.1);
    });

    it('should handle large numbers', () => {
      const coverage = calculateCoverage(9_500_000, 10_000_000);
      expect(coverage).toEqual({ indexed: 9_500_000, total: 10_000_000, percentage: 95 });
    });

    it('should handle edge case where indexed equals total', () => {
      const coverage = calculateCoverage(42, 42);
      expect(coverage.percentage).toBe(100);
    });

    it('should return precise floating point values', () => {
      const coverage = calculateCoverage(1, 3);
      expect(coverage.percentage).toBeCloseTo(33.333, 2);
    });

    it('should preserve indexed and total values', () => {
      const coverage = calculateCoverage(75, 200);
      expect(coverage.indexed).toBe(75);
      expect(coverage.total).toBe(200);
    });
  });
});
