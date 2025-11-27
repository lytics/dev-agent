import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VectorStorage } from '../../vector';
import type { SearchResult } from '../../vector/types';
import type { GitExtractor } from '../extractor';
import { GitIndexer } from '../indexer';
import type { GitCommit } from '../types';

// Mock commit data
const createMockCommit = (overrides: Partial<GitCommit> = {}): GitCommit => ({
  hash: 'abc123def456789012345678901234567890abcd',
  shortHash: 'abc123d',
  message: 'feat: add new feature\n\nThis adds a great new feature.',
  subject: 'feat: add new feature',
  body: 'This adds a great new feature.',
  author: {
    name: 'Test User',
    email: 'test@example.com',
    date: '2025-01-15T10:00:00Z',
  },
  committer: {
    name: 'Test User',
    email: 'test@example.com',
    date: '2025-01-15T10:00:00Z',
  },
  files: [
    { path: 'src/feature.ts', status: 'added', additions: 50, deletions: 0 },
    { path: 'src/index.ts', status: 'modified', additions: 5, deletions: 2 },
  ],
  stats: {
    additions: 55,
    deletions: 2,
    filesChanged: 2,
  },
  refs: {
    branches: [],
    tags: [],
    issueRefs: [123],
    prRefs: [],
  },
  parents: ['parent123'],
  ...overrides,
});

