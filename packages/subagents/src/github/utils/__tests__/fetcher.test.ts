/**
 * Tests for GitHub CLI fetcher utilities
 * Tests default limits, custom limits, error handling, and buffer management
 */

import { execSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchIssues,
  fetchPullRequests,
  getCurrentRepository,
  isGhAuthenticated,
  isGhInstalled,
} from '../fetcher';

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('GitHub Fetcher - Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isGhInstalled', () => {
    it('should return true when gh CLI is installed', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('gh version 2.40.0'));

      expect(isGhInstalled()).toBe(true);
      expect(execSync).toHaveBeenCalledWith('gh --version', { stdio: 'pipe' });
    });

    it('should return false when gh CLI is not installed', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command not found');
      });

      expect(isGhInstalled()).toBe(false);
    });
  });

  describe('isGhAuthenticated', () => {
    it('should return true when authenticated', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('Logged in'));

      expect(isGhAuthenticated()).toBe(true);
      expect(execSync).toHaveBeenCalledWith('gh auth status', { stdio: 'pipe' });
    });

    it('should return false when not authenticated', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not authenticated');
      });

      expect(isGhAuthenticated()).toBe(false);
    });
  });

  describe('getCurrentRepository', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return repository in owner/repo format', () => {
      vi.mocked(execSync).mockReturnValueOnce('lytics/dev-agent\n' as any);

      const repo = getCurrentRepository();
      expect(repo).toBe('lytics/dev-agent');
      expect(execSync).toHaveBeenCalledWith('gh repo view --json nameWithOwner -q .nameWithOwner', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024,
      });
    });

    it('should throw error when not a GitHub repo', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Not a git repository');
      });

      expect(() => getCurrentRepository()).toThrow(
        'Not a GitHub repository or gh CLI not configured'
      );
    });

    it('should use correct maxBuffer size', () => {
      vi.mocked(execSync).mockReturnValueOnce('lytics/dev-agent\n' as any);

      getCurrentRepository();

      expect(execSync).toHaveBeenCalledWith(expect.any(String), {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
    });
  });
});

describe('GitHub Fetcher - Issue Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getCurrentRepository
    vi.mocked(execSync).mockImplementation((command) => {
      if (command.toString().includes('gh repo view')) {
        return Buffer.from('lytics/dev-agent');
      }
      return Buffer.from('[]');
    });
  });

  describe('fetchIssues - Default Behavior', () => {
    it('should use default limit of 500', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchIssues({ repository: 'lytics/dev-agent' });

      const calls = vi.mocked(execSync).mock.calls;
      const issueCall = calls.find((call) => call[0].toString().includes('gh issue list'));

      expect(issueCall).toBeDefined();
      expect(issueCall?.[0].toString()).toContain('--limit 500');
    });

    it('should use 50MB maxBuffer for issues', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchIssues({ repository: 'lytics/dev-agent' });

      const calls = vi.mocked(execSync).mock.calls;
      const issueCall = calls.find((call) => call[0].toString().includes('gh issue list'));

      expect(issueCall?.[1]).toMatchObject({
        maxBuffer: 50 * 1024 * 1024,
      });
    });

    it('should include all required JSON fields', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchIssues({ repository: 'lytics/dev-agent' });

      const calls = vi.mocked(execSync).mock.calls;
      const issueCall = calls.find((call) => call[0].toString().includes('gh issue list'));
      const command = issueCall?.[0].toString();

      expect(command).toContain('--json number,title,body,state,labels,author');
      expect(command).toContain('createdAt,updatedAt,closedAt,url,comments');
    });
  });

  describe('fetchIssues - Custom Limits', () => {
    it('should respect custom limit option', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchIssues({ repository: 'lytics/dev-agent', limit: 100 });

      const calls = vi.mocked(execSync).mock.calls;
      const issueCall = calls.find((call) => call[0].toString().includes('gh issue list'));

      expect(issueCall?.[0].toString()).toContain('--limit 100');
    });

    it('should allow high limit for power users', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchIssues({ repository: 'lytics/dev-agent', limit: 1000 });

      const calls = vi.mocked(execSync).mock.calls;
      const issueCall = calls.find((call) => call[0].toString().includes('gh issue list'));

      expect(issueCall?.[0].toString()).toContain('--limit 1000');
    });

    it('should allow low limit for large repos', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchIssues({ repository: 'lytics/dev-agent', limit: 50 });

      const calls = vi.mocked(execSync).mock.calls;
      const issueCall = calls.find((call) => call[0].toString().includes('gh issue list'));

      expect(issueCall?.[0].toString()).toContain('--limit 50');
    });
  });

  describe('fetchIssues - Error Handling', () => {
    it('should provide helpful error message on ENOBUFS', () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error('spawnSync /bin/sh ENOBUFS');
        throw error;
      });

      expect(() => fetchIssues({ repository: 'lytics/dev-agent' })).toThrow(
        'Failed to fetch issues: Output too large. Try using --gh-limit with a lower value (e.g., --gh-limit 100)'
      );
    });

    it('should provide helpful error message on maxBuffer exceeded', () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error('stderr maxBuffer exceeded');
        throw error;
      });

      expect(() => fetchIssues({ repository: 'lytics/dev-agent' })).toThrow(
        'Failed to fetch issues: Output too large. Try using --gh-limit with a lower value (e.g., --gh-limit 100)'
      );
    });

    it('should preserve original error for other failures', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Network timeout');
      });

      expect(() => fetchIssues({ repository: 'lytics/dev-agent' })).toThrow(
        'Failed to fetch issues: Network timeout'
      );
    });
  });
});

