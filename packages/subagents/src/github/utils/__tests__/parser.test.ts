/**
 * Parser Utilities Tests
 * Tests for GitHub document parsing and relationship extraction
 */

import { describe, expect, it } from 'vitest';
import type { GitHubDocument } from '../../types';
import {
  calculateRelevance,
  enrichDocument,
  extractFilePaths,
  extractGitHubReferences,
  extractIssueReferences,
  extractKeywords,
  extractMentions,
  extractUrls,
  matchesQuery,
} from '../parser';

describe('extractIssueReferences', () => {
  it('should extract #123 format', () => {
    const text = 'Fix #123 and #456';
    expect(extractIssueReferences(text)).toEqual([123, 456]);
  });

  it('should extract GH-123 format', () => {
    const text = 'See GH-789 and GH-101';
    expect(extractIssueReferences(text)).toEqual([101, 789]); // Sorted ascending
  });

  it('should extract mixed formats', () => {
    const text = 'Relates to #123, GH-456, and issue #789';
    expect(extractIssueReferences(text)).toEqual([123, 456, 789]);
  });

  it('should deduplicate references', () => {
    const text = '#123 and #123 again';
    expect(extractIssueReferences(text)).toEqual([123]);
  });

  it('should ignore invalid references', () => {
    const text = '#abc #0 #-1';
    expect(extractIssueReferences(text)).toEqual([]);
  });

  it('should handle empty text', () => {
    expect(extractIssueReferences('')).toEqual([]);
  });

  it('should not match partial numbers', () => {
    const text = 'version 1.2.3 and port 8080';
    expect(extractIssueReferences(text)).toEqual([]);
  });
});

describe('extractFilePaths', () => {
  it('should extract simple file paths', () => {
    const text = 'Updated src/index.ts';
    expect(extractFilePaths(text)).toEqual(['src/index.ts']);
  });

  it('should extract paths with special characters', () => {
    const text = 'Changed packages/core-api/src/utils.ts';
    expect(extractFilePaths(text)).toEqual(['packages/core-api/src/utils.ts']);
  });

  it('should extract multiple paths', () => {
    const text = 'Modified src/a.ts and lib/b.js';
    expect(extractFilePaths(text)).toContain('src/a.ts');
    expect(extractFilePaths(text)).toContain('lib/b.js');
  });

  it('should extract paths in code blocks', () => {
    const text = '`src/components/Button.tsx`';
    expect(extractFilePaths(text)).toEqual(['src/components/Button.tsx']);
  });

  it('should deduplicate paths', () => {
    const text = 'src/index.ts and src/index.ts again';
    expect(extractFilePaths(text)).toEqual(['src/index.ts']);
  });

  it('should handle common extensions', () => {
    const text = 'src/test.js lib/test.ts app/test.tsx';
    const paths = extractFilePaths(text);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths).toContain('src/test.js');
  });

  it('should handle empty text', () => {
    expect(extractFilePaths('')).toEqual([]);
  });
});

describe('extractMentions', () => {
  it('should extract @username mentions', () => {
    const text = 'Thanks @alice and @bob';
    expect(extractMentions(text)).toEqual(['alice', 'bob']);
  });

  it('should handle mentions with hyphens', () => {
    const text = 'cc @john-doe';
    expect(extractMentions(text)).toEqual(['john-doe']);
  });

  it('should deduplicate mentions', () => {
    const text = '@alice and @alice again';
    expect(extractMentions(text)).toEqual(['alice']);
  });

  it('should handle empty text', () => {
    expect(extractMentions('')).toEqual([]);
  });

  it('should not match email addresses', () => {
    const text = 'Email: test@example.com';
    expect(extractMentions(text)).toEqual([]);
  });
});

