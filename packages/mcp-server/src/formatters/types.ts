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
   * Token budget (soft limit)
   */
  tokenBudget?: number;
}
