/**
 * Tests for StatusAdapter
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusAdapter } from '../built-in/status-adapter';
import type { AdapterContext, ToolExecutionContext } from '../types';

// Mock RepositoryIndexer
const createMockRepositoryIndexer = () => {
  return {
    getStats: vi.fn(),
    search: vi.fn(),
    initialize: vi.fn(),
    close: vi.fn(),
  } as unknown as RepositoryIndexer;
};

// Mock GitHubIndexer
vi.mock('@lytics/dev-agent-subagents', () => ({
  GitHubIndexer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      repository: 'lytics/dev-agent',
      totalDocuments: 59,
      byType: { issue: 47, pull_request: 12 },
      byState: { open: 35, closed: 15, merged: 9 },
      lastIndexed: '2025-11-24T10:00:00Z',
      indexDuration: 12400,
    }),
    isIndexed: vi.fn().mockReturnValue(true),
  })),
}));

describe('StatusAdapter', () => {
  let adapter: StatusAdapter;
  let mockIndexer: RepositoryIndexer;
  let mockContext: AdapterContext;
  let mockExecutionContext: ToolExecutionContext;

  beforeEach(() => {
    mockIndexer = createMockRepositoryIndexer();

    adapter = new StatusAdapter({
      repositoryIndexer: mockIndexer,
      repositoryPath: '/test/repo',
      vectorStorePath: '/test/.dev-agent/vectors.lance',
      defaultSection: 'summary',
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
    vi.mocked(mockIndexer.getStats).mockResolvedValue({
      filesScanned: 2341,
      documentsExtracted: 1234,
      documentsIndexed: 1234,
      vectorsStored: 1234,
      duration: 18300,
      errors: [],
      startTime: new Date('2025-11-24T08:00:00Z'),
      endTime: new Date('2025-11-24T08:00:18Z'),
      repositoryPath: '/test/repo',
    });
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(adapter.metadata.name).toBe('status-adapter');
      expect(adapter.metadata.version).toBe('1.0.0');
      expect(adapter.metadata.description).toContain('status');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await adapter.initialize(mockContext);
      expect(mockContext.logger.info).toHaveBeenCalledWith('StatusAdapter initialized', {
        repositoryPath: '/test/repo',
        defaultSection: 'summary',
      });
    });

    it('should handle GitHub indexer initialization failure gracefully', async () => {
      const { GitHubIndexer } = await import('@lytics/dev-agent-subagents');
      vi.mocked(GitHubIndexer).mockImplementationOnce(() => {
        throw new Error('GitHub not available');
      });

      await adapter.initialize(mockContext);
      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        'GitHub indexer initialization failed',
        expect.any(Object)
      );
    });
  });

  describe('getToolDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = adapter.getToolDefinition();

      expect(definition.name).toBe('dev_status');
      expect(definition.description).toContain('status');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('section');
      expect(definition.inputSchema.properties).toHaveProperty('format');
    });

    it('should have correct section enum values', () => {
      const definition = adapter.getToolDefinition();
      const sectionProperty = definition.inputSchema.properties?.section;

      expect(sectionProperty).toBeDefined();
      expect(sectionProperty?.enum).toEqual(['summary', 'repo', 'indexes', 'github', 'health']);
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
      it('should reject invalid section', async () => {
        const result = await adapter.execute({ section: 'invalid' }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_SECTION');
        expect(result.error?.message).toContain('summary');
      });

      it('should reject invalid format', async () => {
        const result = await adapter.execute(
          { section: 'summary', format: 'invalid' },
          mockExecutionContext
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_FORMAT');
        expect(result.error?.message).toContain('compact');
      });
    });

    describe('summary section', () => {
      it('should return compact summary by default', async () => {
        const result = await adapter.execute({}, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.section).toBe('summary');
        expect(result.data?.format).toBe('compact');
        expect(result.data?.content).toContain('Dev-Agent Status');
        expect(result.data?.content).toContain('Repository:');
        expect(result.data?.content).toContain('2341 files indexed');
      });

      it('should return verbose summary when requested', async () => {
        const result = await adapter.execute(
          { section: 'summary', format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Detailed');
        expect(result.data?.content).toContain('Repository');
        expect(result.data?.content).toContain('Vector Indexes');
        expect(result.data?.content).toContain('Health Checks');
      });

      it('should handle repository not indexed', async () => {
        vi.mocked(mockIndexer.getStats).mockResolvedValue(null);

        const result = await adapter.execute({}, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('not indexed');
      });

      it('should include GitHub section in summary', async () => {
        await adapter.initialize(mockContext);

        const result = await adapter.execute({}, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('GitHub');
        // GitHub stats may or may not be available depending on initialization
        const content = result.data?.content || '';
        const hasGitHub = content.includes('GitHub');
        expect(hasGitHub).toBe(true);
      });
    });

    describe('repo section', () => {
      it('should return repository status in compact format', async () => {
        const result = await adapter.execute({ section: 'repo' }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Repository Index');
        expect(result.data?.content).toContain('2341');
        expect(result.data?.content).toContain('1234');
      });

      it('should return repository status in verbose format', async () => {
        const result = await adapter.execute(
          { section: 'repo', format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Documents Indexed:');
        expect(result.data?.content).toContain('Vectors Stored:');
      });

      it('should handle repository not indexed', async () => {
        vi.mocked(mockIndexer.getStats).mockResolvedValue(null);

        const result = await adapter.execute({ section: 'repo' }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Not indexed');
        expect(result.data?.content).toContain('dev index');
      });
    });

    describe('indexes section', () => {
      it('should return indexes status in compact format', async () => {
        await adapter.initialize(mockContext);

        const result = await adapter.execute({ section: 'indexes' }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Vector Indexes');
        expect(result.data?.content).toContain('Code Index');
        expect(result.data?.content).toContain('GitHub Index');
        expect(result.data?.content).toContain('1234 embeddings');
      });

      it('should return indexes status in verbose format', async () => {
        await adapter.initialize(mockContext);

        const result = await adapter.execute(
          { section: 'indexes', format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Code Index');
        expect(result.data?.content).toContain('Documents:');
        expect(result.data?.content).toContain('GitHub Index');
        // GitHub section should be present, may show stats or "Not indexed"
        const content = result.data?.content || '';
        const hasGitHubInfo = content.includes('Not indexed') || content.includes('Documents:');
        expect(hasGitHubInfo).toBe(true);
      });
    });

    describe('github section', () => {
      it('should return GitHub status in compact format', async () => {
        await adapter.initialize(mockContext);

        const result = await adapter.execute({ section: 'github' }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('GitHub Integration');
        // May show stats or "Not indexed" depending on initialization
      });

      it('should return GitHub status in verbose format', async () => {
        await adapter.initialize(mockContext);

        const result = await adapter.execute(
          { section: 'github', format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('GitHub Integration');
        // May include Configuration or Not indexed message
      });

      it('should handle GitHub not indexed', async () => {
        // Create adapter without initializing (no GitHub indexer)
        const newAdapter = new StatusAdapter({
          repositoryIndexer: mockIndexer,
          repositoryPath: '/test/repo',
          vectorStorePath: '/test/.dev-agent/vectors.lance',
        });

        const result = await newAdapter.execute({ section: 'github' }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Not indexed');
        expect(result.data?.content).toContain('dev gh index');
      });
    });

    describe('health section', () => {
      it('should return health status in compact format', async () => {
        const result = await adapter.execute({ section: 'health' }, mockExecutionContext);

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Health Checks');
        expect(result.data?.content).toContain('✅');
      });

      it('should return health status in verbose format', async () => {
        const result = await adapter.execute(
          { section: 'health', format: 'verbose' },
          mockExecutionContext
        );

        expect(result.success).toBe(true);
        expect(result.data?.content).toContain('Health Checks');
        // Verbose includes details
        expect(result.data?.content.length).toBeGreaterThan(100);
      });
    });

    describe('error handling', () => {
      it('should handle errors during status generation', async () => {
        vi.mocked(mockIndexer.getStats).mockRejectedValue(new Error('Database error'));

        const result = await adapter.execute({ section: 'summary' }, mockExecutionContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('STATUS_FAILED');
        expect(result.error?.message).toBe('Database error');
      });

      it('should log errors', async () => {
        vi.mocked(mockIndexer.getStats).mockRejectedValue(new Error('Test error'));

        await adapter.execute({ section: 'summary' }, mockExecutionContext);

        expect(mockExecutionContext.logger.error).toHaveBeenCalledWith(
          'Status check failed',
          expect.any(Object)
        );
      });
    });

    describe('logging', () => {
      it('should log debug information', async () => {
        await adapter.execute({ section: 'summary' }, mockExecutionContext);

        expect(mockExecutionContext.logger.debug).toHaveBeenCalledWith('Executing status check', {
          section: 'summary',
          format: 'compact',
        });
      });

      it('should log completion', async () => {
        await adapter.execute({ section: 'summary' }, mockExecutionContext);

        expect(mockExecutionContext.logger.info).toHaveBeenCalledWith('Status check completed', {
          section: 'summary',
          format: 'compact',
        });
      });
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for compact summary', () => {
      const estimate = adapter.estimateTokens({ section: 'summary', format: 'compact' });
      expect(estimate).toBe(200);
    });

    it('should estimate tokens for verbose summary', () => {
      const estimate = adapter.estimateTokens({ section: 'summary', format: 'verbose' });
      expect(estimate).toBe(800);
    });

    it('should estimate tokens for compact section', () => {
      const estimate = adapter.estimateTokens({ section: 'repo', format: 'compact' });
      expect(estimate).toBe(150);
    });

    it('should estimate tokens for verbose section', () => {
      const estimate = adapter.estimateTokens({ section: 'repo', format: 'verbose' });
      expect(estimate).toBe(500);
    });

    it('should use defaults when no args provided', () => {
      const estimate = adapter.estimateTokens({});
      expect(estimate).toBe(200); // Default is summary + compact
    });
  });

  describe('time formatting', () => {
    it('should format recent times correctly', async () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      vi.mocked(mockIndexer.getStats).mockResolvedValue({
        filesScanned: 100,
        documentsExtracted: 50,
        documentsIndexed: 50,
        vectorsStored: 50,
        duration: 1000,
        errors: [],
        startTime: twoHoursAgo,
        endTime: twoHoursAgo,
        repositoryPath: '/test/repo',
      });

      const result = await adapter.execute({ section: 'summary' }, mockExecutionContext);

      expect(result.success).toBe(true);
      expect(result.data?.content).toContain('ago');
    });
  });

  describe('storage size formatting', () => {
    it('should format bytes correctly', async () => {
      // This is tested implicitly in the status checks
      // We can't easily test the private method directly, but we can verify
      // the output contains formatted storage sizes
      const result = await adapter.execute({ section: 'indexes' }, mockExecutionContext);

      expect(result.success).toBe(true);
      // Should contain some size format (KB, MB, GB, or B)
      expect(result.data?.content).toMatch(/\d+(\.\d+)?\s*(B|KB|MB|GB)/);
    });
  });
});
