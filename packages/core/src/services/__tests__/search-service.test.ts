/**
 * Tests for SearchService
 */

import { describe, expect, it, vi } from 'vitest';
import type { RepositoryIndexer } from '../../indexer/index.js';
import type { SearchResult } from '../../vector/types.js';
import { SearchService } from '../search-service.js';

vi.mock('../../storage/path.js', () => ({
  getStoragePath: vi.fn().mockResolvedValue('/mock/storage'),
  getStorageFilePaths: vi.fn().mockReturnValue({
    vectors: '/mock/storage/vectors',
    indexerState: '/mock/storage/indexer-state.json',
    metrics: '/mock/storage/metrics.db',
  }),
}));

describe('SearchService', () => {
  const mockSearchResults: SearchResult[] = [
    {
      id: 'doc1',
      score: 0.95,
      metadata: {
        name: 'authenticate',
        type: 'function',
        startLine: 10,
        endLine: 20,
        path: 'src/auth/authenticate.ts',
        signature: 'function authenticate(user: User)',
      },
    },
    {
      id: 'doc2',
      score: 0.85,
      metadata: {
        name: 'login',
        type: 'function',
        startLine: 5,
        endLine: 15,
        path: 'src/auth/login.ts',
        signature: 'function login(credentials: Credentials)',
      },
    },
  ];

  describe('search', () => {
    it('should perform semantic search', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockSearchResults),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.search('authentication', { limit: 10, scoreThreshold: 0.7 });

      expect(mockFactory).toHaveBeenCalledOnce();
      expect(mockIndexer.initialize).toHaveBeenCalledOnce();
      expect(mockIndexer.search).toHaveBeenCalledWith('authentication', {
        limit: 10,
        scoreThreshold: 0.7,
      });
      expect(mockIndexer.close).toHaveBeenCalledOnce();
      expect(results).toEqual(mockSearchResults);
    });

    it('should use default options when not provided', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      await service.search('test query');

      expect(mockIndexer.search).toHaveBeenCalledWith('test query', {
        limit: 10,
        scoreThreshold: 0.7,
      });
    });

    it('should close indexer even on error', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockRejectedValue(new Error('Search failed')),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      await expect(service.search('test')).rejects.toThrow('Search failed');
      expect(mockIndexer.close).toHaveBeenCalledOnce();
    });
  });

  describe('findSimilar', () => {
    it('should find similar code to a file', async () => {
      const targetFile: SearchResult = {
        id: 'doc1',
        score: 1.0,
        metadata: {
          name: 'processPayment',
          type: 'function',
          path: 'src/payments/process.ts',
          signature: 'function processPayment()',
        },
      };

      const similarResults: SearchResult[] = [
        targetFile, // The file itself
        {
          id: 'doc2',
          score: 0.88,
          metadata: {
            name: 'handlePayment',
            type: 'function',
            path: 'src/payments/handler.ts',
            signature: 'function handlePayment()',
          },
        },
        {
          id: 'doc3',
          score: 0.82,
          metadata: {
            name: 'refundPayment',
            type: 'function',
            path: 'src/payments/refund.ts',
            signature: 'function refundPayment()',
          },
        },
      ];

      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getAll: vi.fn().mockResolvedValue([targetFile, ...similarResults]),
        searchByDocumentId: vi.fn().mockResolvedValue([targetFile, ...similarResults]),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.findSimilar('src/payments/process.ts', {
        limit: 5,
        threshold: 0.8,
      });

      expect(mockIndexer.getAll).toHaveBeenCalledOnce();
      expect(mockIndexer.searchByDocumentId).toHaveBeenCalledOnce();
      expect(results).toHaveLength(2); // Should exclude the original file
      expect(results.find((r) => r.metadata.path === 'src/payments/process.ts')).toBeUndefined();
    });

    it('should return empty array when file not found', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getAll: vi.fn().mockResolvedValue([]), // File not found
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.findSimilar('src/nonexistent.ts');

      expect(results).toEqual([]);
    });
  });

  describe('findRelatedTests', () => {
    it('should find test files for a source file', async () => {
      const testResults: SearchResult[] = [
        {
          id: 'test1',
          score: 0.9,
          metadata: {
            path: 'src/user/__tests__/user-service.test.ts',
            type: 'function',
            name: 'describe',
          },
        },
        {
          id: 'test2',
          score: 0.85,
          metadata: {
            path: 'src/user/user-service.spec.ts',
            type: 'function',
            name: 'it',
          },
        },
        {
          id: 'not-test',
          score: 0.8,
          metadata: {
            path: 'src/user/user-service.ts', // Not a test file
            type: 'class',
            name: 'UserService',
          },
        },
      ];

      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(testResults),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.findRelatedTests('src/user/user-service.ts');

      expect(results).toHaveLength(2);
      expect(results).toContain('src/user/__tests__/user-service.test.ts');
      expect(results).toContain('src/user/user-service.spec.ts');
      expect(results).not.toContain('src/user/user-service.ts');
    });

    it('should return empty array when no tests found', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const results = await service.findRelatedTests('src/util.ts');

      expect(results).toEqual([]);
    });
  });

  describe('findSymbol', () => {
    it('should find a symbol by exact name match', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockSearchResults),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.findSymbol('authenticate');

      expect(result).toBeDefined();
      expect(result?.metadata.name).toBe('authenticate');
    });

    it('should return first result when no exact match', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockSearchResults),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.findSymbol('nonexistent');

      expect(result).toBeDefined();
      expect(result).toEqual(mockSearchResults[0]);
    });

    it('should return null when no results found', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.findSymbol('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('isIndexed', () => {
    it('should return true when repository is indexed', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({
          filesScanned: 100,
          documentsIndexed: 250,
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(true);
    });

    it('should return false when repository is not indexed', async () => {
      const mockIndexer: RepositoryIndexer = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue(null),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as RepositoryIndexer;

      const mockFactory = vi.fn().mockResolvedValue(mockIndexer);
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockFactory = vi.fn().mockRejectedValue(new Error('Init failed'));
      const service = new SearchService({ repositoryPath: '/test/repo' }, mockFactory);

      const result = await service.isIndexed();

      expect(result).toBe(false);
    });
  });
});
