/**
 * ExploreAdapter Unit Tests
 */

import type { RepositoryIndexer, SearchResult } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExploreAdapter } from '../built-in/explore-adapter';
import type { ToolExecutionContext } from '../types';

describe('ExploreAdapter', () => {
  let adapter: ExploreAdapter;
  let mockIndexer: RepositoryIndexer;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    // Mock RepositoryIndexer
    mockIndexer = {
      search: vi.fn(),
    } as unknown as RepositoryIndexer;

    // Create adapter
    adapter = new ExploreAdapter({
      repositoryPath: '/test/repo',
      repositoryIndexer: mockIndexer,
      defaultLimit: 10,
      defaultThreshold: 0.7,
      defaultFormat: 'compact',
    });

    // Mock execution context
    mockContext = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as unknown as ToolExecutionContext;
  });

  describe('Tool Definition', () => {
    it('should return correct tool definition', () => {
      const definition = adapter.getToolDefinition();

      expect(definition.name).toBe('dev_explore');
      expect(definition.description).toContain('semantic search');
      expect(definition.inputSchema.required).toEqual(['action', 'query']);
      expect(definition.inputSchema.properties.action.enum).toEqual([
        'pattern',
        'similar',
        'relationships',
      ]);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid action', async () => {
      const result = await adapter.execute(
        {
          action: 'invalid',
          query: 'test',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ACTION');
    });

    it('should reject empty query', async () => {
      const result = await adapter.execute(
        {
          action: 'pattern',
          query: '',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_QUERY');
    });

    it('should reject invalid limit', async () => {
      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'test',
          limit: 0,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_LIMIT');
    });

    it('should reject invalid threshold', async () => {
      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'test',
          threshold: 1.5,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_THRESHOLD');
    });

    it('should reject invalid format', async () => {
      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'test',
          format: 'invalid',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_FORMAT');
    });
  });

  describe('Pattern Search', () => {
    it('should search for patterns in compact format', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: {
            path: 'src/auth.ts',
            type: 'function',
            name: 'authenticate',
          },
        },
        {
          id: '2',
          score: 0.8,
          metadata: {
            path: 'src/middleware/auth.ts',
            type: 'function',
            name: 'checkAuth',
          },
        },
      ];

      vi.mocked(mockIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'authentication',
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('Pattern Search Results');
      expect((result.data as { content: string })?.content).toContain('authenticate');
      expect((result.data as { content: string })?.content).toContain('src/auth.ts');
    });

    it('should search for patterns in verbose format', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: {
            path: 'src/auth.ts',
            type: 'function',
            name: 'authenticate',
            startLine: 10,
            endLine: 20,
          },
        },
      ];

      vi.mocked(mockIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'authentication',
          format: 'verbose',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('### authenticate');
      expect((result.data as { content: string })?.content).toContain('**Lines:** 10-20');
    });

    it('should filter by file types', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: {
            path: 'src/auth.ts',
            type: 'function',
            name: 'authenticate',
          },
        },
        {
          id: '2',
          score: 0.8,
          metadata: {
            path: 'src/auth.js',
            type: 'function',
            name: 'checkAuth',
          },
        },
      ];

      vi.mocked(mockIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'authentication',
          fileTypes: ['.ts'],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('src/auth.ts');
      expect((result.data as { content: string })?.content).not.toContain('src/auth.js');
    });

    it('should handle no results found', async () => {
      vi.mocked(mockIndexer.search).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'nonexistent',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('No matching patterns found');
    });
  });

  describe('Similar Code Search', () => {
    it('should find similar code in compact format', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 1.0,
          metadata: {
            path: 'src/auth.ts', // Reference file itself
            type: 'file',
            name: 'auth.ts',
          },
        },
        {
          id: '2',
          score: 0.85,
          metadata: {
            path: 'src/auth-utils.ts',
            type: 'file',
            name: 'auth-utils.ts',
          },
        },
      ];

      vi.mocked(mockIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'similar',
          query: 'src/auth.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('Similar Code');
      expect((result.data as { content: string })?.content).toContain('src/auth-utils.ts');
      // Note: Reference file path appears in header but not in results list
      expect((result.data as { content: string })?.content).toContain(
        '**Reference:** `src/auth.ts`'
      );
    });

    it('should handle no similar files', async () => {
      vi.mocked(mockIndexer.search).mockResolvedValue([
        {
          id: '1',
          score: 1.0,
          metadata: {
            path: 'src/unique.ts',
            type: 'file',
            name: 'unique.ts',
          },
        },
      ]);

      const result = await adapter.execute(
        {
          action: 'similar',
          query: 'src/unique.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('No similar code found');
    });
  });

  describe('Relationships', () => {
    it('should find relationships in compact format', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.8,
          metadata: {
            path: 'src/app.ts',
            type: 'import',
            name: 'import statement',
          },
        },
        {
          id: '2',
          score: 0.75,
          metadata: {
            path: 'src/routes.ts',
            type: 'import',
            name: 'import statement',
          },
        },
      ];

      vi.mocked(mockIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'relationships',
          query: 'src/auth.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('Code Relationships');
      expect((result.data as { content: string })?.content).toContain('src/app.ts');
    });

    it('should handle no relationships found', async () => {
      vi.mocked(mockIndexer.search).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          action: 'relationships',
          query: 'src/isolated.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('No relationships found');
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found errors', async () => {
      vi.mocked(mockIndexer.search).mockRejectedValue(new Error('File not found'));

      const result = await adapter.execute(
        {
          action: 'similar',
          query: 'nonexistent.ts',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_NOT_FOUND');
    });

    it('should handle index not ready errors', async () => {
      vi.mocked(mockIndexer.search).mockRejectedValue(new Error('Index not indexed'));

      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'test',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INDEX_NOT_READY');
    });

    it('should handle generic errors', async () => {
      vi.mocked(mockIndexer.search).mockRejectedValue(new Error('Unknown error'));

      const result = await adapter.execute(
        {
          action: 'pattern',
          query: 'test',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXPLORATION_ERROR');
    });
  });
});