describe('extractUrls', () => {
  it('should extract http URLs', () => {
    const text = 'See http://example.com';
    expect(extractUrls(text)).toEqual(['http://example.com']);
  });

  it('should extract https URLs', () => {
    const text = 'Visit https://github.com/user/repo';
    expect(extractUrls(text)).toEqual(['https://github.com/user/repo']);
  });

  it('should extract multiple URLs', () => {
    const text = 'http://a.com and https://b.com';
    expect(extractUrls(text)).toHaveLength(2);
  });

  it('should deduplicate URLs', () => {
    const text = 'https://example.com and https://example.com';
    expect(extractUrls(text)).toEqual(['https://example.com']);
  });

  it('should handle empty text', () => {
    expect(extractUrls('')).toEqual([]);
  });
});

describe('extractGitHubReferences', () => {
  it('should extract issue URLs', () => {
    const url = 'https://github.com/owner/repo/issues/123';
    const refs = extractGitHubReferences([url]);
    expect(refs.issues).toEqual([123]);
    expect(refs.pullRequests).toEqual([]);
  });

  it('should extract PR URLs', () => {
    const url = 'https://github.com/owner/repo/pull/456';
    const refs = extractGitHubReferences([url]);
    expect(refs.issues).toEqual([]);
    expect(refs.pullRequests).toEqual([456]);
  });

  it('should extract mixed URLs', () => {
    const urls = [
      'https://github.com/owner/repo/issues/123',
      'https://github.com/owner/repo/pull/456',
    ];
    const refs = extractGitHubReferences(urls);
    expect(refs.issues).toEqual([123]);
    expect(refs.pullRequests).toEqual([456]);
  });

  it('should ignore non-GitHub URLs', () => {
    const urls = ['https://example.com', 'http://google.com'];
    const refs = extractGitHubReferences(urls);
    expect(refs.issues).toEqual([]);
    expect(refs.pullRequests).toEqual([]);
  });

  it('should handle empty array', () => {
    const refs = extractGitHubReferences([]);
    expect(refs.issues).toEqual([]);
    expect(refs.pullRequests).toEqual([]);
  });
});

describe('enrichDocument', () => {
  it('should extract all relationships', () => {
    const doc: GitHubDocument = {
      type: 'issue',
      number: 1,
      title: 'Test Issue',
      body: 'Fixes #123 in src/index.ts cc @alice https://github.com/owner/repo/pull/456',
      state: 'open',
      labels: [],
      author: 'bob',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      url: 'https://github.com/owner/repo/issues/1',
      repository: 'owner/repo',
      comments: 0,
      reactions: {},
      relatedIssues: [],
      relatedPRs: [],
      linkedFiles: [],
      mentions: [],
    };

    const enriched = enrichDocument(doc);
    expect(enriched.relatedIssues).toContain(123);
    expect(enriched.relatedPRs).toContain(456);
    expect(enriched.linkedFiles).toContain('src/index.ts');
    expect(enriched.mentions).toContain('alice');
  });

  it('should not duplicate existing relationships', () => {
    const doc: GitHubDocument = {
      type: 'issue',
      number: 1,
      title: 'Test',
      body: 'Fixes #123',
      state: 'open',
      labels: [],
      author: 'alice',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      url: 'https://github.com/owner/repo/issues/1',
      repository: 'owner/repo',
      comments: 0,
      reactions: {},
      relatedIssues: [123],
      relatedPRs: [],
      linkedFiles: [],
      mentions: [],
    };

    const enriched = enrichDocument(doc);
    expect(enriched.relatedIssues).toEqual([123]);
  });

  it('should handle document without body', () => {
    const doc: GitHubDocument = {
      type: 'issue',
      number: 1,
      title: 'Test #123',
      body: '',
      state: 'open',
      labels: [],
      author: 'alice',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      url: 'https://github.com/owner/repo/issues/1',
      repository: 'owner/repo',
      comments: 0,
      reactions: {},
      relatedIssues: [],
      relatedPRs: [],
      linkedFiles: [],
      mentions: [],
    };

    const enriched = enrichDocument(doc);
    expect(enriched.relatedIssues).toContain(123); // From title
  });
});

