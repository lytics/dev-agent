/**
 * Tests for RefsAdapter
 */

import type { RepositoryIndexer, SearchResult } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger } from '../../utils/logger';
import { RefsAdapter } from '../built-in/refs-adapter';
import type { AdapterContext, ToolExecutionContext } from '../types';

describe('RefsAdapter', () => {
  let mockIndexer: RepositoryIndexer;
  let adapter: RefsAdapter;
  let context: AdapterContext;
  let execContext: ToolExecutionContext;

  // Mock search results with callees
  const mockSearchResults: SearchResult[] = [
    {
      id: 'src/planner.ts:createPlan:10',
      score: 0.95,
      metadata: {
        path: 'src/planner.ts',
        type: 'function',
        name: 'createPlan',
        startLine: 10,
        endLine: 50,
        language: 'typescript',
        exported: true,
        signature: 'export function createPlan(issue: Issue): Plan',
        callees: [
          { name: 'fetchIssue', line: 15, file: 'src/github.ts' },
          { name: 'analyzeCode', line: 20 },
          { name: 'generateTasks', line: 30, file: 'src/tasks.ts' },
        ],
      },
    },
    {
      id: 'src/executor.ts:runPlan:5',
      score: 0.85,
      metadata: {
        path: 'src/executor.ts',
        type: 'function',
        name: 'runPlan',
        startLine: 5,
        endLine: 40,
        language: 'typescript',
        exported: true,
        callees: [
          { name: 'createPlan', line: 10, file: 'src/planner.ts' },
          { name: 'execute', line: 20 },
        ],
      },
    },
    {
      id: 'src/cli.ts:main:1',
      score: 0.8,
      metadata: {
        path: 'src/cli.ts',
        type: 'function',
        name: 'main',
        startLine: 1,
        endLine: 30,
        language: 'typescript',
        exported: true,
        callees: [{ name: 'createPlan', line: 15, file: 'src/planner.ts' }],
      },
    },
  ];

  beforeEach(async () => {
    // Create mock indexer
    mockIndexer = {
      search: vi.fn().mockResolvedValue(mockSearchResults),
    } as unknown as RepositoryIndexer;

    // Create adapter
    adapter = new RefsAdapter({
      repositoryIndexer: mockIndexer,
      defaultLimit: 20,
    });

    // Create context
    const logger = new ConsoleLogger('[test]', 'error'); // Quiet for tests
    context = {
      logger,
      config: { repositoryPath: '/test' },
    };

    execContext = {
      logger,
      config: { repositoryPath: '/test' },
    };

    await adapter.initialize(context);
  });

  describe('Tool Definition', () => {
    it('should provide valid tool definition', () => {
      const def = adapter.getToolDefinition();

      expect(def.name).toBe('dev_refs');
      expect(def.description).toContain('call relationships');
      expect(def.inputSchema.type).toBe('object');
      expect(def.inputSchema.properties).toHaveProperty('name');
      expect(def.inputSchema.properties).toHaveProperty('direction');
      expect(def.inputSchema.properties).toHaveProperty('limit');
      expect(def.inputSchema.required).toContain('name');
    });

    it('should have correct direction enum', () => {
      const def = adapter.getToolDefinition();
      const directionProp = def.inputSchema.properties?.direction;

      expect(directionProp).toBeDefined();
      expect(directionProp).toHaveProperty('enum');
      expect((directionProp as { enum: string[] }).enum).toEqual(['callees', 'callers', 'both']);
    });
  });

  describe('Validation', () => {
    it('should reject empty name', async () => {
      const result = await adapter.execute({ name: '' }, execContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_NAME');
    });

    it('should reject invalid direction', async () => {
      const result = await adapter.execute(
        { name: 'createPlan', direction: 'invalid' },
        execContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DIRECTION');
    });

    it('should reject invalid limit', async () => {
      const result = await adapter.execute({ name: 'createPlan', limit: 100 }, execContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_LIMIT');
    });
  });

  describe('Callee Queries', () => {
    it('should return callees for a function', async () => {
      const result = await adapter.execute(
        { name: 'createPlan', direction: 'callees' },
        execContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.callees).toBeDefined();
      expect(result.data?.callees.length).toBe(3);
      expect(result.data?.callees[0].name).toBe('fetchIssue');
    });

    it('should include callee file paths when available', async () => {
      const result = await adapter.execute(
        { name: 'createPlan', direction: 'callees' },
        execContext
      );

      expect(result.success).toBe(true);
      const callees = result.data?.callees;
      expect(callees?.find((c: { name: string }) => c.name === 'fetchIssue')?.file).toBe(
        'src/github.ts'
      );
      expect(
        callees?.find((c: { name: string }) => c.name === 'analyzeCode')?.file
      ).toBeUndefined();
    });

    it('should not include callers when direction is callees', async () => {
      const result = await adapter.execute(
        { name: 'createPlan', direction: 'callees' },
        execContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.callers).toBeUndefined();
    });
  });

  describe('Caller Queries', () => {
    it('should return callers for a function', async () => {
      const result = await adapter.execute(
        { name: 'createPlan', direction: 'callers' },
        execContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.callers).toBeDefined();
      // runPlan and main both call createPlan
      expect(result.data?.callers.length).toBe(2);
    });

    it('should not include callees when direction is callers', async () => {
      const result = await adapter.execute(
        { name: 'createPlan', direction: 'callers' },
        execContext
      );

      expect(result.success).toBe(true);
      expect(result.data?.callees).toBeUndefined();
    });
  });

  describe('Bidirectional Queries', () => {
    it('should return both callees and callers when direction is both', async () => {
      const result = await adapter.execute({ name: 'createPlan', direction: 'both' }, execContext);

      expect(result.success).toBe(true);
      expect(result.data?.callees).toBeDefined();
      expect(result.data?.callers).toBeDefined();
    });

    it('should use both as default direction', async () => {
      const result = await adapter.execute({ name: 'createPlan' }, execContext);

      expect(result.success).toBe(true);
      expect(result.data?.callees).toBeDefined();
      expect(result.data?.callers).toBeDefined();
    });
  });

  describe('Output Formatting', () => {
    it('should include target information', async () => {
      const result = await adapter.execute({ name: 'createPlan' }, execContext);

      expect(result.success).toBe(true);
      expect(result.data?.target).toBeDefined();
      expect(result.data?.target.name).toBe('createPlan');
      expect(result.data?.target.file).toBe('src/planner.ts');
      expect(result.data?.target.type).toBe('function');
    });

    it('should format output as markdown', async () => {
      const result = await adapter.execute({ name: 'createPlan' }, execContext);

      expect(result.success).toBe(true);
      expect(result.data?.content).toContain('# References for createPlan');
      expect(result.data?.content).toContain('## Callees');
      expect(result.data?.content).toContain('## Callers');
    });

    it('should include token count in metadata', async () => {
      const result = await adapter.execute({ name: 'createPlan' }, execContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.tokens).toBeDefined();
      expect(typeof result.metadata?.tokens).toBe('number');
    });

    it('should include duration in metadata', async () => {
      const result = await adapter.execute({ name: 'createPlan' }, execContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.duration_ms).toBeDefined();
      expect(typeof result.metadata?.duration_ms).toBe('number');
    });
  });

  describe('Not Found', () => {
    it('should return error when function not found', async () => {
      // Mock empty results
      (mockIndexer.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const result = await adapter.execute({ name: 'nonExistentFunction' }, execContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens based on limit and direction', () => {
      const bothTokens = adapter.estimateTokens({ limit: 10, direction: 'both' });
      const singleTokens = adapter.estimateTokens({ limit: 10, direction: 'callees' });

      // Both directions should estimate more tokens
      expect(bothTokens).toBeGreaterThan(singleTokens);
    });
  });
});
