import type { RepositoryIndexer, SearchResult } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextPackage } from '../../context-types';
import { assembleContext, formatContextPackage } from '../context-assembler';

// Mock the GitHub fetch
vi.mock('../github', () => ({
  fetchGitHubIssue: vi.fn(),
}));

import { fetchGitHubIssue } from '../github';

const mockFetchGitHubIssue = vi.mocked(fetchGitHubIssue);

describe('Context Assembler', () => {
  const mockIssue = {
    number: 42,
    title: 'Add user authentication',
    body: 'We need to add JWT-based authentication to the API.\n\n## Acceptance Criteria\n- Login endpoint\n- Logout endpoint',
    state: 'open' as const,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
    labels: ['feature', 'security'],
    assignees: [],
    author: 'testuser',
    comments: [
      {
        author: 'reviewer',
        body: 'Consider using refresh tokens too',
        createdAt: '2025-01-01T12:00:00Z',
      },
    ],
  };

  const mockSearchResults: SearchResult[] = [
    {
      id: '1',
      score: 0.85,
      metadata: {
        path: 'src/auth/jwt.ts',
        name: 'verifyToken',
        type: 'function',
        snippet: 'export function verifyToken(token: string): boolean { ... }',
        file: 'src/auth/jwt.ts',
        startLine: 10,
        endLine: 20,
        exported: true,
      },
    },
    {
      id: '2',
      score: 0.72,
      metadata: {
        path: 'src/auth/types.ts',
        name: 'AuthConfig',
        type: 'interface',
        snippet: 'export interface AuthConfig { secret: string; }',
        file: 'src/auth/types.ts',
        startLine: 1,
        endLine: 5,
        exported: true,
      },
    },
  ];

  const mockIndexer = {
    search: vi.fn().mockResolvedValue(mockSearchResults),
  } as unknown as RepositoryIndexer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchGitHubIssue.mockResolvedValue(mockIssue);
  });

  describe('assembleContext', () => {
    it('should assemble a complete context package', async () => {
      const result = await assembleContext(42, mockIndexer, '/repo');

      expect(result.issue.number).toBe(42);
      expect(result.issue.title).toBe('Add user authentication');
      expect(result.issue.author).toBe('testuser');
      expect(result.issue.labels).toEqual(['feature', 'security']);
      expect(result.issue.comments).toHaveLength(1);
    });

    it('should include relevant code from search', async () => {
      const result = await assembleContext(42, mockIndexer, '/repo');

      expect(result.relevantCode).toHaveLength(2);
      expect(result.relevantCode[0].file).toBe('src/auth/jwt.ts');
      expect(result.relevantCode[0].name).toBe('verifyToken');
      expect(result.relevantCode[0].relevanceScore).toBe(0.85);
    });

    it('should skip code search when includeCode is false', async () => {
      const result = await assembleContext(42, mockIndexer, '/repo', {
        includeCode: false,
        includePatterns: false, // Also disable patterns to avoid any search calls
      });

      expect(result.relevantCode).toHaveLength(0);
      expect(mockIndexer.search).not.toHaveBeenCalled();
    });

    it('should handle null indexer gracefully', async () => {
      const result = await assembleContext(42, null, '/repo');

      expect(result.relevantCode).toHaveLength(0);
      expect(result.metadata.codeSearchUsed).toBe(false);
    });

    it('should respect maxCodeResults option', async () => {
      await assembleContext(42, mockIndexer, '/repo', {
        maxCodeResults: 5,
      });

      expect(mockIndexer.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ limit: 5 })
      );
    });

    it('should detect codebase patterns', async () => {
      // Mock search to return test files
      const testIndexer = {
        search: vi.fn().mockResolvedValue([
          {
            id: '1',
            score: 0.8,
            metadata: {
              path: 'src/__tests__/auth.test.ts',
              name: 'auth tests',
              type: 'file',
            },
          },
        ]),
      } as unknown as RepositoryIndexer;

      const result = await assembleContext(42, testIndexer, '/repo');

      expect(result.codebasePatterns.testPattern).toBe('*.test.ts');
      expect(result.codebasePatterns.testLocation).toBe('__tests__/');
    });

    it('should skip pattern detection when includePatterns is false', async () => {
      const result = await assembleContext(42, mockIndexer, '/repo', {
        includePatterns: false,
      });

      expect(result.codebasePatterns).toEqual({});
    });

    it('should include metadata with token estimate', async () => {
      const result = await assembleContext(42, mockIndexer, '/repo');

      expect(result.metadata.generatedAt).toBeDefined();
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.codeSearchUsed).toBe(true);
      expect(result.metadata.repositoryPath).toBe('/repo');
    });

    it('should handle search errors gracefully', async () => {
      const errorIndexer = {
        search: vi.fn().mockRejectedValue(new Error('Search failed')),
      } as unknown as RepositoryIndexer;

      const result = await assembleContext(42, errorIndexer, '/repo');

      // Should not throw, just return empty code
      expect(result.relevantCode).toHaveLength(0);
    });

    it('should infer relevance reasons correctly', async () => {
      // Mock issue with title matching a function name
      mockFetchGitHubIssue.mockResolvedValueOnce({
        ...mockIssue,
        title: 'Fix verifyToken function',
      });

      const result = await assembleContext(42, mockIndexer, '/repo');

      expect(result.relevantCode[0].reason).toBe('Name matches issue title');
    });
  });

  describe('formatContextPackage', () => {
    const mockContext: ContextPackage = {
      issue: {
        number: 42,
        title: 'Add user authentication',
        body: 'We need JWT auth',
        labels: ['feature'],
        author: 'testuser',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        state: 'open',
        comments: [
          {
            author: 'reviewer',
            body: 'Looks good',
            createdAt: '2025-01-01T12:00:00Z',
          },
        ],
      },
      relevantCode: [
        {
          file: 'src/auth.ts',
          name: 'authenticate',
          type: 'function',
          snippet: 'function authenticate() {}',
          relevanceScore: 0.85,
          reason: 'Similar function pattern',
        },
      ],
      codebasePatterns: {
        testPattern: '*.test.ts',
        testLocation: '__tests__/',
      },
      relatedHistory: [
        {
          type: 'pr',
          number: 10,
          title: 'Previous auth work',
          state: 'merged',
          relevanceScore: 0.7,
        },
      ],
      relatedCommits: [],
      metadata: {
        generatedAt: '2025-01-03T00:00:00Z',
        tokensUsed: 500,
        codeSearchUsed: true,
        historySearchUsed: true,
        gitHistorySearchUsed: false,
        repositoryPath: '/repo',
      },
    };

    it('should format issue header correctly', () => {
      const output = formatContextPackage(mockContext);

      expect(output).toContain('# Issue #42: Add user authentication');
      expect(output).toContain('**Author:** testuser');
      expect(output).toContain('**State:** open');
      expect(output).toContain('**Labels:** feature');
    });

    it('should format issue description', () => {
      const output = formatContextPackage(mockContext);

      expect(output).toContain('## Description');
      expect(output).toContain('We need JWT auth');
    });

    it('should format comments section', () => {
      const output = formatContextPackage(mockContext);

      expect(output).toContain('## Comments');
      expect(output).toContain('**reviewer**');
      expect(output).toContain('Looks good');
    });

    it('should format relevant code section', () => {
      const output = formatContextPackage(mockContext);

      expect(output).toContain('## Relevant Code');
      expect(output).toContain('### authenticate (function)');
      expect(output).toContain('**File:** `src/auth.ts`');
      expect(output).toContain('**Relevance:** 85%');
      expect(output).toContain('```typescript');
      expect(output).toContain('function authenticate() {}');
    });

    it('should format codebase patterns section', () => {
      const output = formatContextPackage(mockContext);

      expect(output).toContain('## Codebase Patterns');
      expect(output).toContain('**Test naming:** *.test.ts');
      expect(output).toContain('**Test location:** __tests__/');
    });

    it('should format related history section', () => {
      const output = formatContextPackage(mockContext);

      expect(output).toContain('## Related History');
      expect(output).toContain('**PR #10:** Previous auth work (merged)');
    });

    it('should include metadata footer', () => {
      const output = formatContextPackage(mockContext);

      expect(output).toContain('*Context assembled at');
      expect(output).toContain('~500 tokens*');
    });

    it('should handle empty comments gracefully', () => {
      const contextNoComments: ContextPackage = {
        ...mockContext,
        issue: { ...mockContext.issue, comments: [] },
      };

      const output = formatContextPackage(contextNoComments);

      expect(output).not.toContain('## Comments');
    });

    it('should handle empty code results gracefully', () => {
      const contextNoCode: ContextPackage = {
        ...mockContext,
        relevantCode: [],
      };

      const output = formatContextPackage(contextNoCode);

      expect(output).not.toContain('## Relevant Code');
    });

    it('should handle empty patterns gracefully', () => {
      const contextNoPatterns: ContextPackage = {
        ...mockContext,
        codebasePatterns: {},
      };

      const output = formatContextPackage(contextNoPatterns);

      expect(output).not.toContain('## Codebase Patterns');
    });

    it('should handle empty history gracefully', () => {
      const contextNoHistory: ContextPackage = {
        ...mockContext,
        relatedHistory: [],
      };

      const output = formatContextPackage(contextNoHistory);

      expect(output).not.toContain('## Related History');
    });

    it('should handle missing description', () => {
      const contextNoBody: ContextPackage = {
        ...mockContext,
        issue: { ...mockContext.issue, body: '' },
      };

      const output = formatContextPackage(contextNoBody);

      expect(output).toContain('_No description provided_');
    });

    it('should handle issues type in history', () => {
      const contextWithIssue: ContextPackage = {
        ...mockContext,
        relatedHistory: [
          {
            type: 'issue',
            number: 5,
            title: 'Related bug',
            state: 'closed',
            relevanceScore: 0.6,
          },
        ],
      };

      const output = formatContextPackage(contextWithIssue);

      expect(output).toContain('**Issue #5:** Related bug (closed)');
    });

    it('should format related commits', () => {
      const contextWithCommits: ContextPackage = {
        ...mockContext,
        relatedCommits: [
          {
            hash: 'abc123',
            subject: 'feat: add authentication',
            author: 'dev',
            date: '2025-01-15T10:00:00Z',
            filesChanged: ['src/auth.ts', 'src/types.ts'],
            issueRefs: [42],
            relevanceScore: 0.9,
          },
        ],
      };

      const output = formatContextPackage(contextWithCommits);

      expect(output).toContain('## Related Commits');
      expect(output).toContain('`abc123`');
      expect(output).toContain('feat: add authentication');
      expect(output).toContain('dev');
      expect(output).toContain('#42');
      expect(output).toContain('src/auth.ts');
    });

    it('should truncate long file lists in commits', () => {
      const contextWithManyFiles: ContextPackage = {
        ...mockContext,
        relatedCommits: [
          {
            hash: 'def456',
            subject: 'refactor: big change',
            author: 'dev',
            date: '2025-01-15T10:00:00Z',
            filesChanged: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
            issueRefs: [],
            relevanceScore: 0.8,
          },
        ],
      };

      const output = formatContextPackage(contextWithManyFiles);

      expect(output).toContain('+2 more');
    });
  });

  describe('Git History Integration', () => {
    const mockGitIndexer = {
      search: vi.fn().mockResolvedValue([
        {
          shortHash: 'abc123',
          subject: 'feat: add JWT auth',
          author: { name: 'developer', date: new Date('2025-01-15') },
          files: [{ path: 'src/auth.ts' }],
          refs: { issueRefs: [42] },
        },
        {
          shortHash: 'def456',
          subject: 'fix: token validation',
          author: { name: 'developer', date: new Date('2025-01-14') },
          files: [{ path: 'src/auth.ts' }, { path: 'src/utils.ts' }],
          refs: { issueRefs: [] },
        },
      ]),
    };

    it('should include related commits when git indexer is provided', async () => {
      const result = await assembleContext(
        42,
        { indexer: mockIndexer, gitIndexer: mockGitIndexer as any },
        '/repo',
        { includeGitHistory: true }
      );

      expect(result.relatedCommits).toHaveLength(2);
      expect(result.relatedCommits[0].hash).toBe('abc123');
      expect(result.relatedCommits[0].subject).toBe('feat: add JWT auth');
      expect(result.metadata.gitHistorySearchUsed).toBe(true);
    });

    it('should skip git history when includeGitHistory is false', async () => {
      const result = await assembleContext(
        42,
        { indexer: mockIndexer, gitIndexer: mockGitIndexer as any },
        '/repo',
        { includeGitHistory: false }
      );

      expect(result.relatedCommits).toHaveLength(0);
      expect(mockGitIndexer.search).not.toHaveBeenCalled();
    });

    it('should skip git history when git indexer is null', async () => {
      const result = await assembleContext(
        42,
        { indexer: mockIndexer, gitIndexer: null },
        '/repo',
        { includeGitHistory: true }
      );

      expect(result.relatedCommits).toHaveLength(0);
      expect(result.metadata.gitHistorySearchUsed).toBe(false);
    });

    it('should handle git search errors gracefully', async () => {
      const errorGitIndexer = {
        search: vi.fn().mockRejectedValue(new Error('Git search failed')),
      };

      const result = await assembleContext(
        42,
        { indexer: mockIndexer, gitIndexer: errorGitIndexer as any },
        '/repo',
        { includeGitHistory: true }
      );

      expect(result.relatedCommits).toHaveLength(0);
    });
  });
});
