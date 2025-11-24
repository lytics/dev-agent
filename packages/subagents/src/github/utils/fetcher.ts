/**
 * GitHub CLI Fetcher Utilities
 * Pure functions for fetching GitHub data via gh CLI
 */

import { execSync } from 'node:child_process';
import type {
  GitHubAPIResponse,
  GitHubDocument,
  GitHubDocumentType,
  GitHubIndexOptions,
  GitHubState,
} from '../types';

/**
 * Check if gh CLI is installed
 */
export function isGhInstalled(): boolean {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if gh CLI is authenticated
 */
export function isGhAuthenticated(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current repository in owner/repo format
 */
export function getCurrentRepository(): string {
  try {
    const output = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim();
  } catch {
    throw new Error('Not a GitHub repository or gh CLI not configured');
  }
}

/**
 * Fetch issues from GitHub
 */
export function fetchIssues(options: GitHubIndexOptions = {}): GitHubAPIResponse[] {
  const repo = options.repository || getCurrentRepository();

  // Build gh CLI command
  let command = `gh issue list --repo ${repo} --limit ${options.limit || 1000} --json number,title,body,state,labels,author,createdAt,updatedAt,closedAt,url,comments`;

  // Add state filter
  if (options.state && options.state.length > 0) {
    const states = options.state.filter((s) => s !== 'merged'); // merged doesn't apply to issues
    if (states.length > 0) {
      command += ` --state ${states.join(',')}`;
    }
  } else {
    command += ' --state all';
  }

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to fetch issues: ${(error as Error).message}`);
  }
}

/**
 * Fetch pull requests from GitHub
 */
export function fetchPullRequests(options: GitHubIndexOptions = {}): GitHubAPIResponse[] {
  const repo = options.repository || getCurrentRepository();

  // Build gh CLI command
  let command = `gh pr list --repo ${repo} --limit ${options.limit || 1000} --json number,title,body,state,labels,author,createdAt,updatedAt,closedAt,mergedAt,url,comments,headRefName,baseRefName`;

  // Add state filter
  if (options.state && options.state.length > 0) {
    const states = options.state
      .map((s) => {
        if (s === 'open') return 'open';
        if (s === 'closed') return 'closed';
        if (s === 'merged') return 'merged';
        return s;
      })
      .filter(Boolean);

    if (states.length > 0) {
      command += ` --state ${states.join(',')}`;
    }
  } else {
    command += ' --state all';
  }

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to fetch pull requests: ${(error as Error).message}`);
  }
}

/**
 * Fetch a single issue by number
 */
export function fetchIssue(issueNumber: number, repository?: string): GitHubAPIResponse {
  const repo = repository || getCurrentRepository();

  try {
    const output = execSync(
      `gh issue view ${issueNumber} --repo ${repo} --json number,title,body,state,labels,author,createdAt,updatedAt,closedAt,url,comments`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    return JSON.parse(output);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Error(`Issue #${issueNumber} not found`);
    }
    throw new Error(`Failed to fetch issue: ${(error as Error).message}`);
  }
}

/**
 * Fetch a single pull request by number
 */
export function fetchPullRequest(prNumber: number, repository?: string): GitHubAPIResponse {
  const repo = repository || getCurrentRepository();

  try {
    const output = execSync(
      `gh pr view ${prNumber} --repo ${repo} --json number,title,body,state,labels,author,createdAt,updatedAt,closedAt,mergedAt,url,comments,headRefName,baseRefName`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    return JSON.parse(output);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Error(`Pull request #${prNumber} not found`);
    }
    throw new Error(`Failed to fetch pull request: ${(error as Error).message}`);
  }
}

/**
 * Convert GitHub API response to GitHubDocument
 */
export function apiResponseToDocument(
  response: GitHubAPIResponse,
  type: GitHubDocumentType,
  repository: string
): GitHubDocument {
  // Normalize state
  let state: GitHubState;
  if (type === 'pull_request' && response.mergedAt) {
    state = 'merged';
  } else {
    state = response.state.toLowerCase() as GitHubState;
  }

  const document: GitHubDocument = {
    type,
    number: response.number,
    title: response.title,
    body: response.body || '',
    state,
    labels: response.labels?.map((l) => l.name) || [],
    author: response.author?.login || 'unknown',
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    closedAt: response.closedAt,
    url: response.url,
    repository,
    comments: response.comments || 0,
    reactions: response.reactions || {},
    relatedIssues: [],
    relatedPRs: [],
    linkedFiles: [],
    mentions: [],
  };

  // Add PR-specific fields
  if (type === 'pull_request') {
    document.mergedAt = response.mergedAt;
    document.headBranch = response.headRefName;
    document.baseBranch = response.baseRefName;
  }

  return document;
}

/**
 * Fetch all documents based on options
 */
export function fetchAllDocuments(options: GitHubIndexOptions = {}): GitHubDocument[] {
  const repository = options.repository || getCurrentRepository();
  const types = options.types || ['issue', 'pull_request'];
  const documents: GitHubDocument[] = [];

  // Fetch issues
  if (types.includes('issue')) {
    const issues = fetchIssues(options);
    documents.push(...issues.map((issue) => apiResponseToDocument(issue, 'issue', repository)));
  }

  // Fetch pull requests
  if (types.includes('pull_request')) {
    const prs = fetchPullRequests(options);
    documents.push(...prs.map((pr) => apiResponseToDocument(pr, 'pull_request', repository)));
  }

  return documents;
}
