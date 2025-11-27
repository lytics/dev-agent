/**
 * GitHub CLI Utilities
 * Pure functions for interacting with GitHub issues via gh CLI
 */

import { execSync } from 'node:child_process';
import type { GitHubComment, GitHubIssue } from '../types';

/**
 * Options for fetching GitHub issues
 */
export interface FetchIssueOptions {
  /** Include issue comments (default: false) */
  includeComments?: boolean;
}

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
 * Fetch GitHub issue using gh CLI
 * @param issueNumber - GitHub issue number
 * @param repositoryPath - Optional path to repository (defaults to current directory)
 * @param options - Fetch options
 * @throws Error if gh CLI fails or issue not found
 */
export async function fetchGitHubIssue(
  issueNumber: number,
  repositoryPath?: string,
  options: FetchIssueOptions = {}
): Promise<GitHubIssue> {
  if (!isGhInstalled()) {
    throw new Error('GitHub CLI (gh) not installed');
  }

  try {
    // Build fields list
    const fields = [
      'number',
      'title',
      'body',
      'state',
      'labels',
      'assignees',
      'author',
      'createdAt',
      'updatedAt',
    ];
    if (options.includeComments) {
      fields.push('comments');
    }

    const output = execSync(`gh issue view ${issueNumber} --json ${fields.join(',')}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: repositoryPath, // Run in the repository directory
    });

    const data = JSON.parse(output);

    // Parse comments if included
    let comments: GitHubComment[] | undefined;
    if (options.includeComments && data.comments) {
      comments = data.comments.map(
        (c: { author?: { login: string }; body: string; createdAt?: string }) => ({
          author: c.author?.login,
          body: c.body,
          createdAt: c.createdAt,
        })
      );
    }

    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state.toLowerCase() as 'open' | 'closed',
      labels: data.labels?.map((l: { name: string }) => l.name) || [],
      assignees: data.assignees?.map((a: { login: string }) => a.login) || [],
      author: data.author?.login,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      comments,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Error(`Issue #${issueNumber} not found`);
    }
    throw new Error(`Failed to fetch issue: ${(error as Error).message}`);
  }
}

/**
 * Check if current directory is a GitHub repository
 */
export function isGitHubRepo(): boolean {
  try {
    execSync('git remote get-url origin', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
