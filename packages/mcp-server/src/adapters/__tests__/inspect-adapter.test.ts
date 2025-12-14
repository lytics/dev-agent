/**
 * InspectAdapter Unit Tests
 */

import type { SearchResult, SearchService } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectAdapter } from '../built-in/inspect-adapter.js';
import type { ToolExecutionContext } from '../types.js';

describe('InspectAdapter', () => {
  let adapter: InspectAdapter;
  let mockSearchService: SearchService;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    // Mock SearchService
    mockSearchService = {
      search: vi.fn(),
      findSimilar: vi.fn(),
    } as unknown as SearchService;

    // Create adapter
    adapter = new InspectAdapter({
      repositoryPath: '/test/repo',
      searchService: mockSearchService,
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

      expect(definition.name).toBe('dev_inspect');
      expect(definition.description).toContain('compare');
      expect(definition.description).toContain('validate');
      expect(definition.inputSchema.required).toEqual(['action', 'query']);
      expect((definition.inputSchema.properties as any)?.action.enum).toEqual([
        'compare',
        'validate',
      ]);
    });

    it('should have file path description in query field', () => {
      const definition = adapter.getToolDefinition();
      const queryProp = (definition.inputSchema.properties as any)?.query;

      expect(queryProp.description.toLowerCase()).toContain('file path');
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid action', async () => {
      const result = await adapter.execute(
        {
          action: 'invalid',
          query: 'src/test.ts',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('action');
    });

    it('should reject empty query', async () => {
      const result = await adapter.execute(
        {
          action: 'compare',
          query: '',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('query');
    });

    it('should reject invalid limit', async () => {
      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
          limit: 0,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('limit');
    });

    it('should reject invalid threshold', async () => {
      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
          threshold: 1.5,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('threshold');
    });

    it('should accept valid compare action', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: {
            path: 'src/other.ts',
            name: 'otherFunction',
            type: 'function',
          },
        },
      ];

      (mockSearchService.findSimilar as any).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSearchService.findSimilar).toHaveBeenCalledWith('src/test.ts', {
        limit: 11, // +1 for self-exclusion
        threshold: 0.7,
      });
    });

    it('should accept valid validate action', async () => {
      const result = await adapter.execute(
        {
          action: 'validate',
          query: 'src/test.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('validate');
      expect(result.data?.content).toContain('coming soon');
    });
  });

  describe('Compare Action (Similar Code)', () => {
    it('should find similar code successfully', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.95,
          metadata: {
            path: 'src/similar1.ts',
            name: 'similarFunction1',
            type: 'function',
          },
        },
        {
          id: '2',
          score: 0.85,
          metadata: {
            path: 'src/similar2.ts',
            name: 'similarFunction2',
            type: 'function',
          },
        },
      ];

      (mockSearchService.findSimilar as any).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('compare');
      expect(result.data?.query).toBe('src/test.ts');
      expect(result.data?.format).toBe('compact');
      expect(result.data?.content).toContain('Similar Code');
      expect(result.data?.content).toContain('src/similar1.ts');
      expect(result.data?.content).toContain('src/similar2.ts');
    });

    it('should exclude reference file from results', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 1.0,
          metadata: {
            path: 'src/test.ts', // Self-match
            name: 'testFunction',
            type: 'function',
          },
        },
        {
          id: '2',
          score: 0.9,
          metadata: {
            path: 'src/similar.ts',
            name: 'similarFunction',
            type: 'function',
          },
        },
      ];

      (mockSearchService.findSimilar as any).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      // Should exclude self-match from similar files list (but reference line will contain it)
      const content = result.data?.content || '';
      const lines = content.split('\n');
      // Find the similar files list (lines starting with '-')
      const similarFiles = lines.filter((line) => line.trim().startsWith('- `'));
      // Check that self is excluded from the list
      expect(similarFiles.some((line) => line.includes('src/test.ts'))).toBe(false);
      expect(similarFiles.some((line) => line.includes('src/similar.ts'))).toBe(true);
    });

    it('should handle no similar code found', async () => {
      (mockSearchService.findSimilar as any).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/unique.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.content).toContain('No similar code found');
      expect(result.data?.content).toContain('unique');
    });

    it('should apply limit correctly', async () => {
      const mockResults: SearchResult[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        score: 0.9 - i * 0.05,
        metadata: {
          path: `src/similar${i}.ts`,
          name: `similarFunction${i}`,
          type: 'function',
        },
      }));

      (mockSearchService.findSimilar as any).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
          limit: 5,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSearchService.findSimilar).toHaveBeenCalledWith('src/test.ts', {
        limit: 6, // +1 for self-exclusion
        threshold: 0.7,
      });
    });

    it('should apply threshold correctly', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.95,
          metadata: {
            path: 'src/similar.ts',
            name: 'similarFunction',
            type: 'function',
          },
        },
      ];

      (mockSearchService.findSimilar as any).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
          threshold: 0.9,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSearchService.findSimilar).toHaveBeenCalledWith('src/test.ts', {
        limit: 11,
        threshold: 0.9,
      });
    });

    it('should support verbose format', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.95,
          metadata: {
            path: 'src/similar.ts',
            name: 'similarFunction',
            type: 'function',
          },
        },
      ];

      (mockSearchService.findSimilar as any).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
          format: 'verbose',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.format).toBe('verbose');
      expect(result.data?.content).toContain('Similar Code Analysis');
      expect(result.data?.content).toContain('Reference File');
      expect(result.data?.content).toContain('Total Matches');
    });
  });

  describe('Validate Action (Pattern Consistency)', () => {
    it('should return placeholder message', async () => {
      const result = await adapter.execute(
        {
          action: 'validate',
          query: 'src/hooks/useAuth.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('validate');
      expect(result.data?.content).toContain('Pattern Validation');
      expect(result.data?.content).toContain('coming soon');
      expect(result.data?.content).toContain('src/hooks/useAuth.ts');
    });

    it('should suggest using compare action', async () => {
      const result = await adapter.execute(
        {
          action: 'validate',
          query: 'src/test.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.content).toContain('dev_inspect');
      expect(result.data?.content).toContain('action: "compare"');
    });
  });

  describe('Error Handling', () => {
    it('should handle search service errors', async () => {
      (mockSearchService.findSimilar as any).mockRejectedValue(new Error('Search failed'));

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INSPECTION_ERROR');
      expect(result.error?.message).toContain('Search failed');
    });

    it('should handle file not found errors', async () => {
      (mockSearchService.findSimilar as any).mockRejectedValue(new Error('File not found'));

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/missing.ts',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_NOT_FOUND');
      expect(result.error?.message).toContain('not found');
      expect(result.error?.suggestion).toContain('Check the file path');
    });

    it('should handle index not ready errors', async () => {
      (mockSearchService.findSimilar as any).mockRejectedValue(new Error('Index not indexed'));

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INDEX_NOT_READY');
      expect(result.error?.message).toContain('not ready');
      expect(result.error?.suggestion).toContain('dev index');
    });
  });

  describe('Output Validation', () => {
    it('should validate output schema', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: {
            path: 'src/similar.ts',
            name: 'similarFunction',
            type: 'function',
          },
        },
      ];

      (mockSearchService.findSimilar as any).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'compare',
          query: 'src/test.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('action');
      expect(result.data).toHaveProperty('query');
      expect(result.data).toHaveProperty('format');
      expect(result.data).toHaveProperty('content');
      expect(typeof result.data?.content).toBe('string');
    });
  });
});
