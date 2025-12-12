/**
 * GitHub CLI Schema Tests
 * Validates external data from gh CLI commands
 */

import { describe, expect, it } from 'vitest';
import {
  GitHubCommentSchema,
  GitHubIssueSchema,
  GitHubIssuesArraySchema,
  GitHubPullRequestSchema,
  GitHubPullRequestsArraySchema,
} from '../github-cli.js';

describe('GitHubCommentSchema', () => {
  it('should validate valid comment', () => {
    const input = {
      author: { login: 'octocat' },
      body: 'Great work!',
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GitHubCommentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author?.login).toBe('octocat');
      expect(result.data.body).toBe('Great work!');
    }
  });

  it('should allow missing optional fields', () => {
    const input = { body: 'Comment without author' };

    const result = GitHubCommentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author).toBeUndefined();
    }
  });

  it('should reject invalid comment', () => {
    const input = { author: 'not-an-object', body: 123 };

    const result = GitHubCommentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('GitHubIssueSchema', () => {
  it('should validate valid issue', () => {
    const input = {
      number: 42,
      title: 'Add new feature',
      body: 'Description here',
      state: 'OPEN',
      labels: [{ name: 'bug' }, { name: 'enhancement' }],
      assignees: [{ login: 'dev1' }],
      author: { login: 'octocat' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    };

    const result = GitHubIssueSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.number).toBe(42);
      expect(result.data.state).toBe('open'); // Transformed to lowercase
      expect(result.data.labels).toHaveLength(2);
    }
  });

  it('should handle null body', () => {
    const input = {
      number: 1,
      title: 'Issue without body',
      body: null,
      state: 'open',
      labels: [],
      assignees: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = GitHubIssueSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toBeNull();
    }
  });

  it('should default empty arrays', () => {
    const input = {
      number: 1,
      title: 'Minimal issue',
      body: '',
      state: 'closed',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = GitHubIssueSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.labels).toEqual([]);
      expect(result.data.assignees).toEqual([]);
    }
  });

  it('should include comments if provided', () => {
    const input = {
      number: 1,
      title: 'Issue with comments',
      body: '',
      state: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      comments: [
        { author: { login: 'user1' }, body: 'First comment' },
        { body: 'Anonymous comment' },
      ],
    };

    const result = GitHubIssueSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comments).toHaveLength(2);
      expect(result.data.comments?.[0].author?.login).toBe('user1');
    }
  });

  it('should reject invalid issue number', () => {
    const input = {
      number: -1,
      title: 'Invalid issue',
      body: '',
      state: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = GitHubIssueSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const input = {
      number: 1,
      title: 'Incomplete issue',
      // Missing body, state, createdAt, updatedAt
    };

    const result = GitHubIssueSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('GitHubPullRequestSchema', () => {
  it('should validate valid PR', () => {
    const input = {
      number: 10,
      title: 'Fix bug',
      body: 'Fixes #42',
      state: 'MERGED',
      labels: [{ name: 'bugfix' }],
      assignees: [],
      author: { login: 'contributor' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      mergedAt: '2024-01-15T00:00:00Z',
      isDraft: false,
    };

    const result = GitHubPullRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.number).toBe(10);
      expect(result.data.state).toBe('merged'); // Transformed to lowercase
      expect(result.data.mergedAt).toBeDefined();
      expect(result.data.isDraft).toBe(false);
    }
  });

  it('should handle draft PR without mergedAt', () => {
    const input = {
      number: 20,
      title: 'WIP: New feature',
      body: null,
      state: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isDraft: true,
    };

    const result = GitHubPullRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDraft).toBe(true);
      expect(result.data.mergedAt).toBeUndefined();
    }
  });

  it('should default isDraft to false', () => {
    const input = {
      number: 30,
      title: 'Regular PR',
      body: '',
      state: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = GitHubPullRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDraft).toBe(false);
    }
  });
});

describe('Array Schemas', () => {
  it('should validate array of issues', () => {
    const input = [
      {
        number: 1,
        title: 'First issue',
        body: '',
        state: 'open',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        number: 2,
        title: 'Second issue',
        body: null,
        state: 'closed',
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ];

    const result = GitHubIssuesArraySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('should validate array of PRs', () => {
    const input = [
      {
        number: 10,
        title: 'PR 1',
        body: '',
        state: 'open',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const result = GitHubPullRequestsArraySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });

  it('should reject array with invalid items', () => {
    const input = [
      { number: 'not-a-number', title: 'Invalid' }, // Invalid
    ];

    const result = GitHubIssuesArraySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept empty array', () => {
    const result = GitHubIssuesArraySchema.safeParse([]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });
});

describe('Real GitHub CLI Output', () => {
  it('should validate actual gh issue view output', () => {
    // Real example from gh CLI
    const ghOutput = {
      assignees: [{ login: 'octocat' }],
      author: { login: 'contributor' },
      body: '## Description\n\nThis is a bug report.',
      createdAt: '2024-01-01T12:00:00Z',
      labels: [{ name: 'bug' }, { name: 'high-priority' }],
      number: 42,
      state: 'OPEN',
      title: 'Fix critical bug',
      updatedAt: '2024-01-15T14:30:00Z',
    };

    const result = GitHubIssueSchema.safeParse(ghOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.number).toBe(42);
      expect(result.data.state).toBe('open');
      expect(result.data.labels[0].name).toBe('bug');
    }
  });
});
