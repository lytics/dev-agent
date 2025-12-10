/**
 * GitHub Context Subagent Types
 * Type definitions for GitHub data indexing and context provision
 */

import type { Logger } from '@lytics/kero';

/**
 * Type of GitHub document
 */
export type GitHubDocumentType = 'issue' | 'pull_request' | 'discussion';

/**
 * GitHub document status
 */
export type GitHubState = 'open' | 'closed' | 'merged';

/**
 * GitHub document that can be indexed
 */
export interface GitHubDocument {
  type: GitHubDocumentType;
  number: number;
  title: string;
  body: string;
  state: GitHubState;
  labels: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  url: string;
  repository: string; // owner/repo format

  // For PRs only
  mergedAt?: string;
  headBranch?: string;
  baseBranch?: string;

  // Metadata
  comments: number;
  reactions: Record<string, number>;

  // Relationships (extracted from text)
  relatedIssues: number[];
  relatedPRs: number[];
  linkedFiles: string[];
  mentions: string[];
}

/**
 * GitHub search options
 */
export interface GitHubSearchOptions {
  type?: GitHubDocumentType;
  state?: GitHubState;
  labels?: string[];
  author?: string;
  limit?: number;
  scoreThreshold?: number;
  since?: string; // ISO date
  until?: string; // ISO date
}

/**
 * GitHub search result
 */
export interface GitHubSearchResult {
  document: GitHubDocument;
  score: number;
  matchedFields: string[]; // Which fields matched the query
}

/**
 * GitHub context for an issue/PR
 */
export interface GitHubContext {
  document: GitHubDocument;
  relatedIssues: GitHubDocument[];
  relatedPRs: GitHubDocument[];
  linkedCodeFiles: Array<{
    path: string;
    reason: string;
    score: number;
  }>;
  discussionSummary?: string;
}

/**
 * GitHub indexer configuration
 */
export interface GitHubIndexerConfig {
  vectorStorePath: string; // Path to LanceDB vector storage
  statePath?: string; // Path to state file (default: .dev-agent/github-state.json)
  autoUpdate?: boolean; // Enable auto-updates (default: true)
  staleThreshold?: number; // Stale threshold in ms (default: 15 minutes)
}

/**
 * GitHub indexer state (persisted to disk)
 */
export interface GitHubIndexerState {
  version: string; // State format version
  repository: string;
  lastIndexed: string; // ISO date
  totalDocuments: number;
  byType: Record<GitHubDocumentType, number>;
  byState: Record<GitHubState, number>;
}

/**
 * Progress information for GitHub indexing
 */
export interface GitHubIndexProgress {
  phase: 'fetching' | 'enriching' | 'embedding' | 'complete';
  documentsProcessed: number;
  totalDocuments: number;
  percentComplete: number;
}

/**
 * GitHub indexing options
 */
export interface GitHubIndexOptions {
  repository?: string; // If not provided, use current repo
  types?: GitHubDocumentType[];
  state?: GitHubState[];
  since?: string; // ISO date - only index items updated after this
  limit?: number; // Max items to fetch (for testing)
  /** Progress callback */
  onProgress?: (progress: GitHubIndexProgress) => void;
  /** Logger instance */
  logger?: Logger;
}

/**
 * GitHub indexing stats
 */
export interface GitHubIndexStats {
  repository: string;
  totalDocuments: number;
  byType: Record<GitHubDocumentType, number>;
  byState: Record<GitHubState, number>;
  lastIndexed: string; // ISO date
  indexDuration: number; // milliseconds
}

/**
 * GitHub fetcher response from gh CLI
 */
export interface GitHubAPIResponse {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string }>;
  author: { login: string };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  url: string;
  comments: number;
  reactions?: Record<string, number>;

  // PR-specific
  mergedAt?: string;
  headRefName?: string;
  baseRefName?: string;
}

/**
 * GitHub Context request (for agent communication)
 */
export interface GitHubContextRequest {
  action: 'index' | 'search' | 'context' | 'related';

  // For index action
  indexOptions?: GitHubIndexOptions;

  // For search action
  query?: string;
  searchOptions?: GitHubSearchOptions;

  // For context/related actions
  issueNumber?: number;
  prNumber?: number;

  // Include code context from Explorer
  includeCodeContext?: boolean;
}

/**
 * GitHub Context result (for agent communication)
 */
export interface GitHubContextResult {
  action: 'index' | 'search' | 'context' | 'related';

  // For index action
  stats?: GitHubIndexStats;

  // For search action
  results?: GitHubSearchResult[];

  // For context action
  context?: GitHubContext;

  // For related action
  related?: GitHubDocument[];
}

/**
 * GitHub Context error
 */
export interface GitHubContextError {
  action: 'index' | 'search' | 'context' | 'related';
  error: string;
  code?: 'NOT_FOUND' | 'INVALID_REPO' | 'GH_CLI_ERROR' | 'NO_AUTH' | 'RATE_LIMIT';
  details?: string;
}