describe('GitHub Fetcher - Pull Request Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getCurrentRepository
    vi.mocked(execSync).mockImplementation((command) => {
      if (command.toString().includes('gh repo view')) {
        return Buffer.from('lytics/dev-agent');
      }
      return Buffer.from('[]');
    });
  });

  describe('fetchPullRequests - Default Behavior', () => {
    it('should use default limit of 500', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchPullRequests({ repository: 'lytics/dev-agent' });

      const calls = vi.mocked(execSync).mock.calls;
      const prCall = calls.find((call) => call[0].toString().includes('gh pr list'));

      expect(prCall).toBeDefined();
      expect(prCall?.[0].toString()).toContain('--limit 500');
    });

    it('should use 50MB maxBuffer for pull requests', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchPullRequests({ repository: 'lytics/dev-agent' });

      const calls = vi.mocked(execSync).mock.calls;
      const prCall = calls.find((call) => call[0].toString().includes('gh pr list'));

      expect(prCall?.[1]).toMatchObject({
        maxBuffer: 50 * 1024 * 1024,
      });
    });

    it('should include all required JSON fields', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchPullRequests({ repository: 'lytics/dev-agent' });

      const calls = vi.mocked(execSync).mock.calls;
      const prCall = calls.find((call) => call[0].toString().includes('gh pr list'));
      const command = prCall?.[0].toString();

      expect(command).toContain('--json number,title,body,state,labels,author');
      expect(command).toContain('createdAt,updatedAt,closedAt,mergedAt,url,comments');
      expect(command).toContain('headRefName,baseRefName');
    });
  });

  describe('fetchPullRequests - Custom Limits', () => {
    it('should respect custom limit option', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('[]'));

      fetchPullRequests({ repository: 'lytics/dev-agent', limit: 200 });

      const calls = vi.mocked(execSync).mock.calls;
      const prCall = calls.find((call) => call[0].toString().includes('gh pr list'));

      expect(prCall?.[0].toString()).toContain('--limit 200');
    });
  });

  describe('fetchPullRequests - Error Handling', () => {
    it('should provide helpful error message on ENOBUFS', () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error('spawnSync /bin/sh ENOBUFS');
        throw error;
      });

      expect(() => fetchPullRequests({ repository: 'lytics/dev-agent' })).toThrow(
        'Failed to fetch pull requests: Output too large. Try using --gh-limit with a lower value (e.g., --gh-limit 100)'
      );
    });

    it('should provide helpful error message on maxBuffer exceeded', () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error('stderr maxBuffer exceeded');
        throw error;
      });

      expect(() => fetchPullRequests({ repository: 'lytics/dev-agent' })).toThrow(
        'Failed to fetch pull requests: Output too large. Try using --gh-limit with a lower value (e.g., --gh-limit 100)'
      );
    });
  });
});

describe('GitHub Fetcher - Buffer Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use appropriate buffer sizes for different operations', () => {
    // Repository name fetch (small payload)
    vi.mocked(execSync).mockReturnValueOnce('lytics/dev-agent' as any);
    getCurrentRepository();
    expect(vi.mocked(execSync).mock.calls[0][1]).toMatchObject({
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    vi.clearAllMocks();

    // Issue list fetch (large payload)
    vi.mocked(execSync).mockReturnValueOnce('[]' as any);
    fetchIssues({ repository: 'lytics/dev-agent' });
    const issueCalls = vi
      .mocked(execSync)
      .mock.calls.filter((call) => call[0].toString().includes('gh issue list'));
    expect(issueCalls[0][1]).toMatchObject({
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });

    vi.clearAllMocks();

    // PR list fetch (large payload)
    vi.mocked(execSync).mockReturnValueOnce('[]' as any);
    fetchPullRequests({ repository: 'lytics/dev-agent' });
    const prCalls = vi
      .mocked(execSync)
      .mock.calls.filter((call) => call[0].toString().includes('gh pr list'));
    expect(prCalls[0][1]).toMatchObject({
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });
  });
});
