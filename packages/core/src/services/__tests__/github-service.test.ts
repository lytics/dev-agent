/**
 * Tests for GitHubService
 */

import type {
  GitHubDocument,
  GitHubIndexerInstance,
  GitHubIndexStats,
  GitHubSearchResult,
} from '@lytics/dev-agent-types/github';
import { describe, expect, it, vi } from 'vitest';
import { type GitHubIndexerFactory, GitHubService } from '../github-service.js';

vi.mock('../../storage/path.js', () => ({
  getStoragePath: vi.fn().mockResolvedValue('/mock/storage'),
  getStorageFilePaths: vi.fn().mockReturnValue({
    vectors: '/mock/storage/vectors',
    githubState: '/mock/storage/github-state.json',
  }),
}));

describe('GitHubService', () => {
  const mockIndexStats: GitHubIndexStats = {
    repository: 'lytics/dev-agent',
    totalDocuments: 150,
    byType: {
      issue: 100,
      pull_request: 50,
      discussion: 0,
    },
    byState: {
      open: 75,
      closed: 60,
      merged: 15,
    },
    lastIndexed: '2024-01-01T00:05:00Z',
    indexDuration: 300000,
  };

  const mockDocument: GitHubDocument = {
    type: 'issue',
    number: 123,
    title: 'Add authentication feature',
    body: 'We need to implement user authentication',
    state: 'open',
    labels: ['enhancement', 'security'],
    author: 'user1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    url: 'https://github.com/org/repo/issues/123',
    repository: 'org/repo',
    comments: 5,
    reactions: { '+1': 10, eyes: 2 },
    relatedIssues: [],
    relatedPRs: [],
    linkedFiles: [],
    mentions: [],
  };

  const mockSearchResults: GitHubSearchResult[] = [
    {
      document: mockDocument,
      score: 0.95,
      matchedFields: ['title', 'body'],
    },
    {
      document: {
        ...mockDocument,
        number: 456,
        type: 'pull_request',
        title: 'Fix login bug',
        body: 'Fixes issue with login flow',
        state: 'merged',
        author: 'user2',
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-04T00:00:00Z',
        labels: ['bug'],
        url: 'https://github.com/org/repo/pull/456',
      },
      score: 0.88,
      matchedFields: ['title'],
    },
  ];

  describe('index', () => {
    it('should index GitHub issues and PRs', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

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
      });
      // Note: Service manages indexer lifecycle, doesn't close after each operation
      expect(stats).toEqual(mockIndexStats);
    });

    it('should handle progress callbacks', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

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

    it('should throw error on indexing failure', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockRejectedValue(new Error('Index failed')),
        close: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      await expect(service.index()).rejects.toThrow('Index failed');
    });
  });

  describe('search', () => {
    it('should search GitHub issues and PRs', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockSearchResults),
        close: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.search('authentication', { limit: 10 });

      expect(mockIndexer.search).toHaveBeenCalledWith('authentication', { limit: 10 });
      expect(results).toEqual(mockSearchResults);
    });

    it('should use default limit when not provided', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      await service.search('test query');

      expect(mockIndexer.search).toHaveBeenCalledWith('test query', undefined);
    });
  });

  describe('getContext', () => {
    it('should get context for a specific issue', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockSearchResults),
        close: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const context = await service.getContext(123);

      expect(mockIndexer.search).toHaveBeenCalledWith('123', { limit: 1 });
      expect(context).toBeDefined();
      expect(context?.number).toBe(123);
      expect(context?.title).toBe('Add authentication feature');
      expect(context?.type).toBe('issue');
    });

    it('should return null when issue not found', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const context = await service.getContext(999);

      expect(context).toBeNull();
    });

    it('should handle partial documents', async () => {
      const partialDocument: GitHubDocument = {
        type: 'issue',
        number: 123,
        title: 'Test Issue',
        body: '',
        state: 'open',
        labels: [],
        author: '',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/org/repo/issues/123',
        repository: 'org/repo',
        comments: 0,
        reactions: {},
        relatedIssues: [],
        relatedPRs: [],
        linkedFiles: [],
        mentions: [],
      };

      const partialResult: GitHubSearchResult = {
        document: partialDocument,
        score: 0.95,
        matchedFields: ['title'],
      };

      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([partialResult]),
        close: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

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
    it('should find related issues using search with real scores', async () => {
      const targetResult: GitHubSearchResult = {
        document: mockDocument,
        score: 1.0,
        matchedFields: ['title', 'body'],
      };

      const relatedResults: GitHubSearchResult[] = [
        targetResult, // Original issue
        {
          document: { ...mockDocument, number: 124, title: 'Implement OAuth' },
          score: 0.9,
          matchedFields: ['title'],
        },
        {
          document: { ...mockDocument, number: 125, title: 'Add JWT support' },
          score: 0.85,
          matchedFields: ['title'],
        },
      ];

      const mockIndexer: GitHubIndexerInstance = {
        initialize: vi.fn().mockResolvedValue(undefined),
        // First search: getContext searches for #123
        // Second search: findRelated searches by title
        search: vi.fn().mockResolvedValueOnce([targetResult]).mockResolvedValueOnce(relatedResults),
        close: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

      const mockFactory: GitHubIndexerFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.findRelated(123, 5);

      // Service calls search twice: once for context (by number), once for related items (by title)
      expect(mockIndexer.search).toHaveBeenCalledTimes(2);
      expect(mockIndexer.search).toHaveBeenNthCalledWith(1, '123', { limit: 1 });
      expect(mockIndexer.search).toHaveBeenNthCalledWith(2, 'Add authentication feature', {
        limit: 6,
      });

      // Should return GitHubSearchResult[] with real scores, excluding original issue
      expect(results).toHaveLength(2);
      expect(results[0].document.number).toBe(124);
      expect(results[0].score).toBe(0.9);
      expect(results[1].document.number).toBe(125);
      expect(results[1].score).toBe(0.85);
    });

    it('should return empty array when target not found', async () => {
      const mockIndexer: GitHubIndexerInstance = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockReturnValue(mockIndexStats),
      };

      const mockFactory: GitHubIndexerFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.findRelated(999);

      expect(results).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return GitHub index statistics', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue(mockIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const stats = await service.getStats();

      expect(stats).toEqual(mockIndexStats);
    });

    it('should return null on error', async () => {
      const mockIndexer: GitHubIndexerInstance = {
        initialize: vi.fn().mockResolvedValue(undefined),
        index: vi.fn().mockResolvedValue(mockIndexStats),
        search: vi.fn().mockResolvedValue([]),
        getDocument: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockImplementation(() => {
          throw new Error('Stats failed');
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockFactory: GitHubIndexerFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const stats = await service.getStats();

      expect(stats).toBeNull();
    });
  });

  describe('isIndexed', () => {
    it('should return true when GitHub data is indexed', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue(mockIndexStats),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new GitHubService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(true);
    });

    it('should return false when not indexed', async () => {
      const mockIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({ ...mockIndexStats, totalDocuments: 0 }),
        close: vi.fn().mockResolvedValue(undefined),
      };

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
