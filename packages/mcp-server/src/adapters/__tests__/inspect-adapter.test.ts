/**
 * InspectAdapter Unit Tests
 *
 * Tests for the refactored single-purpose dev_inspect tool
 */

import * as path from 'node:path';
import type { SearchResult, SearchService } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectAdapter } from '../built-in/inspect-adapter.js';
import type { ToolExecutionContext } from '../types.js';

describe('InspectAdapter', () => {
  let adapter: InspectAdapter;
  let mockSearchService: SearchService;
  let mockContext: ToolExecutionContext;
  let tempDir: string;

  beforeEach(async () => {
    // Use the fixtures directory from adapters
    const fixturesPath = path.join(__dirname, '../__fixtures__');
    tempDir = fixturesPath;

    // Mock SearchService
    mockSearchService = {
      search: vi.fn(),
      findSimilar: vi.fn(),
    } as unknown as SearchService;

    // Create adapter with fixtures directory
    adapter = new InspectAdapter({
      repositoryPath: tempDir,
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
      expect(definition.description).toContain('pattern');
      expect(definition.description).toContain('similar');
      expect(definition.inputSchema.required).toContain('query');
      expect(definition.inputSchema.required).not.toContain('action');
    });

    it('should have file path description in query field', () => {
      const definition = adapter.getToolDefinition();
      const queryProp = (definition.inputSchema.properties as any)?.query;

      expect(queryProp.description.toLowerCase()).toContain('file path');
    });

    it('should have patternsAnalyzed in output schema', () => {
      const definition = adapter.getToolDefinition();

      expect(definition.outputSchema.required).toContain('patternsAnalyzed');
      expect(definition.outputSchema.required).toContain('similarFilesCount');
    });
  });

  describe('Input Validation', () => {
    it('should reject empty query', async () => {
      const result = await adapter.execute(
        {
          query: '',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should reject invalid limit', async () => {
      const result = await adapter.execute(
        {
          query: 'src/test.ts',
          limit: -1,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should reject invalid threshold', async () => {
      const result = await adapter.execute(
        {
          query: 'src/test.ts',
          threshold: 1.5,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should accept valid inputs', async () => {
      vi.mocked(mockSearchService.findSimilar).mockResolvedValue([
        {
          id: '1',
          score: 0.9,
          metadata: { path: 'modern-typescript.ts', type: 'file' },
          content: 'test',
        },
      ]);

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
          limit: 10,
          threshold: 0.7,
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('query');
      expect(result.data).toHaveProperty('similarFilesCount');
      expect(result.data).toHaveProperty('patternsAnalyzed');
    });
  });

  describe('File Inspection', () => {
    it('should find similar files and analyze patterns', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.95,
          metadata: { path: 'modern-typescript.ts', type: 'function', name: 'validateUser' },
          content: 'export function validateUser() {}',
        },
        {
          id: '2',
          score: 0.85,
          metadata: { path: 'react-component.tsx', type: 'function', name: 'UserProfile' },
          content: 'export function UserProfile() {}',
        },
      ];

      vi.mocked(mockSearchService.findSimilar).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSearchService.findSimilar).toHaveBeenCalledWith('modern-typescript.ts', {
        limit: 11, // +1 for self-exclusion
        threshold: 0.7,
      });
      expect(result.data?.similarFilesCount).toBeGreaterThan(0);
      expect(result.data?.patternsAnalyzed).toBe(5); // 5 pattern categories
    });

    it('should exclude reference file from results', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 1.0,
          metadata: { path: 'modern-typescript.ts', type: 'file' },
          content: 'self',
        },
        {
          id: '2',
          score: 0.85,
          metadata: { path: 'legacy-javascript.js', type: 'file' },
          content: 'other',
        },
      ];

      vi.mocked(mockSearchService.findSimilar).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      // Should have exactly 1 similar file (legacy-javascript.js), not 2
      expect(result.data?.similarFilesCount).toBe(1);
      expect(result.data?.content).toContain('legacy-javascript.js');
      // Reference file should only appear in header, not in similar files list
      const lines = result.data?.content.split('\n') || [];
      const similarFilesSection = lines.slice(lines.findIndex((l) => l.includes('Similar Files')));
      const similarFilesText = similarFilesSection.join('\n');
      expect(similarFilesText).not.toMatch(/1\.\s+`modern-typescript\.ts`/);
    });

    it('should handle no similar files found', async () => {
      vi.mocked(mockSearchService.findSimilar).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          query: 'README.md',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.similarFilesCount).toBe(0);
      expect(result.data?.patternsAnalyzed).toBe(0);
      expect(result.data?.content).toContain('No similar files found');
    });

    it('should apply limit correctly', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: { path: 'modern-typescript.ts', type: 'file' },
          content: '',
        },
        {
          id: '2',
          score: 0.85,
          metadata: { path: 'react-component.tsx', type: 'file' },
          content: '',
        },
        {
          id: '3',
          score: 0.8,
          metadata: { path: 'legacy-javascript.js', type: 'file' },
          content: '',
        },
        {
          id: '4',
          score: 0.75,
          metadata: { path: 'mixed-patterns.ts', type: 'file' },
          content: '',
        },
        { id: '5', score: 0.7, metadata: { path: 'go-service.go', type: 'file' }, content: '' },
      ];

      vi.mocked(mockSearchService.findSimilar).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
          limit: 5,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSearchService.findSimilar).toHaveBeenCalledWith('modern-typescript.ts', {
        limit: 6, // +1 for self-exclusion
        threshold: 0.7,
      });
      // We have 5 fixtures total, but modern-typescript.ts is excluded as reference file
      expect(result.data?.similarFilesCount).toBe(4);
    });

    it('should apply threshold correctly', async () => {
      vi.mocked(mockSearchService.findSimilar).mockResolvedValue([]);

      await adapter.execute(
        {
          query: 'modern-typescript.ts',
          threshold: 0.9,
        },
        mockContext
      );

      expect(mockSearchService.findSimilar).toHaveBeenCalledWith('modern-typescript.ts', {
        limit: 11,
        threshold: 0.9,
      });
    });
  });

  describe('Output Formatting', () => {
    it('should support compact format', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: { path: 'legacy-javascript.js', type: 'file' },
          content: 'test',
        },
      ];

      vi.mocked(mockSearchService.findSimilar).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.format).toBe('compact');
      expect(result.data?.content).toContain('File Inspection');
      expect(result.data?.content).toContain('Similar Files');
    });

    it('should support verbose format', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: { path: 'legacy-javascript.js', type: 'function', name: 'createUser' },
          content: 'test',
        },
      ];

      vi.mocked(mockSearchService.findSimilar).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
          format: 'verbose',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.format).toBe('verbose');
      expect(result.data?.content).toContain('Comprehensive Pattern Analysis');
    });
  });

  describe('Error Handling', () => {
    it('should handle search service errors', async () => {
      vi.mocked(mockSearchService.findSimilar).mockRejectedValue(new Error('Search failed'));

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('failed');
    });

    it('should handle file not found errors', async () => {
      vi.mocked(mockSearchService.findSimilar).mockRejectedValue(new Error('File not found'));

      const result = await adapter.execute(
        {
          query: 'missing-file.ts',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_NOT_FOUND');
    });

    it('should handle index not ready errors', async () => {
      vi.mocked(mockSearchService.findSimilar).mockRejectedValue(new Error('Index not indexed'));

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INDEX_NOT_READY');
    });
  });

  describe('Output Schema Validation', () => {
    it('should validate output schema', async () => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          metadata: { path: 'legacy-javascript.js', type: 'file' },
          content: 'test',
        },
      ];

      vi.mocked(mockSearchService.findSimilar).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          query: 'modern-typescript.ts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        query: expect.any(String),
        format: expect.any(String),
        content: expect.any(String),
        similarFilesCount: expect.any(Number),
        patternsAnalyzed: expect.any(Number),
      });
    });
  });
});
