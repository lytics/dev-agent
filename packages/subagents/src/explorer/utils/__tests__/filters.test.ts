/**
 * Tests for result filtering utilities
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import { describe, expect, it } from 'vitest';
import { isNotReferenceFile, matchesFileType } from '../filters';

describe('Filter Utilities', () => {
  const mockSearchResult: SearchResult = {
    id: 'doc1',
    score: 0.9,
    metadata: {
      path: '/src/components/button.ts',
      type: 'function',
      language: 'typescript',
      name: 'createButton',
      startLine: 10,
      endLine: 50,
    },
  };

  describe('matchesFileType', () => {
    it('should return true for matching file types', () => {
      expect(matchesFileType(mockSearchResult, ['.ts', '.js'])).toBe(true);
    });

    it('should return false for non-matching file types', () => {
      expect(matchesFileType(mockSearchResult, ['.tsx', '.jsx'])).toBe(false);
    });

    it('should handle empty file types array', () => {
      expect(matchesFileType(mockSearchResult, [])).toBe(false);
    });

    it('should match the first matching extension', () => {
      expect(matchesFileType(mockSearchResult, ['.tsx', '.ts', '.js'])).toBe(true);
    });

    it('should be case-sensitive', () => {
      expect(matchesFileType(mockSearchResult, ['.TS', '.JS'])).toBe(false);
    });

    it('should handle complex file extensions', () => {
      const result: SearchResult = {
        id: 'doc2',
        score: 0.8,
        metadata: {
          path: '/src/data/config.test.ts',
          type: 'test',
          language: 'typescript',
          name: 'config tests',
        },
      };

      expect(matchesFileType(result, ['.test.ts', '.spec.ts'])).toBe(true);
    });

    it('should filter TypeScript files from mixed results', () => {
      const results: SearchResult[] = [
        {
          id: 'doc1',
          score: 0.9,
          metadata: {
            path: '/src/button.ts',
            type: 'function',
            language: 'typescript',
            name: 'Button',
          },
        },
        {
          id: 'doc2',
          score: 0.8,
          metadata: {
            path: '/src/auth.js',
            type: 'function',
            language: 'javascript',
            name: 'Auth',
          },
        },
        {
          id: 'doc3',
          score: 0.7,
          metadata: {
            path: '/src/app.tsx',
            type: 'component',
            language: 'typescript',
            name: 'App',
          },
        },
      ];

      const tsFiles = results.filter((r) => matchesFileType(r, ['.ts', '.tsx']));
      expect(tsFiles).toHaveLength(2);
      expect(tsFiles[0].metadata.path).toBe('/src/button.ts');
      expect(tsFiles[1].metadata.path).toBe('/src/app.tsx');
    });

    it('should handle markdown and documentation files', () => {
      const mdResult: SearchResult = {
        id: 'doc-md',
        score: 0.85,
        metadata: {
          path: '/docs/architecture.md',
          type: 'document',
          language: 'markdown',
          name: 'Architecture',
        },
      };

      expect(matchesFileType(mdResult, ['.md', '.mdx'])).toBe(true);
      expect(matchesFileType(mdResult, ['.ts', '.js'])).toBe(false);
    });
  });

  describe('isNotReferenceFile', () => {
    it('should return true if the result path is different from the reference path', () => {
      expect(isNotReferenceFile(mockSearchResult, '/src/another-file.ts')).toBe(true);
    });

    it('should return false if the result path is the same as the reference path', () => {
      expect(isNotReferenceFile(mockSearchResult, '/src/components/button.ts')).toBe(false);
    });

    it('should be case-sensitive for file paths', () => {
      expect(isNotReferenceFile(mockSearchResult, '/src/components/Button.ts')).toBe(true);
    });

    it('should handle paths with different separators', () => {
      expect(isNotReferenceFile(mockSearchResult, '/src/components\\button.ts')).toBe(true);
    });

    it('should filter out reference file from similar results', () => {
      const results: SearchResult[] = [
        {
          id: 'doc1',
          score: 1.0,
          metadata: { path: '/src/auth.ts', type: 'class', language: 'typescript', name: 'Auth' },
        },
        {
          id: 'doc2',
          score: 0.9,
          metadata: {
            path: '/src/user-auth.ts',
            type: 'class',
            language: 'typescript',
            name: 'UserAuth',
          },
        },
        {
          id: 'doc3',
          score: 0.85,
          metadata: {
            path: '/src/api-auth.ts',
            type: 'class',
            language: 'typescript',
            name: 'ApiAuth',
          },
        },
      ];

      const filtered = results.filter((r) => isNotReferenceFile(r, '/src/auth.ts'));
      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.metadata.path !== '/src/auth.ts')).toBe(true);
    });

    it('should handle absolute vs relative paths', () => {
      const result: SearchResult = {
        id: 'doc1',
        score: 0.9,
        metadata: {
          path: '/absolute/path/file.ts',
          type: 'module',
          language: 'typescript',
          name: 'file',
        },
      };

      expect(isNotReferenceFile(result, '/absolute/path/file.ts')).toBe(false);
      expect(isNotReferenceFile(result, 'relative/path/file.ts')).toBe(true);
    });
  });

  describe('Combined filtering', () => {
    it('should chain multiple filters', () => {
      const results: SearchResult[] = [
        {
          id: 'doc1',
          score: 1.0,
          metadata: {
            path: '/src/button.ts',
            type: 'component',
            language: 'typescript',
            name: 'Button',
          },
        },
        {
          id: 'doc2',
          score: 0.95,
          metadata: {
            path: '/src/input.tsx',
            type: 'component',
            language: 'typescript',
            name: 'Input',
          },
        },
        {
          id: 'doc3',
          score: 0.9,
          metadata: {
            path: '/src/utils.js',
            type: 'utility',
            language: 'javascript',
            name: 'utils',
          },
        },
        {
          id: 'doc4',
          score: 0.85,
          metadata: {
            path: '/src/config.ts',
            type: 'config',
            language: 'typescript',
            name: 'config',
          },
        },
      ];

      const filtered = results
        .filter((r) => matchesFileType(r, ['.ts', '.tsx']))
        .filter((r) => isNotReferenceFile(r, '/src/button.ts'));

      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.metadata.path)).toEqual(['/src/input.tsx', '/src/config.ts']);
    });
  });
});
