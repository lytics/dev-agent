/**
 * GitHub CLI Utilities
 * Pure functions for interacting with GitHub issues via gh CLI
 */

import { execSync } from 'node:child_process';
import { type GitHubIssueData, GitHubIssueSchema } from '../../schemas/github-cli.js';
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

    // Parse and validate GitHub CLI response
    const rawData = JSON.parse(output);
    const parseResult = GitHubIssueSchema.safeParse(rawData);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      const path = firstError.path.length > 0 ? `${firstError.path.join('.')}: ` : '';
      throw new Error(`Invalid GitHub CLI response: ${path}${firstError.message}`);
    }

    const data: GitHubIssueData = parseResult.data;

    // Transform comments if included
    const comments: GitHubComment[] | undefined = data.comments?.map((c) => ({
      author: c.author?.login,
      body: c.body,
      createdAt: c.createdAt,
    }));

    // Transform to internal type
    return {
      number: data.number,
      title: data.title,
      body: data.body ?? '',
      state: data.state,
      labels: data.labels.map((l) => l.name),
      assignees: data.assignees.map((a) => a.login),
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
