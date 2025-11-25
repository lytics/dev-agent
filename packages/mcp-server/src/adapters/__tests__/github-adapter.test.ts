/**
 * GitHubAdapter Unit Tests
 */

import type { GitHubDocument, GitHubSearchResult } from '@lytics/dev-agent-subagents';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubAdapter } from '../built-in/github-adapter';
import type { ToolExecutionContext } from '../types';

describe('GitHubAdapter', () => {
  let adapter: GitHubAdapter;
  let mockGitHubIndexer: GitHubIndexer;
  let mockContext: ToolExecutionContext;

  const mockIssue: GitHubDocument = {
    type: 'issue',
    number: 1,
    title: 'Test Issue',
    body: 'This is a test issue',
    state: 'open',
    labels: ['bug', 'enhancement'],
    author: 'testuser',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    url: 'https://github.com/test/repo/issues/1',
    repository: 'test/repo',
    comments: 5,
    reactions: {},
    relatedIssues: [2, 3],
    relatedPRs: [10],
    linkedFiles: ['src/test.ts'],
    mentions: ['developer1'],
  };

  beforeEach(() => {
    // Mock GitHubIndexer
    mockGitHubIndexer = {
      search: vi.fn(),
    } as unknown as GitHubIndexer;

    // Create adapter
    adapter = new GitHubAdapter({
      repositoryPath: '/test/repo',
      githubIndexer: mockGitHubIndexer,
      defaultLimit: 10,
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

      expect(definition.name).toBe('dev_gh');
      expect(definition.description).toContain('Search GitHub');
      expect(definition.inputSchema.required).toEqual(['action']);
      expect(definition.inputSchema.properties.action.enum).toEqual([
        'search',
        'context',
        'related',
      ]);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid action', async () => {
      const result = await adapter.execute(
        {
          action: 'invalid',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ACTION');
    });

    it('should reject search without query', async () => {
      const result = await adapter.execute(
        {
          action: 'search',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_QUERY');
    });

    it('should reject context without number', async () => {
      const result = await adapter.execute(
        {
          action: 'context',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_NUMBER');
    });

    it('should reject related without number', async () => {
      const result = await adapter.execute(
        {
          action: 'related',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_NUMBER');
    });

    it('should reject invalid limit', async () => {
      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
          limit: 0,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_LIMIT');
    });

    it('should reject invalid format', async () => {
      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
          format: 'invalid',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_FORMAT');
    });
  });

  describe('Search Action', () => {
    it('should search GitHub issues in compact format', async () => {
      const mockResults: GitHubSearchResult[] = [
        {
          document: mockIssue,
          score: 0.9,
          matchedFields: ['title', 'body'],
        },
      ];

      vi.mocked(mockGitHubIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('GitHub Search Results');
      expect((result.data as { content: string })?.content).toContain('#1');
      expect((result.data as { content: string })?.content).toContain('Test Issue');
    });

    it('should search with filters', async () => {
      const mockResults: GitHubSearchResult[] = [
        {
          document: mockIssue,
          score: 0.9,
          matchedFields: ['title'],
        },
      ];

      vi.mocked(mockGitHubIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
          type: 'issue',
          state: 'open',
          labels: ['bug'],
          author: 'testuser',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockGitHubIndexer.search).toHaveBeenCalledWith('test', {
        type: 'issue',
        state: 'open',
        labels: ['bug'],
        author: 'testuser',
        limit: 10,
      });
    });

    it('should handle no results', async () => {
      vi.mocked(mockGitHubIndexer.search).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'nonexistent',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain(
        'No matching issues or PRs found'
      );
    });

    it('should include token footer in search results', async () => {
      const mockResults: GitHubSearchResult[] = [
        {
          document: mockIssue,
          score: 0.9,
          matchedFields: ['title'],
        },
      ];

      vi.mocked(mockGitHubIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      const content = (result.data as { content: string })?.content;
      expect(content).toContain('🪙');
      expect(content).toMatch(/~\d+ tokens$/);
    });
  });

  describe('Context Action', () => {
    it('should get issue context in compact format', async () => {
      const mockResults: GitHubSearchResult[] = [
        {
          document: mockIssue,
          score: 1.0,
          matchedFields: ['number'],
        },
      ];

      vi.mocked(mockGitHubIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'context',
          number: 1,
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('Issue #1');
      expect((result.data as { content: string })?.content).toContain('Test Issue');
      expect((result.data as { content: string })?.content).toContain('testuser');
    });

    it('should get issue context in verbose format', async () => {
      const mockResults: GitHubSearchResult[] = [
        {
          document: mockIssue,
          score: 1.0,
          matchedFields: ['number'],
        },
      ];

      vi.mocked(mockGitHubIndexer.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'context',
          number: 1,
          format: 'verbose',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('**Related Issues:** #2, #3');
      expect((result.data as { content: string })?.content).toContain('**Related PRs:** #10');
      expect((result.data as { content: string })?.content).toContain(
        '**Linked Files:** `src/test.ts`'
      );
      expect((result.data as { content: string })?.content).toContain('**Mentions:** @developer1');
    });

    it('should handle issue not found', async () => {
      vi.mocked(mockGitHubIndexer.search).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          action: 'context',
          number: 999,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('Related Action', () => {
    it('should find related issues in compact format', async () => {
      const mockRelated: GitHubDocument = {
        ...mockIssue,
        number: 2,
        title: 'Related Issue',
      };

      vi.mocked(mockGitHubIndexer.search)
        .mockResolvedValueOnce([
          {
            document: mockIssue,
            score: 1.0,
            matchedFields: ['number'],
          },
        ])
        .mockResolvedValueOnce([
          {
            document: mockIssue,
            score: 1.0,
            matchedFields: ['title'],
          },
          {
            document: mockRelated,
            score: 0.85,
            matchedFields: ['title'],
          },
        ]);

      const result = await adapter.execute(
        {
          action: 'related',
          number: 1,
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain('Related Issues/PRs');
      expect((result.data as { content: string })?.content).toContain('#2');
      expect((result.data as { content: string })?.content).toContain('Related Issue');
    });

    it('should handle no related items', async () => {
      vi.mocked(mockGitHubIndexer.search)
        .mockResolvedValueOnce([
          {
            document: mockIssue,
            score: 1.0,
            matchedFields: ['number'],
          },
        ])
        .mockResolvedValueOnce([
          {
            document: mockIssue,
            score: 1.0,
            matchedFields: ['title'],
          },
        ]);

      const result = await adapter.execute(
        {
          action: 'related',
          number: 1,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as { content: string })?.content).toContain(
        'No related issues or PRs found'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle index not ready error', async () => {
      vi.mocked(mockGitHubIndexer.search).mockRejectedValue(new Error('GitHub index not indexed'));

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INDEX_NOT_READY');
    });

    it('should handle generic errors', async () => {
      vi.mocked(mockGitHubIndexer.search).mockRejectedValue(new Error('Unknown error'));

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GITHUB_ERROR');
    });
  });
});
