/**
 * Compact Formatter
 * Token-efficient formatter that returns summaries only
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import type { FormattedResult, FormatterOptions, ResultFormatter } from './types';
import { estimateTokensForText } from './utils';

/**
 * Compact formatter - optimized for token efficiency
 * Returns: path, type, name, score
 */
export class CompactFormatter implements ResultFormatter {
  private options: Required<FormatterOptions>;

  constructor(options: FormatterOptions = {}) {
    this.options = {
      maxResults: options.maxResults ?? 10,
      includePaths: options.includePaths ?? true,
      includeLineNumbers: options.includeLineNumbers ?? true,
      includeTypes: options.includeTypes ?? true,
      includeSignatures: options.includeSignatures ?? false, // Compact mode excludes signatures
      tokenBudget: options.tokenBudget ?? 1000,
    };
  }

  formatResult(result: SearchResult): string {
    const parts: string[] = [];

    // Score (2 decimals)
    parts.push(`[${(result.score * 100).toFixed(0)}%]`);

    // Type
    if (this.options.includeTypes && typeof result.metadata.type === 'string') {
      parts.push(`${result.metadata.type}:`);
    }

    // Name
    if (typeof result.metadata.name === 'string') {
      parts.push(result.metadata.name);
    }

    // Path
    if (this.options.includePaths && typeof result.metadata.path === 'string') {
      const pathPart =
        this.options.includeLineNumbers && typeof result.metadata.startLine === 'number'
          ? `(${result.metadata.path}:${result.metadata.startLine})`
          : `(${result.metadata.path})`;
      parts.push(pathPart);
    }

    return parts.join(' ');
  }

  formatResults(results: SearchResult[]): FormattedResult {
    // Respect max results
    const limitedResults = results.slice(0, this.options.maxResults);

    // Format each result
    const formatted = limitedResults.map((result, index) => {
      return `${index + 1}. ${this.formatResult(result)}`;
    });

    // Calculate total tokens
    const content = formatted.join('\n');
    const tokenEstimate = estimateTokensForText(content);

    return {
      content,
      tokenEstimate,
    };
  }

  estimateTokens(result: SearchResult): number {
    return estimateTokensForText(this.formatResult(result));
  }
}
