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
  fetchGitHubIssue: vi.fn(),
  extractAcceptanceCriteria: vi.fn(),
  inferPriority: vi.fn(),
  cleanDescription: vi.fn(),
  breakdownIssue: vi.fn(),
  addEstimatesToTasks: vi.fn(),
  calculateTotalEstimate: vi.fn(),
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

    vi.mocked(utils.fetchGitHubIssue).mockResolvedValue({
      number: 29,
      title: 'Plan + Status Adapters',
      body: '## Description\nImplement plan and status adapters\n\n## Acceptance Criteria\n- [ ] PlanAdapter works\n- [ ] StatusAdapter works',
      labels: ['enhancement'],
    });

    vi.mocked(utils.extractAcceptanceCriteria).mockReturnValue([
      'PlanAdapter works',
      'StatusAdapter works',
    ]);

    vi.mocked(utils.inferPriority).mockReturnValue('medium');

    vi.mocked(utils.cleanDescription).mockReturnValue('Implement plan and status adapters');

    vi.mocked(utils.breakdownIssue).mockReturnValue([
      {
        id: 'task-1',
        description: 'Create PlanAdapter class',
        relevantCode: [],
      },
      {
        id: 'task-2',
        description: 'Create StatusAdapter class',
        relevantCode: [],
      },
      {
        id: 'task-3',
        description: 'Write unit tests',
        relevantCode: [],
      },
    ]);

    vi.mocked(utils.addEstimatesToTasks).mockImplementation((tasks) =>
      tasks.map((task) => ({
        ...task,
        estimatedHours: 4,
      }))
    );

    vi.mocked(utils.calculateTotalEstimate).mockReturnValue('2 days');

    // Mock indexer search
    vi.mocked(mockIndexer.search).mockResolvedValue([
      {
        id: 'doc-1',
        text: 'class SearchAdapter',
        metadata: { path: 'src/adapters/search-adapter.ts' },
        score: 0.85,
      },
    ]);
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(adapter.metadata.name).toBe('plan-adapter');
      expect(adapter.metadata.version).toBe('1.0.0');
      expect(adapter.metadata.description).toContain('planning');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await adapter.initialize(mockContext);
      expect(mockContext.logger.info).toHaveBeenCalledWith('PlanAdapter initialized', {
        repositoryPath: '/test/repo',
        defaultFormat: 'compact',
        timeout: 5000,
        hasCoordinator: false,
      });
    });
  });

  describe('getToolDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = adapter.getToolDefinition();

      expect(definition.name).toBe('dev_plan');
      expect(definition.description).toContain('plan');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('issue');
      expect(definition.inputSchema.properties).toHaveProperty('format');
      expect(definition.inputSchema.properties).toHaveProperty('useExplorer');
      expect(definition.inputSchema.properties).toHaveProperty('detailLevel');
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

    it('should have correct detailLevel enum values', () => {
      const definition = adapter.getToolDefinition();
      const detailLevelProperty = definition.inputSchema.properties?.detailLevel;

      expect(detailLevelProperty).toBeDefined();
      expect(detailLevelProperty?.enum).toEqual(['simple', 'detailed']);
    });
  });

  describe('execute', () => {
    describe('validation', () => {
      it('should reject invalid issue number (not a number)', async () => {
        const result = await adapter.execute({ issue: 'invalid' }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_ISSUE');
        expect(result.error?.message).toContain('positive number');
      });

      it('should reject invalid issue number (negative)', async () => {
        const result = await adapter.execute({ issue: -1 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_ISSUE');
      });

      it('should reject invalid issue number (zero)', async () => {
        const result = await adapter.execute({ issue: 0 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_ISSUE');
      });

      it('should reject invalid format', async () => {
        const result = await adapter.execute(
          { issue: 29, format: 'invalid' },
          mockExecutionContext
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_FORMAT');
        expect(result.error?.message).toContain('compact');
      });

      it('should reject invalid detail level', async () => {
        const result = await adapter.execute(
          { issue: 29, detailLevel: 'invalid' },
          mockExecutionContext
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DETAIL_LEVEL');
      });
    });

    describe('plan generation', () => {
      it('should generate compact plan by default', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.format).toBe('compact');
        expect(result.data?.content).toContain('Plan for #29');
        expect(result.data?.content).toContain('Plan + Status Adapters');
        expect(result.data?.content).toContain('Implementation Steps');
      });

      it('should generate verbose plan when requested', async () => {
        const result = await adapter.execute(
          { issue: 29, format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(result.data?.format).toBe('verbose');
        expect(result.data?.content).toContain('"issueNumber": 29');
        expect(result.data?.content).toContain('"title"');
        expect(result.data?.content).toContain('"tasks"');
      });

      it('should include plan object in verbose mode', async () => {
        const result = await adapter.execute(
          { issue: 29, format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(result.data?.plan).toBeDefined();
        expect(result.data?.plan?.issueNumber).toBe(29);
        expect(result.data?.plan?.tasks).toHaveLength(3);
      });

      it('should not include plan object in compact mode', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.plan).toBeUndefined();
      });

      it('should use Explorer by default', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(mockIndexer.search).toHaveBeenCalled();
      });

      it('should skip Explorer when disabled', async () => {
        const result = await adapter.execute(
          { issue: 29, useExplorer: false },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(mockIndexer.search).not.toHaveBeenCalled();
      });

      it('should handle Explorer search failures gracefully', async () => {
        vi.mocked(mockIndexer.search).mockRejectedValue(new Error('Search failed'));

        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true); // Should still succeed
        expect(mockExecutionContext.logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Explorer search failed'),
          expect.any(Object)
        );
      });

      it('should generate simple plan when requested', async () => {
        const result = await adapter.execute(
          { issue: 29, detailLevel: 'simple' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Plan for #29');

        const utils = await import('@lytics/dev-agent-subagents');
        expect(utils.breakdownIssue).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Array),
          expect.objectContaining({
            detailLevel: 'simple',
            maxTasks: 8,
          })
        );
      });

      it('should generate detailed plan by default', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);

        const utils = await import('@lytics/dev-agent-subagents');
        expect(utils.breakdownIssue).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Array),
          expect.objectContaining({
            detailLevel: 'detailed',
            maxTasks: 15,
          })
        );
      });
    });

    describe('compact formatting', () => {
      it('should format tasks as numbered list', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('1. Create PlanAdapter class');
        expect(result.data?.content).toContain('2. Create StatusAdapter class');
        expect(result.data?.content).toContain('3. Write unit tests');
      });

      it('should include estimates in compact format', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('(4h)');
      });

      it('should include total estimate', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('**Estimate:** 2 days');
      });

      it('should include priority', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('**Priority:** medium');
      });

      it('should include next step', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Next Step');
        expect(result.data?.content).toContain('Start with: **Create PlanAdapter class**');
      });

      it('should include relevant code paths in compact format', async () => {
        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(true);
        // Should show file paths for relevant code
        expect(result.data?.content).toMatch(/See.*search-adapter\.ts/);
      });
    });

    describe('error handling', () => {
      it('should handle issue not found', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.fetchGitHubIssue).mockRejectedValue(new Error('Issue #999 not found'));

        const result = await adapter.execute({ issue: 999 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ISSUE_NOT_FOUND');
        expect(result.error?.message).toContain('not found');
        expect(result.error?.suggestion).toContain('dev gh index');
      });

      it('should handle GitHub CLI errors', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.fetchGitHubIssue).mockRejectedValue(
          new Error('GitHub CLI (gh) is not installed')
        );

        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GITHUB_ERROR');
        expect(result.error?.suggestion).toContain('gh');
      });

      it('should handle timeout', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.fetchGitHubIssue).mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 10000))
        );

        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('PLANNER_TIMEOUT');
        expect(result.error?.message).toContain('timeout');
        expect(result.error?.suggestion).toBeDefined();
      }, 10000); // 10 second timeout for this test

      it('should handle unknown errors', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.fetchGitHubIssue).mockRejectedValue(new Error('Unknown error'));

        const result = await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('PLANNING_FAILED');
        expect(result.error?.message).toBe('Unknown error');
      });

      it('should log errors', async () => {
        const utils = await import('@lytics/dev-agent-subagents');
        vi.mocked(utils.fetchGitHubIssue).mockRejectedValue(new Error('Test error'));

        await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(mockExecutionContext.logger.error).toHaveBeenCalledWith(
          'Plan generation failed',
          expect.any(Object)
        );
      });
    });

    describe('logging', () => {
      it('should log debug information', async () => {
        await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(mockExecutionContext.logger.debug).toHaveBeenCalledWith(
          'Generating plan',
          expect.objectContaining({ issue: 29 })
        );
      });

      it('should log completion', async () => {
        await adapter.execute({ issue: 29 }, mockExecutionContext);

        expect(mockExecutionContext.logger.info).toHaveBeenCalledWith(
          'Plan generated',
          expect.objectContaining({
            issue: 29,
            taskCount: 3,
            totalEstimate: '2 days',
          })
        );
      });
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for compact simple plan', () => {
      const estimate = adapter.estimateTokens({ format: 'compact', detailLevel: 'simple' });
      expect(estimate).toBe(300);
    });

    it('should estimate tokens for compact detailed plan', () => {
      const estimate = adapter.estimateTokens({ format: 'compact', detailLevel: 'detailed' });
      expect(estimate).toBe(600);
    });

    it('should estimate tokens for verbose simple plan', () => {
      const estimate = adapter.estimateTokens({ format: 'verbose', detailLevel: 'simple' });
      expect(estimate).toBe(800);
    });

    it('should estimate tokens for verbose detailed plan', () => {
      const estimate = adapter.estimateTokens({ format: 'verbose', detailLevel: 'detailed' });
      expect(estimate).toBe(1500);
    });

    it('should use defaults when no args provided', () => {
      const estimate = adapter.estimateTokens({});
      expect(estimate).toBe(600); // Default is compact + detailed
    });
  });
});
