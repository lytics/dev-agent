/**
 * GitHubAdapter Unit Tests
 */

import type { GitHubService } from '@lytics/dev-agent-core';
import type { GitHubDocument, GitHubSearchResult } from '@lytics/dev-agent-subagents';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubOutput } from '../../schemas/index.js';
import { GitHubAdapter } from '../built-in/github-adapter';
import type { ToolExecutionContext } from '../types';

describe('GitHubAdapter', () => {
  let adapter: GitHubAdapter;
  let mockGitHubService: GitHubService;
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
    // Mock GitHubService
    mockGitHubService = {
      search: vi.fn(),
      getContext: vi.fn(),
      findRelated: vi.fn(),
      getStats: vi.fn(),
      index: vi.fn(),
      isIndexed: vi.fn(),
      shutdown: vi.fn(),
    } as unknown as GitHubService;

    // Create adapter
    adapter = new GitHubAdapter({
      repositoryPath: '/test/repo',
      githubService: mockGitHubService,
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
      expect(definition.inputSchema.properties?.action.enum).toEqual([
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
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('action');
    });

    it('should reject search without query', async () => {
      const result = await adapter.execute(
        {
          action: 'search',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('query');
    });

    it('should reject context without number', async () => {
      const result = await adapter.execute(
        {
          action: 'context',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('number');
    });

    it('should reject related without number', async () => {
      const result = await adapter.execute(
        {
          action: 'related',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('number');
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
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('limit');
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
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('format');
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

      vi.mocked(mockGitHubService.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as GitHubOutput)?.content).toContain('GitHub Search Results');
      expect((result.data as GitHubOutput)?.content).toContain('#1');
      expect((result.data as GitHubOutput)?.content).toContain('Test Issue');
    });

    it('should search with filters', async () => {
      const mockResults: GitHubSearchResult[] = [
        {
          document: mockIssue,
          score: 0.9,
          matchedFields: ['title'],
        },
      ];

      vi.mocked(mockGitHubService.search).mockResolvedValue(mockResults);

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
      expect(mockGitHubService.search).toHaveBeenCalledWith('test', {
        type: 'issue',
        state: 'open',
        labels: ['bug'],
        author: 'testuser',
        limit: 10,
      });
    });

    it('should handle no results', async () => {
      vi.mocked(mockGitHubService.search).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'nonexistent',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as GitHubOutput)?.content).toContain('No matching issues or PRs found');
    });

    it('should include token footer in search results', async () => {
      const mockResults: GitHubSearchResult[] = [
        {
          document: mockIssue,
          score: 0.9,
          matchedFields: ['title'],
        },
      ];

      vi.mocked(mockGitHubService.search).mockResolvedValue(mockResults);

      const result = await adapter.execute(
        {
          action: 'search',
          query: 'test',
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      const content = (result.data as GitHubOutput)?.content;
      expect(content).toBeDefined();
      // Token info is now in metadata, not content
      expect(result.metadata).toHaveProperty('tokens');
      expect(result.metadata?.tokens).toBeGreaterThan(0);
    });
  });

  describe('Context Action', () => {
    it('should get issue context in compact format', async () => {
      // Mock getDocument to return the issue directly (new implementation)
      vi.mocked(mockGitHubService.getContext).mockResolvedValue(mockIssue);

      const result = await adapter.execute(
        {
          action: 'context',
          number: 1,
          format: 'compact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as GitHubOutput)?.content).toContain('Issue #1');
      expect((result.data as GitHubOutput)?.content).toContain('Test Issue');
      expect((result.data as GitHubOutput)?.content).toContain('testuser');
    });

    it('should get issue context in verbose format', async () => {
      // Mock getDocument to return the issue directly
      vi.mocked(mockGitHubService.getContext).mockResolvedValue(mockIssue);

      const result = await adapter.execute(
        {
          action: 'context',
          number: 1,
          format: 'verbose',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as GitHubOutput)?.content).toContain('**Related Issues:** #2, #3');
      expect((result.data as GitHubOutput)?.content).toContain('**Related PRs:** #10');
      expect((result.data as GitHubOutput)?.content).toContain('**Linked Files:** `src/test.ts`');
      expect((result.data as GitHubOutput)?.content).toContain('**Mentions:** @developer1');
    });

    it('should handle issue not found', async () => {
      // Mock getDocument to return null (not found)
      vi.mocked(mockGitHubService.getContext).mockResolvedValue(null);
      // Also mock search for fallback case
      vi.mocked(mockGitHubService.search).mockResolvedValue([]);

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

      // Mock getContext for finding the main issue
      vi.mocked(mockGitHubService.getContext).mockResolvedValue(mockIssue);

      // Mock findRelated for finding related issues
      vi.mocked(mockGitHubService.findRelated).mockResolvedValue([
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
      expect((result.data as GitHubOutput)?.content).toContain('Related Issues/PRs');
      expect((result.data as GitHubOutput)?.content).toContain('#2');
      expect((result.data as GitHubOutput)?.content).toContain('Related Issue');
    });

    it('should handle no related items', async () => {
      // Mock getContext for finding the main issue
      vi.mocked(mockGitHubService.getContext).mockResolvedValue(mockIssue);

      // Mock findRelated to return no related items
      vi.mocked(mockGitHubService.findRelated).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          action: 'related',
          number: 1,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result.data as GitHubOutput)?.content).toContain('No related issues or PRs found');
    });
  });

  describe('related action', () => {
    it('should find related issues with real search scores', async () => {
      const relatedResults: GitHubSearchResult[] = [
        {
          document: { ...mockIssue, number: 2, title: 'Related Issue 1' },
          score: 0.9,
          matchedFields: ['title', 'body'],
        },
        {
          document: { ...mockIssue, number: 3, title: 'Related Issue 2' },
          score: 0.85,
          matchedFields: ['title'],
        },
      ];

      vi.mocked(mockGitHubService.getContext).mockResolvedValue(mockIssue);
      vi.mocked(mockGitHubService.findRelated).mockResolvedValue(relatedResults);

      const result = await adapter.execute(
        {
          action: 'related',
          number: 1,
          limit: 5,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const output = result.data as GitHubOutput;
        expect(output.content).toContain('Related Issue 1');
        expect(output.content).toContain('Related Issue 2');
        expect(output.content).toContain('90% similar'); // Score shown as percentage
        expect(output.resultsTotal).toBe(2);
        expect(output.resultsReturned).toBe(2);
      }

      expect(mockGitHubService.getContext).toHaveBeenCalledWith(1);
      expect(mockGitHubService.findRelated).toHaveBeenCalledWith(1, 5);
    });

    it('should handle no related issues found', async () => {
      vi.mocked(mockGitHubService.getContext).mockResolvedValue(mockIssue);
      vi.mocked(mockGitHubService.findRelated).mockResolvedValue([]);

      const result = await adapter.execute(
        {
          action: 'related',
          number: 1,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const output = result.data as GitHubOutput;
        expect(output.content).toContain('No related issues or PRs found');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle index not ready error', async () => {
      vi.mocked(mockGitHubService.search).mockRejectedValue(new Error('GitHub index not indexed'));

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
      vi.mocked(mockGitHubService.search).mockRejectedValue(new Error('Unknown error'));

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

  // Note: Auto-reload functionality is now handled by GitHubService internally
  // No need to test file watching at the adapter level
});
