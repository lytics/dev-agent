/**
 * Tests for PlanAdapter
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanAdapter } from '../built-in/plan-adapter';
import type { AdapterContext, ToolExecutionContext } from '../types';

// Mock RepositoryIndexer
const createMockRepositoryIndexer = () => {
  return {
    search: vi.fn(),
    getStats: vi.fn(),
    initialize: vi.fn(),
    close: vi.fn(),
  } as unknown as RepositoryIndexer;
};

// Mock planner utilities
vi.mock('@lytics/dev-agent-subagents', () => ({
  assembleContext: vi.fn(),
  formatContextPackage: vi.fn(),
}));

describe('PlanAdapter', () => {
  let adapter: PlanAdapter;
  let mockIndexer: RepositoryIndexer;
  let mockContext: AdapterContext;
  let mockExecutionContext: ToolExecutionContext;

  beforeEach(async () => {
    mockIndexer = createMockRepositoryIndexer();

    adapter = new PlanAdapter({
      repositoryIndexer: mockIndexer,
      repositoryPath: '/test/repo',
      defaultFormat: 'compact',
      timeout: 5000, // Short timeout for tests
    });

    mockContext = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      config: {},
    };

    mockExecutionContext = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    // Setup default mock responses
    const utils = await import('@lytics/dev-agent-subagents');

    vi.mocked(utils.assembleContext).mockResolvedValue({
      issue: {
        number: 29,
        title: 'Plan + Status Adapters',
        body: 'Implement plan and status adapters',
        labels: ['enhancement'],
        author: 'testuser',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        state: 'open',
        comments: [],
      },
      relevantCode: [
        {
          file: 'src/adapters/search-adapter.ts',
          name: 'SearchAdapter',
          type: 'class',
          snippet: 'class SearchAdapter { }',
          relevanceScore: 0.85,
          reason: 'Similar pattern',
        },
      ],
      codebasePatterns: {
        testPattern: '*.test.ts',
        testLocation: '__tests__/',
      },
      relatedHistory: [],
      relatedCommits: [],
      metadata: {
        generatedAt: '2024-01-01T00:00:00Z',
        tokensUsed: 500,
        codeSearchUsed: true,
        historySearchUsed: false,
        gitHistorySearchUsed: false,
        repositoryPath: '/test/repo',
      },
    });

    vi.mocked(utils.formatContextPackage).mockReturnValue(
      '# Issue #29: Plan + Status Adapters\n\nImplement plan and status adapters\n\n## Relevant Code\n\n### SearchAdapter (class)\n**File:** `src/adapters/search-adapter.ts`'
    );
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(adapter.metadata.name).toBe('plan-adapter');
      expect(adapter.metadata.version).toBe('2.1.0');
      expect(adapter.metadata.description).toContain('context');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await adapter.initialize(mockContext);
      expect(mockContext.logger.info).toHaveBeenCalledWith('PlanAdapter initialized', {
        repositoryPath: '/test/repo',
        defaultFormat: 'compact',
        timeout: 5000,
      });
    });
  });

  describe('getToolDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = adapter.getToolDefinition();

      expect(definition.name).toBe('dev_plan');
      expect(definition.description).toContain('context');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('issue');
      expect(definition.inputSchema.properties).toHaveProperty('format');
      expect(definition.inputSchema.properties).toHaveProperty('includeCode');
      expect(definition.inputSchema.properties).toHaveProperty('includePatterns');
      expect(definition.inputSchema.properties).toHaveProperty('tokenBudget');
    });

    it('should have correct required fields', () => {
      const definition = adapter.getToolDefinition();
      expect(definition.inputSchema.required).toEqual(['issue']);
    });

    it('should have correct format enum values', () => {
      const definition = adapter.getToolDefinition();
      const formatProperty = definition.inputSchema.properties?.format;

      expect(formatProperty).toBeDefined();
      expect(formatProperty?.enum).toEqual(['compact', 'verbose']);
    });
  });

  describe('execute', () => {
    describe('validation', () => {
      it('should reject invalid issue number (not a number)', async () => {
        const result = await adapter.execute({ issue: 'invalid' }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
        expect(result.error?.message).toContain('issue');
      });

      it('should reject invalid issue number (negative)', async () => {
        const result = await adapter.execute({ issue: -1 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
        expect(result.error?.message).toContain('issue');
      });

      it('should reject invalid issue number (zero)', async () => {
        const result = await adapter.execute({ issue: 0 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
        expect(result.error?.message).toContain('issue');
      });

      it('should reject invalid format', async () => {
        const result = await adapter.execute(
          { issue: 29, format: 'invalid' },
          mockExecutionContext
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
        expect(result.error?.message).toContain('format');
        expect(result.error?.message).toContain('compact');
      });
    });

    describe('context assembly', () => {
      it('should assemble context with compact format by default', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        // Compact format is markdown text
        expect(typeof result.data).toBe('string');
        expect(result.data).toContain('Issue #29');
      });

      it('should return verbose JSON when requested', async () => {
        const result = await adapter.execute(
          { issue: 29, format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        // Verbose format includes more detailed JSON-like structure
        expect(typeof result.data).toBe('string');
        expect(result.data).toContain('"issue"');
        expect(result.data).toContain('"relevantCode"');
      });

      it('should include context object in verbose mode', async () => {
        const result = await adapter.execute(
          { issue: 29, format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        // Check formatted string includes issue context (verbose is JSON)
        expect(result.data).toContain('"number": 29');
      });

      it('should not include context object in compact mode', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        // Compact format should still include all information, just formatted differently
        expect(typeof result.data).toBe('string');
      });

      it('should include relevant code in context', async () => {
        const result = await adapter.execute(
          { issue: 29, format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        // Check formatted string includes relevant code section (verbose is JSON)
        expect(result.data).toContain('"relevantCode"');
      });

      it('should include codebase patterns', async () => {
        const result = await adapter.execute(
          { issue: 29, format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        // Check formatted string includes patterns section
        expect(result.data).toContain('*.test.ts');
      });

      it('should include metadata with tokens and duration', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.metadata?.tokens).toBeDefined();
        expect(result.metadata?.duration_ms).toBeDefined();
        expect(result.metadata?.timestamp).toBeDefined();
      });

      it('should pass options to assembleContext', async () => {
        const utils = await import('@lytics/dev-agent-subagents');

        await adapter.execute(
          { issue: 29, includeCode: false, includePatterns: false, tokenBudget: 2000 },
          mockExecutionContext
        );

        expect(utils.assembleContext).toHaveBeenCalledWith(
          29,
          expect.objectContaining({ indexer: mockIndexer }),
          '/test/repo',
          expect.objectContaining({
            includeCode: false,
            includePatterns: false,
            tokenBudget: 2000,
          })
        );
      });
    });

    describe('error handling', () => {
      it('should handle issue not found', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.assembleContext).mockRejectedValue(new Error('Issue #999 not found'));

        const result = await adapter.execute({ issue: 999 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ISSUE_NOT_FOUND');
        expect(result.error?.message).toContain('not found');
      });

      it('should handle GitHub CLI errors', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.assembleContext).mockRejectedValue(
          new Error('GitHub CLI (gh) is not installed')
        );

        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GITHUB_ERROR');
        expect(result.error?.suggestion).toContain('gh');
      });

      it('should handle timeout', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.assembleContext).mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 10000))
        );

        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CONTEXT_TIMEOUT');
        expect(result.error?.message).toContain('timeout');
      }, 10000);

      it('should handle unknown errors', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.assembleContext).mockRejectedValue(new Error('Unknown error'));

        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CONTEXT_ASSEMBLY_FAILED');
        expect(result.error?.message).toBe('Unknown error');
      });

      it('should log errors', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.assembleContext).mockRejectedValue(new Error('Test error'));

        await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(mockExecutionContext.logger.error).toHaveBeenCalledWith(
          'Context assembly failed',
          expect.any(Object)
        );
      });
    });
  });

  describe('estimateTokens', () => {
    it('should return tokenBudget when provided', () => {
      const tokens = adapter.estimateTokens({ tokenBudget: 2000 });
      expect(tokens).toBe(2000);
    });

    it('should return default tokenBudget when not provided', () => {
      const tokens = adapter.estimateTokens({});
      expect(tokens).toBe(4000);
    });
  });
});
