import { describe, expect, it } from 'vitest';
import {
  addIncrementalComponentStats,
  addIncrementalLanguageStats,
  addIncrementalPackageStats,
  type MergeableStats,
  mergeStats,
  subtractDeletedFiles,
} from '../stats-merger';
import type { FileMetadata, LanguageStats, PackageStats, SupportedLanguage } from '../types';

describe('stats-merger', () => {
  describe('subtractDeletedFiles', () => {
    it('should subtract file count for deleted files', () => {
      const stats: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 3, components: 10, lines: 100 },
        javascript: { files: 2, components: 5, lines: 50 },
      };

      const deleted = [
        {
          path: 'deleted.ts',
          metadata: { language: 'typescript' } as FileMetadata,
        },
      ];

      const result = subtractDeletedFiles(stats, deleted);

      expect(result.typescript).toEqual({ files: 2, components: 10, lines: 100 });
      expect(result.javascript).toEqual({ files: 2, components: 5, lines: 50 });
    });

    it('should remove language when no files left', () => {
      const stats: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 1, components: 2, lines: 20 },
      };

      const deleted = [
        {
          path: 'only.ts',
          metadata: { language: 'typescript' } as FileMetadata,
        },
      ];

      const result = subtractDeletedFiles(stats, deleted);

      expect(result.typescript).toBeUndefined();
    });

    it('should handle deleting from non-existent language gracefully', () => {
      const stats: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 2, components: 5, lines: 50 },
      };

      const deleted = [
        {
          path: 'deleted.go',
          metadata: { language: 'go' } as FileMetadata,
        },
      ];

      const result = subtractDeletedFiles(stats, deleted);

      expect(result).toEqual(stats);
    });

    it('should not mutate original stats', () => {
      const stats: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 3, components: 10, lines: 100 },
      };

      const original = JSON.parse(JSON.stringify(stats));
      const deleted = [
        {
          path: 'deleted.ts',
          metadata: { language: 'typescript' } as FileMetadata,
        },
      ];

      subtractDeletedFiles(stats, deleted);

      expect(stats).toEqual(original);
    });

    it('should handle multiple deletions of same language', () => {
      const stats: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 5, components: 20, lines: 200 },
      };

      const deleted = [
        {
          path: 'deleted1.ts',
          metadata: { language: 'typescript' } as FileMetadata,
        },
        {
          path: 'deleted2.ts',
          metadata: { language: 'typescript' } as FileMetadata,
        },
      ];

      const result = subtractDeletedFiles(stats, deleted);

      expect(result.typescript).toEqual({ files: 3, components: 20, lines: 200 });
    });
  });

  describe('addIncrementalLanguageStats', () => {
    it('should add new language', () => {
      const current: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 2, components: 10, lines: 100 },
      };

      const incremental: Partial<Record<SupportedLanguage, LanguageStats>> = {
        javascript: { files: 1, components: 3, lines: 30 },
      };

      const result = addIncrementalLanguageStats(current, incremental);

      expect(result.typescript).toEqual({ files: 2, components: 10, lines: 100 });
      expect(result.javascript).toEqual({ files: 1, components: 3, lines: 30 });
    });

    it('should merge with existing language', () => {
      const current: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 2, components: 10, lines: 100 },
      };

      const incremental: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 1, components: 5, lines: 50 },
      };

      const result = addIncrementalLanguageStats(current, incremental);

      expect(result.typescript).toEqual({ files: 3, components: 15, lines: 150 });
    });

    it('should not mutate original stats', () => {
      const current: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 2, components: 10, lines: 100 },
      };

      const original = JSON.parse(JSON.stringify(current));
      const incremental: Partial<Record<SupportedLanguage, LanguageStats>> = {
        javascript: { files: 1, components: 3, lines: 30 },
      };

      addIncrementalLanguageStats(current, incremental);

      expect(current).toEqual(original);
    });

    it('should handle empty incremental stats', () => {
      const current: Partial<Record<SupportedLanguage, LanguageStats>> = {
        typescript: { files: 2, components: 10, lines: 100 },
      };

      const result = addIncrementalLanguageStats(current, {});

      expect(result).toEqual(current);
    });
  });

  describe('addIncrementalComponentStats', () => {
    it('should add new component types', () => {
      const current = {
        function: 10,
        class: 5,
      };

      const incremental = {
        interface: 3,
      };

      const result = addIncrementalComponentStats(current, incremental);

      expect(result).toEqual({
        function: 10,
        class: 5,
        interface: 3,
      });
    });

    it('should merge with existing types', () => {
      const current = {
        function: 10,
        class: 5,
      };

      const incremental = {
        function: 3,
        class: 2,
      };

      const result = addIncrementalComponentStats(current, incremental);

      expect(result).toEqual({
        function: 13,
        class: 7,
      });
    });

    it('should skip non-numeric values', () => {
      const current = {
        function: 10,
      };

      const incremental = {
        function: 3,
        invalid: 'not-a-number' as any,
      };

      const result = addIncrementalComponentStats(current, incremental);

      expect(result).toEqual({
        function: 13,
      });
    });
  });

  describe('addIncrementalPackageStats', () => {
    it('should add new package', () => {
      const current: Record<string, PackageStats> = {
        pkg1: {
          name: 'package-1',
          path: 'packages/pkg1',
          files: 5,
          components: 20,
          languages: { typescript: 5 },
        },
      };

      const incremental: Record<string, PackageStats> = {
        pkg2: {
          name: 'package-2',
          path: 'packages/pkg2',
          files: 3,
          components: 10,
          languages: { javascript: 3 },
        },
      };

      const result = addIncrementalPackageStats(current, incremental);

      expect(result.pkg1).toEqual(current.pkg1);
      expect(result.pkg2).toEqual(incremental.pkg2);
    });

    it('should merge with existing package', () => {
      const current: Record<string, PackageStats> = {
        pkg1: {
          name: 'package-1',
          path: 'packages/pkg1',
          files: 5,
          components: 20,
          languages: { typescript: 5 },
        },
      };

      const incremental: Record<string, PackageStats> = {
        pkg1: {
          name: 'package-1',
          path: 'packages/pkg1',
          files: 2,
          components: 8,
          languages: { typescript: 1, javascript: 1 },
        },
      };

      const result = addIncrementalPackageStats(current, incremental);

      expect(result.pkg1).toEqual({
        name: 'package-1',
        path: 'packages/pkg1',
        files: 7,
        components: 28,
        languages: { typescript: 6, javascript: 1 },
      });
    });
  });

  describe('mergeStats', () => {
    it('should perform full merge operation', () => {
      const currentStats: MergeableStats = {
        byLanguage: {
          typescript: { files: 10, components: 50, lines: 500 },
          javascript: { files: 5, components: 20, lines: 200 },
        },
        byComponentType: {
          function: 40,
          class: 20,
        },
      };

      const deletedFiles = [
        {
          path: 'deleted.js',
          metadata: { language: 'javascript' } as FileMetadata,
        },
      ];

      const changedFiles = [
        {
          path: 'changed.ts',
          metadata: { language: 'typescript' } as FileMetadata,
        },
      ];

      const incrementalStats = {
        byLanguage: {
          typescript: { files: 1, components: 6, lines: 60 },
          go: { files: 1, components: 3, lines: 30 },
        } as Partial<Record<string, LanguageStats>>,
        byComponentType: {
          function: 5,
          struct: 3,
        },
        byPackage: {},
      };

      const result = mergeStats({
        currentStats,
        deletedFiles,
        changedFiles,
        incrementalStats,
      });

      // TypeScript: 10 - 1 (changed) + 1 (re-added) = 10 files
      expect(result.byLanguage?.typescript).toEqual({
        files: 10,
        components: 56,
        lines: 560,
      });

      // JavaScript: 5 - 1 (deleted) = 4 files
      expect(result.byLanguage?.javascript).toEqual({
        files: 4,
        components: 20,
        lines: 200,
      });

      // Go: new language
      expect(result.byLanguage?.go).toEqual({
        files: 1,
        components: 3,
        lines: 30,
      });

      // Component types merged
      expect(result.byComponentType).toEqual({
        function: 45,
        class: 20,
        struct: 3,
      });
    });

    it('should handle empty current stats', () => {
      const currentStats: MergeableStats = {
        byLanguage: {},
        byComponentType: {},
      };

      const incrementalStats = {
        byLanguage: {
          typescript: { files: 1, components: 5, lines: 50 },
        } as Partial<Record<string, LanguageStats>>,
        byComponentType: {
          function: 3,
        },
        byPackage: {},
      };

      const result = mergeStats({
        currentStats,
        deletedFiles: [],
        changedFiles: [],
        incrementalStats,
      });

      expect(result.byLanguage).toEqual(incrementalStats.byLanguage);
      expect(result.byComponentType).toEqual(incrementalStats.byComponentType);
    });

    it('should not mutate input stats', () => {
      const currentStats: MergeableStats = {
        byLanguage: {
          typescript: { files: 10, components: 50, lines: 500 },
        },
        byComponentType: {
          function: 40,
        },
      };

      const original = JSON.parse(JSON.stringify(currentStats));

      mergeStats({
        currentStats,
        deletedFiles: [],
        changedFiles: [],
        incrementalStats: {
          byLanguage: {
            javascript: { files: 1, components: 3, lines: 30 },
          } as Partial<Record<string, LanguageStats>>,
          byComponentType: {},
          byPackage: {},
        },
      });

      expect(currentStats).toEqual(original);
    });
  });
});
