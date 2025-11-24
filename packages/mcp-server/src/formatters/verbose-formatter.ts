/**
 * Verbose Formatter
 * Full-detail formatter that includes signatures and metadata
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import type { FormattedResult, FormatterOptions, ResultFormatter } from './types';
import { estimateTokensForText } from './utils';

/**
 * Verbose formatter - includes all available information
 * Returns: path, type, name, signature, metadata, score
 */
export class VerboseFormatter implements ResultFormatter {
  private options: Required<FormatterOptions>;

  constructor(options: FormatterOptions = {}) {
    this.options = {
      maxResults: options.maxResults ?? 10,
      includePaths: options.includePaths ?? true,
      includeLineNumbers: options.includeLineNumbers ?? true,
      includeTypes: options.includeTypes ?? true,
      includeSignatures: options.includeSignatures ?? true, // Verbose mode includes signatures
      tokenBudget: options.tokenBudget ?? 5000,
    };
  }

  formatResult(result: SearchResult): string {
    const lines: string[] = [];

    // Header: score + type + name
    const header: string[] = [];
    header.push(`[Score: ${(result.score * 100).toFixed(1)}%]`);

    if (this.options.includeTypes && typeof result.metadata.type === 'string') {
      header.push(`${result.metadata.type}:`);
    }

    if (typeof result.metadata.name === 'string') {
      header.push(result.metadata.name);
    }

    lines.push(header.join(' '));

    // Path with line numbers
    if (this.options.includePaths && typeof result.metadata.path === 'string') {
      const location =
        this.options.includeLineNumbers && typeof result.metadata.startLine === 'number'
          ? `${result.metadata.path}:${result.metadata.startLine}`
          : result.metadata.path;
      lines.push(`  Location: ${location}`);
    }

    // Signature (if available and enabled)
    if (this.options.includeSignatures && typeof result.metadata.signature === 'string') {
      lines.push(`  Signature: ${result.metadata.signature}`);
    }

    // Additional metadata
    const metadata: string[] = [];

    if (typeof result.metadata.language === 'string') {
      metadata.push(`language: ${result.metadata.language}`);
    }

    if (result.metadata.exported !== undefined) {
      metadata.push(`exported: ${result.metadata.exported}`);
    }

    if (
      typeof result.metadata.endLine === 'number' &&
      typeof result.metadata.startLine === 'number' &&
      this.options.includeLineNumbers
    ) {
      const lineCount = result.metadata.endLine - result.metadata.startLine + 1;
      metadata.push(`lines: ${lineCount}`);
    }

    if (metadata.length > 0) {
      lines.push(`  Metadata: ${metadata.join(', ')}`);
    }

    return lines.join('\n');
  }

  formatResults(results: SearchResult[]): FormattedResult {
    // Handle empty results
    if (results.length === 0) {
      const content = 'No results found';
      return {
        content,
        tokenEstimate: estimateTokensForText(content),
      };
    }

    // Respect max results
    const limitedResults = results.slice(0, this.options.maxResults);

    // Format each result with separator
    const formatted = limitedResults.map((result, index) => {
      return `${index + 1}. ${this.formatResult(result)}`;
    });

    // Calculate total tokens
    const content = formatted.join('\n\n'); // Double newline for separation
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