describe('matchesQuery', () => {
  const doc: GitHubDocument = {
    type: 'issue',
    number: 123,
    title: 'Add authentication feature',
    body: 'Implement JWT authentication using bcrypt',
    state: 'open',
    labels: ['enhancement', 'security'],
    author: 'alice',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    url: 'https://github.com/owner/repo/issues/123',
    repository: 'owner/repo',
    comments: 5,
    reactions: {},
    relatedIssues: [],
    relatedPRs: [],
    linkedFiles: [],
    mentions: [],
  };

  it('should match title (case insensitive)', () => {
    expect(matchesQuery(doc, 'authentication')).toBe(true);
    expect(matchesQuery(doc, 'AUTHENTICATION')).toBe(true);
  });

  it('should match body', () => {
    expect(matchesQuery(doc, 'JWT')).toBe(true);
    expect(matchesQuery(doc, 'bcrypt')).toBe(true);
  });

  it('should match labels', () => {
    expect(matchesQuery(doc, 'enhancement')).toBe(true);
    expect(matchesQuery(doc, 'security')).toBe(true);
  });

  it('should match number', () => {
    expect(matchesQuery(doc, '123')).toBe(true);
    expect(matchesQuery(doc, '#123')).toBe(true);
  });

  it('should not match unrelated terms', () => {
    expect(matchesQuery(doc, 'unrelated')).toBe(false);
  });

  it('should handle empty query', () => {
    expect(matchesQuery(doc, '')).toBe(true);
  });
});

describe('calculateRelevance', () => {
  const doc: GitHubDocument = {
    type: 'issue',
    number: 123,
    title: 'Add authentication feature',
    body: 'Implement JWT authentication using bcrypt for secure user authentication',
    state: 'open',
    labels: ['enhancement'],
    author: 'alice',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    url: 'https://github.com/owner/repo/issues/123',
    repository: 'owner/repo',
    comments: 5,
    reactions: {},
    relatedIssues: [],
    relatedPRs: [],
    linkedFiles: [],
    mentions: [],
  };

  it('should score title matches highest', () => {
    const score = calculateRelevance(doc, 'authentication');
    expect(score).toBeGreaterThan(25); // Title match + body occurrences
  });

  it('should score body matches lower than title', () => {
    const titleScore = calculateRelevance(doc, 'Add');
    const bodyScore = calculateRelevance(doc, 'bcrypt');
    expect(titleScore).toBeGreaterThan(bodyScore);
  });

  it('should score multiple matches higher', () => {
    const singleMatch = calculateRelevance(doc, 'JWT');
    const multiMatch = calculateRelevance(doc, 'authentication'); // appears 3 times
    expect(multiMatch).toBeGreaterThan(singleMatch);
  });

  it('should return 0 for no matches', () => {
    expect(calculateRelevance(doc, 'unrelated')).toBe(0);
  });

  it('should be case insensitive', () => {
    const lower = calculateRelevance(doc, 'authentication');
    const upper = calculateRelevance(doc, 'AUTHENTICATION');
    expect(lower).toBe(upper);
  });
});

describe('extractKeywords', () => {
  it('should extract common words', () => {
    const text = 'Fix authentication bug. The authentication system has a critical bug';
    const keywords = extractKeywords(text);
    expect(keywords).toContain('authentication');
    expect(keywords).toContain('bug');
  });

  it('should convert to lowercase', () => {
    const text = 'URGENT BUG. Critical ISSUE';
    const keywords = extractKeywords(text);
    expect(keywords).toContain('urgent');
    expect(keywords).toContain('critical');
    expect(keywords).not.toContain('URGENT');
  });

  it('should filter short words', () => {
    const text = 'A big bug in UI. We have an issue';
    const keywords = extractKeywords(text);
    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('in');
    expect(keywords).not.toContain('an');
    expect(keywords).toContain('issue');
  });

  it('should deduplicate keywords', () => {
    const text = 'Bug fix for bug. This bug is critical bug';
    const keywords = extractKeywords(text);
    const bugCount = keywords.filter((k) => k === 'bug').length;
    expect(bugCount).toBe(1);
  });
});
