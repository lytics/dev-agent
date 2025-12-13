/**
 * GitHub Context Subagent Types
 *
 * Re-exports shared types from @lytics/dev-agent-types for backward compatibility.
 * New code should import directly from @lytics/dev-agent-types/github.
 */

import type {
  GitHubContext,
  GitHubDocument,
  GitHubIndexOptions,
  GitHubIndexStats,
  GitHubSearchOptions,
  GitHubSearchResult,
} from '@lytics/dev-agent-types/github';

export type {
  GitHubAPIResponse,
  GitHubContext,
  GitHubDocument,
  GitHubDocumentType,
  GitHubIndexerConfig,
  GitHubIndexerState,
  GitHubIndexOptions,
  GitHubIndexProgress,
  GitHubIndexStats,
  GitHubSearchOptions,
  GitHubSearchResult,
  GitHubState,
} from '@lytics/dev-agent-types/github';

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
