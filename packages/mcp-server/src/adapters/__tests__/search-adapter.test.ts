/**
 * Tests for SearchAdapter
 */

import type { RepositoryIndexer, SearchResult } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger } from '../../utils/logger';
import { SearchAdapter } from '../built-in/search-adapter';
import type { AdapterContext, ToolExecutionContext } from '../types';

describe('SearchAdapter', () => {
  let mockIndexer: RepositoryIndexer;
  let adapter: SearchAdapter;
  let context: AdapterContext;
  let execContext: ToolExecutionContext;

  // Mock search results
  const mockSearchResults: SearchResult[] = [
    {
      id: 'src/auth.ts:authenticate:10',
      score: 0.92,
      metadata: {
        path: 'src/auth.ts',
        type: 'function',
        name: 'authenticate',
        startLine: 10,
        endLine: 25,
        language: 'typescript',
        exported: true,
        signature: 'export function authenticate(user: User): boolean',
      },
    },
    {
      id: 'src/middleware.ts:AuthMiddleware:5',
      score: 0.87,
      metadata: {
        path: 'src/middleware.ts',
        type: 'class',
        name: 'AuthMiddleware',
        startLine: 5,
        endLine: 30,
        language: 'typescript',
        exported: true,
      },
    },
  ];

  beforeEach(async () => {
    // Create mock indexer
    mockIndexer = {
      search: vi.fn().mockResolvedValue(mockSearchResults),
    } as unknown as RepositoryIndexer;

    // Create adapter
    adapter = new SearchAdapter({
      repositoryIndexer: mockIndexer,
      defaultFormat: 'compact',
      defaultLimit: 10,
    });

    // Create context
    const logger = new ConsoleLogger('error'); // Quiet for tests
    context = {
      agentName: 'test-agent',
      logger,
      config: {},
    };

    execContext = {
      logger,
      requestId: 'test-request',
    };

    await adapter.initialize(context);
  });

  describe('Tool Definition', () => {
    it('should provide valid tool definition', () => {
      const def = adapter.getToolDefinition();

      expect(def.name).toBe('dev_search');
      expect(def.description).toContain('Semantic search');
      expect(def.inputSchema.type).toBe('object');
      expect(def.inputSchema.properties).toHaveProperty('query');
      expect(def.inputSchema.properties).toHaveProperty('format');
      expect(def.inputSchema.properties).toHaveProperty('limit');
      expect(def.inputSchema.properties).toHaveProperty('scoreThreshold');
      expect(def.inputSchema.required).toContain('query');
    });

    it('should have correct format enum', () => {
      const def = adapter.getToolDefinition();
      const formatProp = def.inputSchema.properties?.format;

      expect(formatProp).toBeDefined();
      expect(formatProp).toHaveProperty('enum');
      expect((formatProp as { enum: string[] }).enum).toEqual(['compact', 'verbose']);
    });
  });

  describe('Query Validation', () => {
    it('should reject empty query', async () => {
      const result = await adapter.execute({ query: '' }, execContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('query');
    });

    it('should reject non-string query', async () => {
      const result = await adapter.execute({ query: 123 }, execContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('query');
    });

    it('should accept valid query', async () => {
      const result = await adapter.execute({ query: 'test function' }, execContext);

      expect(result.success).toBe(true);
    });
  });

  describe('Format Validation', () => {
    it('should accept compact format', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          format: 'compact',
        },
        execContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('format', 'compact');
    });

    it('should accept verbose format', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          format: 'verbose',
        },
        execContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('format', 'verbose');
    });

    it('should reject invalid format', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          format: 'invalid',
        },
        execContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('format');
    });

    it('should use default format when not specified', async () => {
      const result = await adapter.execute({ query: 'test' }, execContext);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('format', 'compact');
    });
  });

  describe('Limit Validation', () => {
    it('should accept valid limit', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          limit: 5,
        },
        execContext
      );

      expect(result.success).toBe(true);
    });

    it('should reject limit below 1', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          limit: 0,
        },
        execContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('limit');
    });

    it('should reject limit above 50', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          limit: 51,
        },
        execContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('limit');
    });
  });

  describe('Score Threshold Validation', () => {
    it('should accept valid threshold', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          scoreThreshold: 0.5,
        },
        execContext
      );

      expect(result.success).toBe(true);
    });

    it('should reject threshold below 0', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          scoreThreshold: -0.1,
        },
        execContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('scoreThreshold');
    });

    it('should reject threshold above 1', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          scoreThreshold: 1.1,
        },
        execContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('scoreThreshold');
    });
  });

  describe('Search Execution', () => {
    it('should return search results', async () => {
      const result = await adapter.execute(
        {
          query: 'authentication',
        },
        execContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('query', 'authentication');
      expect(result.data).toHaveProperty('content');
      expect(result.metadata).toHaveProperty('tokens');
      expect(result.metadata).toHaveProperty('duration_ms');
      expect(result.metadata).toHaveProperty('results_total', 2);
      expect(mockIndexer.search).toHaveBeenCalledWith('authentication', {
        limit: 10,
        scoreThreshold: 0,
      });
    });

    it('should return formatted results', async () => {
      const result = await adapter.execute(
        {
          query: 'authentication',
        },
        execContext
      );

      expect(result.success).toBe(true);
      expect(typeof result.data?.content).toBe('string');
      expect((result.data?.content as string).length).toBeGreaterThan(0);
      expect(result.data?.content as string).toContain('authenticate');
    });

    it('should respect limit parameter', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          limit: 3,
        },
        execContext
      );

      expect(result.success).toBe(true);
      expect(mockIndexer.search).toHaveBeenCalledWith('test', {
        limit: 3,
        scoreThreshold: 0,
      });
      expect(result.metadata?.results_total).toBe(2); // Mock returns 2 results
    });

    it('should respect score threshold parameter', async () => {
      const result = await adapter.execute(
        {
          query: 'test',
          scoreThreshold: 0.9,
        },
        execContext
      );

      expect(result.success).toBe(true);
      expect(mockIndexer.search).toHaveBeenCalledWith('test', {
        limit: 10,
        scoreThreshold: 0.9,
      });
    });

    it('compact format should use fewer tokens than verbose', async () => {
      const compactResult = await adapter.execute(
        {
          query: 'test',
          format: 'compact',
        },
        execContext
      );

      const verboseResult = await adapter.execute(
        {
          query: 'test',
          format: 'verbose',
        },
        execContext
      );

      expect(compactResult.success).toBe(true);
      expect(verboseResult.success).toBe(true);

      const compactTokens = compactResult.metadata?.tokens as number;
      const verboseTokens = verboseResult.metadata?.tokens as number;

      expect(verboseTokens).toBeGreaterThan(compactTokens);
    });

    it('should handle empty results', async () => {
      // Override mock to return no results
      vi.mocked(mockIndexer.search).mockResolvedValueOnce([]);

      const result = await adapter.execute(
        {
          query: 'nonexistent',
        },
        execContext
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.results_total).toBe(0);
      expect(result.data?.content as string).toContain('No results');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens for queries', () => {
      const estimate = adapter.estimateTokens({
        query: 'test',
        format: 'compact',
        limit: 10,
      });

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(500);
    });

    it('verbose should estimate more tokens', () => {
      const compactEstimate = adapter.estimateTokens({
        query: 'test',
        format: 'compact',
        limit: 10,
      });

      const verboseEstimate = adapter.estimateTokens({
        query: 'test',
        format: 'verbose',
        limit: 10,
      });

      expect(verboseEstimate).toBeGreaterThan(compactEstimate);
    });

    it('more results should estimate more tokens', () => {
      const fewResults = adapter.estimateTokens({
        query: 'test',
        format: 'compact',
        limit: 5,
      });

      const manyResults = adapter.estimateTokens({
        query: 'test',
        format: 'compact',
        limit: 20,
      });

      expect(manyResults).toBeGreaterThan(fewResults);
    });
  });

  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(adapter.metadata.name).toBe('search-adapter');
      expect(adapter.metadata.version).toBe('1.0.0');
      expect(adapter.metadata.description).toContain('search');
    });
  });
});
