/**
 * GitHub Utilities
 * Barrel export for all GitHub utility functions
 */

// Fetcher utilities
export {
  apiResponseToDocument,
  fetchAllDocuments,
  fetchIssue,
  fetchIssues,
  fetchPullRequest,
  fetchPullRequests,
  getCurrentRepository,
  isGhAuthenticated,
  isGhInstalled,
} from './fetcher';

// Parser utilities
export {
  calculateRelevance,
  enrichDocument,
  extractFilePaths,
  extractGitHubReferences,
  extractIssueReferences,
  extractKeywords,
  extractMentions,
  extractUrls,
  matchesQuery,
} from './parser';
