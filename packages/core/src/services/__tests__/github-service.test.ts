/**
 * Tests for GitHubService
 */

import { describe, expect, it, vi } from 'vitest';
import type { GitHubIndexer, GitHubIndexStats, GitHubSearchResult } from '../github-service.js';
import { GitHubService } from '../github-service.js';

vi.mock('../../storage/path.js', () => ({
  getStoragePath: vi.fn().mockResolvedValue('/mock/storage'),
  getStorageFilePaths: vi.fn().mockReturnValue({
    vectors: '/mock/storage/vectors',
    githubState: '/mock/storage/github-state.json',
  }),
}));

describe('GitHubService', () => {
  const mockIndexStats: GitHubIndexStats = {
    totalDocuments: 150,
    totalIssues: 100,
    totalPullRequests: 50,
    vectorsStored: 150,
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T00:05:00Z'),
    duration: 300000,
  };

  const mockSearchResults: GitHubSearchResult[] = [
    {
      score: 0.95,
      metadata: {
        number: 123,
        title: 'Add authentication feature',
        body: 'We need to implement user authentication',
        state: 'open',
        type: 'issue',
        author: 'user1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        labels: ['enhancement', 'security'],
        url: 'https://github.com/org/repo/issues/123',
      },
    },
    {
      score: 0.88,
      metadata: {
        number: 456,
        title: 'Fix login bug',
        body: 'Fixes issue with login flow',
        state: 'merged',
        type: 'pull_request',
        author: 'user2',
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-04T00:00:00Z',
        labels: ['bug'],
        url: 'https://github.com/org/repo/pull/456',
      },
    },
  ];

  describe('index', () => {
    it('should index GitHub issues and PRs', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const stats = await service.index({
        types: ['issue', 'pull_request'],
        state: ['open'],
        limit: 100,
      });

      expect(mockFactory).toHaveBeenCalledOnce();
      expect(mockIndexer.initialize).toHaveBeenCalledOnce();
      expect(mockIndexer.index).toHaveBeenCalledWith({
        types: ['issue', 'pull_request'],
        state: ['open'],
        limit: 100,
        logger: undefined,
        onProgress: undefined,
      });
      expect(mockIndexer.close).toHaveBeenCalledOnce();
      expect(stats).toEqual(mockIndexStats);
    });

    it('should handle progress callbacks', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const onProgress = vi.fn();
      await service.index({ onProgress });

      expect(mockIndexer.index).toHaveBeenCalledWith({
        types: undefined,
        state: undefined,
        limit: undefined,
        logger: undefined,
        onProgress,
      });
    });

    it('should close indexer even on error', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockRejectedValue(new Error('Index failed')),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      await expect(service.index()).rejects.toThrow('Index failed');
      expect(mockIndexer.close).toHaveBeenCalledOnce();
    });
  });

  describe('search', () => {
    it('should search GitHub issues and PRs', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockSearchResults),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.search('authentication', { limit: 10 });

      expect(mockIndexer.search).toHaveBeenCalledWith('authentication', {
        limit: 10,
        filter: undefined,
      });
      expect(results).toEqual(mockSearchResults);
    });

    it('should use default limit when not provided', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      await service.search('test query');

      expect(mockIndexer.search).toHaveBeenCalledWith('test query', {
        limit: 10,
        filter: undefined,
      });
    });
  });

  describe('getContext', () => {
    it('should get context for a specific issue', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockSearchResults),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const context = await service.getContext(123);

      expect(mockIndexer.search).toHaveBeenCalledWith('#123', { limit: 10 });
      expect(context).toBeDefined();
      expect(context?.number).toBe(123);
      expect(context?.title).toBe('Add authentication feature');
      expect(context?.type).toBe('issue');
    });

    it('should return null when issue not found', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const context = await service.getContext(999);

      expect(context).toBeNull();
    });

    it('should handle missing metadata gracefully', async () => {
      const partialResult: GitHubSearchResult = {
        score: 0.95,
        metadata: {
          number: 123,
          title: 'Test Issue',
          state: 'open',
          type: 'issue',
        },
      };

      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([partialResult]),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const context = await service.getContext(123);

      expect(context).toBeDefined();
      expect(context?.number).toBe(123);
      expect(context?.body).toBe('');
      expect(context?.author).toBe('');
      expect(context?.labels).toEqual([]);
    });
  });

  describe('findRelated', () => {
    it('should find related issues', async () => {
      const targetResult: GitHubSearchResult = {
        score: 1.0,
        metadata: {
          number: 123,
          title: 'Add authentication feature',
          body: 'Detailed description',
          state: 'open',
          type: 'issue',
        },
      };

      const relatedResults: GitHubSearchResult[] = [
        targetResult,
        {
          score: 0.9,
          metadata: {
            number: 124,
            title: 'Implement OAuth',
            state: 'open',
            type: 'issue',
          },
        },
        {
          score: 0.85,
          metadata: {
            number: 125,
            title: 'Add JWT support',
            state: 'open',
            type: 'issue',
          },
        },
      ];

      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi
          .fn()
          .mockResolvedValueOnce([targetResult]) // getContext call
          .mockResolvedValueOnce(relatedResults), // findRelated call
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.findRelated(123, 5);

      expect(mockIndexer.search).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2); // Should exclude original issue
      expect(results.find((r) => r.metadata?.number === 123)).toBeUndefined();
    });

    it('should return empty array when target not found', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.findRelated(999);

      expect(results).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return GitHub index statistics', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue(mockIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const stats = await service.getStats();

      expect(stats).toEqual(mockIndexStats);
    });

    it('should return null on error', async () => {
      const mockFactory = vi.fn().mockRejectedValue(new Error('Init failed'));
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const stats = await service.getStats();

      expect(stats).toBeNull();
    });
  });

  describe('isIndexed', () => {
    it('should return true when GitHub data is indexed', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue(mockIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(true);
    });

    it('should return false when not indexed', async () => {
      const mockIndexer: GitHubIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({ ...mockIndexStats, totalDocuments: 0 }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as GitHubIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockFactory = vi.fn().mockRejectedValue(new Error('Init failed'));
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(false);
    });
  });
});
