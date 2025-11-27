/**
 * Formatter Types
 * Types for result formatting and token estimation
 */

import type { SearchResult } from '@lytics/dev-agent-core';

/**
 * Format mode for search results
 */
export type FormatMode = 'compact' | 'verbose';

/**
 * Formatted search result
 */
export interface FormattedResult {
  content: string;
  tokens: number;
}

/**
 * Result formatter interface
 */
export interface ResultFormatter {
  /**
   * Format a single search result
   */
  formatResult(result: SearchResult): string;

  /**
   * Format multiple search results
   */
  formatResults(results: SearchResult[]): FormattedResult;

  /**
   * Estimate tokens for a search result
   */
  estimateTokens(result: SearchResult): number;
}

/**
 * Detail level for progressive disclosure
 * - full: snippet + imports + signature
 * - signature: signature only (no snippet)
 * - minimal: name + path only
 */
export type DetailLevel = 'full' | 'signature' | 'minimal';

/**
 * Formatter options
 */
export interface FormatterOptions {
  /**
   * Maximum number of results to include
   */
  maxResults?: number;

  /**
   * Include file paths in output
   */
  includePaths?: boolean;

  /**
   * Include line numbers
   */
  includeLineNumbers?: boolean;

  /**
   * Include type information
   */
  includeTypes?: boolean;

  /**
   * Include signatures
   */
  includeSignatures?: boolean;

  /**
   * Include code snippets in output
   */
  includeSnippets?: boolean;

  /**
   * Include import lists in output
   */
  includeImports?: boolean;

  /**
   * Maximum lines to show in snippets (default: 10 compact, 20 verbose)
   */
  maxSnippetLines?: number;

  /**
   * Token budget (soft limit) - enables progressive disclosure when set
   */
  tokenBudget?: number;

  /**
   * Enable progressive disclosure based on token budget
   * When enabled, top results get full detail, lower results get less
   * (default: true when tokenBudget is set)
   */
  progressiveDisclosure?: boolean;

  /**
   * Number of top results to show with full detail (default: 3)
   */
  fullDetailCount?: number;

  /**
   * Number of results after fullDetailCount to show with signatures (default: 4)
   */
  signatureDetailCount?: number;
}
