/**
 * Tests for GitHistoryService
 */

import { describe, expect, it, vi } from 'vitest';
import type { GitExtractor, GitIndexer, VectorStorage } from '../git-history-service.js';
import { GitHistoryService } from '../git-history-service.js';

vi.mock('../../storage/path.js', () => ({
  getStoragePath: vi.fn().mockResolvedValue('/mock/storage'),
  getStorageFilePaths: vi.fn().mockReturnValue({
    vectors: '/mock/storage/vectors',
  }),
}));

describe('GitHistoryService', () => {
  describe('getGitIndexer', () => {
    it('should create and cache git indexer', async () => {
      const mockExtractor: GitExtractor = {
        extractCommits: vi.fn().mockResolvedValue([]),
      };

      const mockVectorStorage: VectorStorage = {
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
      };

      const mockGitIndexer: GitIndexer = {
        index: vi.fn().mockResolvedValue({}),
        search: vi.fn().mockResolvedValue([]),
        getCommits: vi.fn().mockResolvedValue([]),
      };

      const factories = {
        createExtractor: vi.fn().mockResolvedValue(mockExtractor),
        createVectorStorage: vi.fn().mockResolvedValue(mockVectorStorage),
        createGitIndexer: vi.fn().mockResolvedValue(mockGitIndexer),
      };

      const service = new GitHistoryService({ repositoryPath: '/test/repo' }, factories);

      // First call should create
      const indexer1 = await service.getGitIndexer();

      expect(factories.createExtractor).toHaveBeenCalledWith('/test/repo');
      expect(factories.createVectorStorage).toHaveBeenCalledWith('/mock/storage/vectors-git');
      expect(factories.createGitIndexer).toHaveBeenCalledWith({
        extractor: mockExtractor,
        vectorStorage: mockVectorStorage,
      });
      expect(indexer1).toBe(mockGitIndexer);

      // Second call should return cached
      const indexer2 = await service.getGitIndexer();

      expect(factories.createExtractor).toHaveBeenCalledOnce(); // Not called again
      expect(indexer2).toBe(mockGitIndexer);
    });
  });

  describe('getExtractor', () => {
    it('should create git extractor', async () => {
      const mockExtractor: GitExtractor = {
        extractCommits: vi.fn().mockResolvedValue([]),
      };

      const factories = {
        createExtractor: vi.fn().mockResolvedValue(mockExtractor),
        createVectorStorage: vi.fn().mockResolvedValue({} as VectorStorage),
        createGitIndexer: vi.fn().mockResolvedValue({} as GitIndexer),
      };

      const service = new GitHistoryService({ repositoryPath: '/test/repo' }, factories);

      const extractor = await service.getExtractor();

      expect(factories.createExtractor).toHaveBeenCalledWith('/test/repo');
      expect(extractor).toBe(mockExtractor);
    });
  });

  describe('search', () => {
    it('should search git history', async () => {
      const mockResults = [{ sha: 'abc123', message: 'Fix bug' }];

      const mockGitIndexer: GitIndexer = {
        index: vi.fn().mockResolvedValue({}),
        search: vi.fn().mockResolvedValue(mockResults),
        getCommits: vi.fn().mockResolvedValue([]),
      };

      const factories = {
        createExtractor: vi.fn().mockResolvedValue({} as GitExtractor),
        createVectorStorage: vi.fn().mockResolvedValue({
          initialize: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          add: vi.fn(),
          search: vi.fn(),
        } as VectorStorage),
        createGitIndexer: vi.fn().mockResolvedValue(mockGitIndexer),
      };

      const service = new GitHistoryService({ repositoryPath: '/test/repo' }, factories);

      const results = await service.search('bug fix', { limit: 5 });

      expect(mockGitIndexer.search).toHaveBeenCalledWith('bug fix', { limit: 5 });
      expect(results).toEqual(mockResults);
    });

    it('should use default limit when not provided', async () => {
      const mockGitIndexer: GitIndexer = {
        index: vi.fn().mockResolvedValue({}),
        search: vi.fn().mockResolvedValue([]),
        getCommits: vi.fn().mockResolvedValue([]),
      };

      const factories = {
        createExtractor: vi.fn().mockResolvedValue({} as GitExtractor),
        createVectorStorage: vi.fn().mockResolvedValue({
          initialize: vi.fn().mockResolvedValue(undefined),
          close: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        } as VectorStorage),
        createGitIndexer: vi.fn().mockResolvedValue(mockGitIndexer),
      };

      const service = new GitHistoryService({ repositoryPath: '/test/repo' }, factories);

      await service.search('test query');

      expect(mockGitIndexer.search).toHaveBeenCalledWith('test query', { limit: 10 });
    });
  });

  describe('getCommits', () => {
    it('should get commits with filters', async () => {
      const mockCommits = [
        { sha: 'abc123', author: 'user1', message: 'Commit 1' },
        { sha: 'def456', author: 'user1', message: 'Commit 2' },
      ];

      const mockGitIndexer: GitIndexer = {
        index: vi.fn().mockResolvedValue({}),
        search: vi.fn().mockResolvedValue([]),
        getCommits: vi.fn().mockResolvedValue(mockCommits),
      };

      const factories = {
        createExtractor: vi.fn().mockResolvedValue({} as GitExtractor),
        createVectorStorage: vi.fn().mockResolvedValue({
          initialize: vi.fn().mockResolvedValue(undefined),
          close: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        } as VectorStorage),
        createGitIndexer: vi.fn().mockResolvedValue(mockGitIndexer),
      };

      const service = new GitHistoryService({ repositoryPath: '/test/repo' }, factories);

      const commits = await service.getCommits({
        author: 'user1',
        since: '2024-01-01',
        limit: 10,
      });

      expect(mockGitIndexer.getCommits).toHaveBeenCalledWith({
        author: 'user1',
        since: '2024-01-01',
        limit: 10,
      });
      expect(commits).toEqual(mockCommits);
    });
  });

  describe('index', () => {
    it('should index git history', async () => {
      const mockStats = {
        commitsIndexed: 100,
        duration: 5000,
      };

      const mockGitIndexer: GitIndexer = {
        index: vi.fn().mockResolvedValue(mockStats),
        search: vi.fn().mockResolvedValue([]),
        getCommits: vi.fn().mockResolvedValue([]),
      };

      const factories = {
        createExtractor: vi.fn().mockResolvedValue({} as GitExtractor),
        createVectorStorage: vi.fn().mockResolvedValue({
          initialize: vi.fn().mockResolvedValue(undefined),
          close: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        } as VectorStorage),
        createGitIndexer: vi.fn().mockResolvedValue(mockGitIndexer),
      };

      const service = new GitHistoryService({ repositoryPath: '/test/repo' }, factories);

      const stats = await service.index({ since: '2024-01-01', limit: 100 });

      expect(mockGitIndexer.index).toHaveBeenCalledWith({
        since: '2024-01-01',
        limit: 100,
      });
      expect(stats).toEqual(mockStats);
    });
  });

  describe('close', () => {
    it('should close vector storage and clear cache', async () => {
      const mockVectorStorage: VectorStorage = {
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        add: vi.fn(),
        search: vi.fn(),
      };

      const factories = {
        createExtractor: vi.fn().mockResolvedValue({} as GitExtractor),
        createVectorStorage: vi.fn().mockResolvedValue(mockVectorStorage),
        createGitIndexer: vi.fn().mockResolvedValue({} as GitIndexer),
      };

      const service = new GitHistoryService({ repositoryPath: '/test/repo' }, factories);

      // Create indexer to initialize cache
      await service.getGitIndexer();

      // Close service
      await service.close();

      expect(mockVectorStorage.close).toHaveBeenCalledOnce();

      // Getting indexer again should recreate (not use cache)
      await service.getGitIndexer();

      expect(factories.createExtractor).toHaveBeenCalledTimes(2); // Called again
    });

    it('should handle close when nothing is cached', async () => {
      const service = new GitHistoryService({ repositoryPath: '/test/repo' });

      // Should not throw
      await expect(service.close()).resolves.toBeUndefined();
    });
  });
});
