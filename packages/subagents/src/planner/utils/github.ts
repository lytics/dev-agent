/**
 * GitHub CLI Utilities
 * Pure functions for interacting with GitHub issues via gh CLI
 */

import { execSync } from 'node:child_process';
import type { GitHubIssue } from '../types';

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
 * @throws Error if gh CLI fails or issue not found
 */
export async function fetchGitHubIssue(issueNumber: number): Promise<GitHubIssue> {
  if (!isGhInstalled()) {
    throw new Error('GitHub CLI (gh) not installed');
  }

  try {
    const output = execSync(
      `gh issue view ${issueNumber} --json number,title,body,state,labels,assignees,createdAt,updatedAt`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    const data = JSON.parse(output);

    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state.toLowerCase() as 'open' | 'closed',
      labels: data.labels?.map((l: { name: string }) => l.name) || [],
      assignees: data.assignees?.map((a: { login: string }) => a.login) || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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
