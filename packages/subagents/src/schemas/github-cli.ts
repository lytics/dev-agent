/**
 * Zod schemas for GitHub CLI output validation
 *
 * Following TypeScript Standards Rule #2: No Type Assertions Without Validation
 * External data from `gh` CLI must be validated at runtime
 */

import { z } from 'zod';

/**
 * GitHub user object from gh CLI
 */
const GitHubUserSchema = z.object({
  login: z.string(),
});

/**
 * GitHub label object from gh CLI
 */
const GitHubLabelSchema = z.object({
  name: z.string(),
});

/**
 * GitHub comment from gh CLI
 */
export const GitHubCommentSchema = z.object({
  author: GitHubUserSchema.optional(),
  body: z.string(),
  createdAt: z.string().optional(),
});

/**
 * GitHub issue from gh CLI
 */
export const GitHubIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string().transform((s) => s.toLowerCase() as 'open' | 'closed'),
  labels: z.array(GitHubLabelSchema).default([]),
  assignees: z.array(GitHubUserSchema).default([]),
  author: GitHubUserSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  comments: z.array(GitHubCommentSchema).optional(),
});

export type GitHubIssueData = z.infer<typeof GitHubIssueSchema>;

/**
 * GitHub Pull Request from gh CLI
 */
export const GitHubPullRequestSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string().transform((s) => s.toLowerCase() as 'open' | 'closed' | 'merged'),
  labels: z.array(GitHubLabelSchema).default([]),
  assignees: z.array(GitHubUserSchema).default([]),
  author: GitHubUserSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string().nullable().optional(),
  isDraft: z.boolean().default(false),
});

export type GitHubPullRequestData = z.infer<typeof GitHubPullRequestSchema>;

/**
 * Array of issues/PRs (for bulk fetching)
 */
export const GitHubIssuesArraySchema = z.array(GitHubIssueSchema);
export const GitHubPullRequestsArraySchema = z.array(GitHubPullRequestSchema);