describe('GitIndexer', () => {
  let mockExtractor: GitExtractor;
  let mockVectorStorage: VectorStorage;
  let indexer: GitIndexer;

  beforeEach(() => {
    // Create mock extractor
    mockExtractor = {
      getCommits: vi.fn().mockResolvedValue([
        createMockCommit(),
        createMockCommit({
          hash: 'def456abc789012345678901234567890abcdef',
          shortHash: 'def456a',
          subject: 'fix: resolve bug #456',
          body: 'Fixes the critical bug.',
          refs: { branches: [], tags: [], issueRefs: [456], prRefs: [] },
        }),
      ]),
      getCommit: vi.fn(),
      getBlame: vi.fn(),
      getRepositoryInfo: vi.fn(),
    };

    // Create mock vector storage
    mockVectorStorage = {
      initialize: vi.fn().mockResolvedValue(undefined),
      addDocuments: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      getDocument: vi.fn(),
      deleteDocuments: vi.fn(),
      getStats: vi.fn(),
      optimize: vi.fn(),
      close: vi.fn(),
    } as unknown as VectorStorage;

    indexer = new GitIndexer({
      extractor: mockExtractor,
      vectorStorage: mockVectorStorage,
      commitLimit: 100,
      batchSize: 10,
    });
  });

  describe('index', () => {
    it('should extract and index commits', async () => {
      const result = await indexer.index();

      expect(mockExtractor.getCommits).toHaveBeenCalledWith({
        limit: 100,
        since: undefined,
        until: undefined,
        author: undefined,
        noMerges: true,
      });

      expect(mockVectorStorage.addDocuments).toHaveBeenCalled();
      expect(result.commitsIndexed).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should respect limit option', async () => {
      await indexer.index({ limit: 50 });

      expect(mockExtractor.getCommits).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
    });

    it('should pass date filters to extractor', async () => {
      await indexer.index({
        since: '2025-01-01',
        until: '2025-01-31',
      });

      expect(mockExtractor.getCommits).toHaveBeenCalledWith(
        expect.objectContaining({
          since: '2025-01-01',
          until: '2025-01-31',
        })
      );
    });

    it('should pass author filter to extractor', async () => {
      await indexer.index({ author: 'test@example.com' });

      expect(mockExtractor.getCommits).toHaveBeenCalledWith(
        expect.objectContaining({ author: 'test@example.com' })
      );
    });

    it('should handle empty repository', async () => {
      vi.mocked(mockExtractor.getCommits).mockResolvedValue([]);

      const result = await indexer.index();

      expect(result.commitsIndexed).toBe(0);
      expect(mockVectorStorage.addDocuments).not.toHaveBeenCalled();
    });

    it('should handle extraction errors', async () => {
      vi.mocked(mockExtractor.getCommits).mockRejectedValue(new Error('Git error'));

      const result = await indexer.index();

      expect(result.commitsIndexed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Git error');
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(mockVectorStorage.addDocuments).mockRejectedValue(new Error('Storage error'));

      const result = await indexer.index();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Storage error');
    });

    it('should report progress', async () => {
      const progressUpdates: Array<{ phase: string; percentComplete: number }> = [];

      await indexer.index({
        onProgress: (progress) => {
          progressUpdates.push({
            phase: progress.phase,
            percentComplete: progress.percentComplete,
          });
        },
      });

      expect(progressUpdates).toContainEqual(expect.objectContaining({ phase: 'extracting' }));
      expect(progressUpdates).toContainEqual(expect.objectContaining({ phase: 'embedding' }));
      expect(progressUpdates).toContainEqual(expect.objectContaining({ phase: 'storing' }));
      expect(progressUpdates).toContainEqual(
        expect.objectContaining({ phase: 'complete', percentComplete: 100 })
      );
    });

    it('should batch documents correctly', async () => {
      // Create many commits
      const manyCommits = Array.from({ length: 25 }, (_, i) =>
        createMockCommit({
          hash: `hash${i.toString().padStart(38, '0')}`,
          shortHash: `h${i}`,
          subject: `Commit ${i}`,
        })
      );
      vi.mocked(mockExtractor.getCommits).mockResolvedValue(manyCommits);

      await indexer.index();

      // With batchSize 10, 25 commits should result in 3 batches
      expect(mockVectorStorage.addDocuments).toHaveBeenCalledTimes(3);
    });
  });

  describe('search', () => {
    it('should search for commits by semantic query', async () => {
      const mockCommit = createMockCommit();
      vi.mocked(mockVectorStorage.search).mockResolvedValue([
        {
          id: `commit:${mockCommit.hash}`,
          score: 0.9,
          metadata: {
            type: 'commit',
            hash: mockCommit.hash,
            _commit: mockCommit,
          },
        } as SearchResult,
      ]);

      const results = await indexer.search('add new feature');

      expect(mockVectorStorage.search).toHaveBeenCalledWith('add new feature', {
        limit: 10,
        scoreThreshold: 0,
        filter: { type: 'commit' },
      });
      expect(results).toHaveLength(1);
      expect(results[0].hash).toBe(mockCommit.hash);
    });

    it('should respect limit option', async () => {
      await indexer.search('query', { limit: 5 });

      expect(mockVectorStorage.search).toHaveBeenCalledWith(
        'query',
        expect.objectContaining({ limit: 5 })
      );
    });

    it('should filter out results without commit metadata', async () => {
      vi.mocked(mockVectorStorage.search).mockResolvedValue([
        {
          id: 'commit:abc',
          score: 0.9,
          metadata: { type: 'commit' }, // Missing _commit
        } as SearchResult,
      ]);

      const results = await indexer.search('query');

      expect(results).toHaveLength(0);
    });
  });

  describe('getFileHistory', () => {
    it('should get history for a specific file', async () => {
      const mockCommits = [createMockCommit()];
      vi.mocked(mockExtractor.getCommits).mockResolvedValue(mockCommits);

      const results = await indexer.getFileHistory('src/feature.ts');

      expect(mockExtractor.getCommits).toHaveBeenCalledWith({
        path: 'src/feature.ts',
        limit: 20,
        follow: true,
        noMerges: true,
      });
      expect(results).toEqual(mockCommits);
    });

    it('should respect limit option', async () => {
      await indexer.getFileHistory('src/file.ts', { limit: 5 });

      expect(mockExtractor.getCommits).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
    });
  });

  describe('document preparation', () => {
    it('should create proper document structure', async () => {
      await indexer.index();

      const addCall = vi.mocked(mockVectorStorage.addDocuments).mock.calls[0];
      const documents = addCall[0];

      expect(documents[0]).toMatchObject({
        id: expect.stringMatching(/^commit:/),
        text: expect.stringContaining('feat: add new feature'),
        metadata: expect.objectContaining({
          type: 'commit',
          hash: expect.any(String),
          shortHash: expect.any(String),
          subject: expect.any(String),
          author: expect.any(String),
          authorEmail: expect.any(String),
          date: expect.any(String),
          filesChanged: expect.any(Number),
          additions: expect.any(Number),
          deletions: expect.any(Number),
          issueRefs: expect.any(Array),
          prRefs: expect.any(Array),
          _commit: expect.any(Object),
        }),
      });
    });

    it('should include file paths in text for better search', async () => {
      await indexer.index();

      const addCall = vi.mocked(mockVectorStorage.addDocuments).mock.calls[0];
      const documents = addCall[0];

      expect(documents[0].text).toContain('src/feature.ts');
      expect(documents[0].text).toContain('src/index.ts');
    });

    it('should include issue refs in metadata', async () => {
      await indexer.index();

      const addCall = vi.mocked(mockVectorStorage.addDocuments).mock.calls[0];
      const documents = addCall[0];

      expect(documents[0].metadata.issueRefs).toContain(123);
    });
  });
});
