import type { GitCommit, GitIndexer, LocalGitExtractor } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryAdapter } from '../built-in/history-adapter';
import type { ToolExecutionContext } from '../types';

// Mock commit data
const createMockCommit = (overrides: Partial<GitCommit> = {}): GitCommit => ({
  hash: 'abc123def456789012345678901234567890abcd',
  shortHash: 'abc123d',
  message: 'feat: add authentication token handling\n\nThis adds token refresh logic.',
  subject: 'feat: add authentication token handling',
  body: 'This adds token refresh logic.',
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
    { path: 'src/auth/token.ts', status: 'modified', additions: 50, deletions: 10 },
    { path: 'src/auth/index.ts', status: 'modified', additions: 5, deletions: 2 },
  ],
  stats: {
    additions: 55,
    deletions: 12,
    filesChanged: 2,
  },
  refs: {
    branches: [],
    tags: [],
    issueRefs: [123],
    prRefs: [456],
  },
  parents: ['parent123'],
  ...overrides,
});

describe('HistoryAdapter', () => {
  let mockGitIndexer: GitIndexer;
  let mockGitExtractor: LocalGitExtractor;
  let adapter: HistoryAdapter;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    // Create mock git indexer
    mockGitIndexer = {
      index: vi.fn().mockResolvedValue({ commitsIndexed: 10, durationMs: 100, errors: [] }),
      search: vi.fn().mockResolvedValue([createMockCommit()]),
      getFileHistory: vi.fn().mockResolvedValue([createMockCommit()]),
      getIndexedCommitCount: vi.fn().mockResolvedValue(100),
    } as unknown as GitIndexer;

    // Create mock git extractor
    mockGitExtractor = {
      getCommits: vi.fn().mockResolvedValue([createMockCommit()]),
      getCommit: vi.fn(),
      getBlame: vi.fn(),
      getRepositoryInfo: vi.fn(),
    } as unknown as LocalGitExtractor;

    adapter = new HistoryAdapter({
      gitIndexer: mockGitIndexer,
      gitExtractor: mockGitExtractor,
      defaultLimit: 10,
      defaultTokenBudget: 2000,
    });

    mockContext = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      requestId: 'test-request',
    } as unknown as ToolExecutionContext;
  });

  describe('getToolDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = adapter.getToolDefinition();

      expect(definition.name).toBe('dev_history');
      expect(definition.description).toContain('commits');
      expect(definition.inputSchema.properties).toHaveProperty('query');
      expect(definition.inputSchema.properties).toHaveProperty('file');
      expect(definition.inputSchema.properties).toHaveProperty('limit');
      expect(definition.inputSchema.properties).toHaveProperty('since');
      expect(definition.inputSchema.properties).toHaveProperty('author');
      expect(definition.inputSchema.properties).toHaveProperty('tokenBudget');
    });

    it('should require either query or file', () => {
      const definition = adapter.getToolDefinition();

      // Note: anyOf removed for Claude API compatibility - validation is done in execute()
      expect(definition.inputSchema.required).toEqual([]);
    });
  });

  describe('execute', () => {
    describe('semantic search (query)', () => {
      it('should search commits by semantic query', async () => {
        const result = await adapter.execute({ query: 'authentication token' }, mockContext);

        expect(result.success).toBe(true);
        expect(mockGitIndexer.search).toHaveBeenCalledWith('authentication token', { limit: 10 });
        expect(result.data).toMatchObject({
          searchType: 'semantic',
          query: 'authentication token',
        });
      });

      it('should respect limit option', async () => {
        await adapter.execute({ query: 'test', limit: 5 }, mockContext);

        expect(mockGitIndexer.search).toHaveBeenCalledWith('test', { limit: 5 });
      });

      it('should include commit summaries in data', async () => {
        const result = await adapter.execute({ query: 'test' }, mockContext);

        expect(result.data?.commits).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              hash: 'abc123d',
              subject: 'feat: add authentication token handling',
              author: 'Test User',
            }),
          ])
        );
      });
    });

    describe('file history', () => {
      it('should get history for a specific file', async () => {
        const result = await adapter.execute({ file: 'src/auth/token.ts' }, mockContext);

        expect(result.success).toBe(true);
        expect(mockGitExtractor.getCommits).toHaveBeenCalledWith({
          path: 'src/auth/token.ts',
          limit: 10,
          since: undefined,
          author: undefined,
          follow: true,
          noMerges: true,
        });
        expect(result.data).toMatchObject({
          searchType: 'file',
          file: 'src/auth/token.ts',
        });
      });

      it('should pass since and author filters', async () => {
        await adapter.execute(
          {
            file: 'src/file.ts',
            since: '2025-01-01',
            author: 'test@example.com',
          },
          mockContext
        );

        expect(mockGitExtractor.getCommits).toHaveBeenCalledWith(
          expect.objectContaining({
            since: '2025-01-01',
            author: 'test@example.com',
          })
        );
      });
    });

    describe('validation', () => {
      it('should require query or file', async () => {
        const result = await adapter.execute({}, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
        expect(result.error?.message).toContain('query');
      });

      it('should validate limit range', async () => {
        const result = await adapter.execute({ query: 'test', limit: 100 }, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
        expect(result.error?.message).toContain('limit');
      });
    });

    describe('output formatting', () => {
      it('should include formatted content', async () => {
        const result = await adapter.execute({ query: 'test' }, mockContext);

        expect(result.data?.content).toContain('# Git History');
        expect(result.data?.content).toContain('abc123d');
        expect(result.data?.content).toContain('feat: add authentication token handling');
      });

      it('should include file changes in output', async () => {
        const result = await adapter.execute({ query: 'test' }, mockContext);

        expect(result.data?.content).toContain('src/auth/token.ts');
      });

      it('should include issue/PR refs in output', async () => {
        const result = await adapter.execute({ query: 'test' }, mockContext);

        expect(result.data?.content).toContain('#123');
        expect(result.data?.content).toContain('#456');
      });
    });

    describe('token budgeting', () => {
      it('should respect token budget', async () => {
        // Create many commits
        const manyCommits = Array.from({ length: 20 }, (_, i) =>
          createMockCommit({
            hash: `hash${i.toString().padStart(38, '0')}`,
            shortHash: `h${i.toString().padStart(6, '0')}`,
            subject: `Commit ${i}: ${Array(100).fill('word').join(' ')}`,
          })
        );
        vi.mocked(mockGitIndexer.search).mockResolvedValue(manyCommits);

        const result = await adapter.execute({ query: 'test', tokenBudget: 500 }, mockContext);

        expect(result.success).toBe(true);
        // Should truncate due to token budget
        expect(result.data?.content).toContain('token budget reached');
      });
    });

    describe('metadata', () => {
      it('should include metadata in result', async () => {
        const result = await adapter.execute({ query: 'test' }, mockContext);

        expect(result.metadata).toMatchObject({
          tokens: expect.any(Number),
          duration_ms: expect.any(Number),
          timestamp: expect.any(String),
          cached: false,
        });
      });
    });

    describe('error handling', () => {
      it('should handle search errors', async () => {
        vi.mocked(mockGitIndexer.search).mockRejectedValue(new Error('Search failed'));

        const result = await adapter.execute({ query: 'test' }, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('HISTORY_FAILED');
        expect(result.error?.message).toContain('Search failed');
      });

      it('should handle extractor errors', async () => {
        vi.mocked(mockGitExtractor.getCommits).mockRejectedValue(new Error('Git error'));

        const result = await adapter.execute({ file: 'src/file.ts' }, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('HISTORY_FAILED');
      });
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on limit and budget', () => {
      const estimate = adapter.estimateTokens({ limit: 10, tokenBudget: 2000 });

      expect(estimate).toBeLessThanOrEqual(2000);
      expect(estimate).toBeGreaterThan(0);
    });
  });
});
