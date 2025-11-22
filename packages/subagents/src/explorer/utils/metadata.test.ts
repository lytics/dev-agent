/**
 * Tests for metadata extraction utilities
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import { describe, expect, it } from 'vitest';
import { extractFilePath, extractMetadata, type ResultMetadata } from './metadata';

describe('Metadata Utilities', () => {
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

  describe('extractMetadata', () => {
    it('should correctly extract metadata from a search result', () => {
      const metadata = extractMetadata(mockSearchResult);
      expect(metadata).toEqual({
        path: '/src/components/button.ts',
        type: 'function',
        language: 'typescript',
        name: 'createButton',
        startLine: 10,
        endLine: 50,
      });
    });

    it('should preserve all metadata fields', () => {
      const metadata = extractMetadata(mockSearchResult);
      expect(metadata.path).toBe('/src/components/button.ts');
      expect(metadata.type).toBe('function');
      expect(metadata.language).toBe('typescript');
      expect(metadata.name).toBe('createButton');
      expect(metadata.startLine).toBe(10);
      expect(metadata.endLine).toBe(50);
    });

    it('should handle metadata without optional fields', () => {
      const resultWithoutLines: SearchResult = {
        id: 'doc2',
        score: 0.8,
        metadata: {
          path: '/src/index.ts',
          type: 'module',
          language: 'typescript',
          name: 'index',
        },
      };

      const metadata = extractMetadata(resultWithoutLines);
      expect(metadata.path).toBe('/src/index.ts');
      expect(metadata.startLine).toBeUndefined();
      expect(metadata.endLine).toBeUndefined();
    });
  });

  describe('extractFilePath', () => {
    it('should correctly extract the file path', () => {
      expect(extractFilePath(mockSearchResult)).toBe('/src/components/button.ts');
    });

    it('should extract path from different result types', () => {
      const results: SearchResult[] = [
        {
          id: 'doc1',
          score: 0.9,
          metadata: { path: '/src/auth.ts', type: 'class', language: 'typescript', name: 'Auth' },
        },
        {
          id: 'doc2',
          score: 0.8,
          metadata: {
            path: '/src/utils.ts',
            type: 'function',
            language: 'typescript',
            name: 'helper',
          },
        },
        {
          id: 'doc3',
          score: 0.7,
          metadata: {
            path: '/docs/README.md',
            type: 'document',
            language: 'markdown',
            name: 'README',
          },
        },
      ];

      const paths = results.map(extractFilePath);
      expect(paths).toEqual(['/src/auth.ts', '/src/utils.ts', '/docs/README.md']);
    });

    it('should handle paths with special characters', () => {
      const result: SearchResult = {
        id: 'doc-special',
        score: 0.9,
        metadata: {
          path: '/src/components/user-profile/[id].tsx',
          type: 'component',
          language: 'typescript',
          name: 'UserProfile',
        },
      };

      expect(extractFilePath(result)).toBe('/src/components/user-profile/[id].tsx');
    });
  });

  describe('ResultMetadata type', () => {
    it('should accept valid metadata structures', () => {
      const metadata: ResultMetadata = {
        path: '/src/test.ts',
        type: 'function',
        language: 'typescript',
        name: 'testFunc',
        startLine: 1,
        endLine: 10,
      };

      expect(metadata.path).toBe('/src/test.ts');
    });

    it('should allow optional fields to be omitted', () => {
      const metadata: ResultMetadata = {
        path: '/src/test.ts',
        type: 'module',
        language: 'typescript',
        name: 'test',
        // startLine and endLine are optional
      };

      expect(metadata.startLine).toBeUndefined();
      expect(metadata.endLine).toBeUndefined();
    });
  });
});
