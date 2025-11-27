/**
 * Compact Formatter
 * Token-efficient formatter that returns summaries only
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import type { FormattedResult, FormatterOptions, ResultFormatter } from './types';
import { estimateTokensForText } from './utils';

/** Default max snippet lines for compact mode */
const DEFAULT_MAX_SNIPPET_LINES = 10;
/** Max imports to show before truncating */
const MAX_IMPORTS_DISPLAY = 5;

/**
 * Compact formatter - optimized for token efficiency
 * Returns: path, type, name, score, optional snippet and imports
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
      includeSnippets: options.includeSnippets ?? false, // Off by default for compact
      includeImports: options.includeImports ?? false, // Off by default for compact
      maxSnippetLines: options.maxSnippetLines ?? DEFAULT_MAX_SNIPPET_LINES,
      tokenBudget: options.tokenBudget ?? 1000,
    };
  }

  formatResult(result: SearchResult): string {
    const lines: string[] = [];

    // Line 1: Header with score, type, name, path
    lines.push(this.formatHeader(result));

    // Code snippet (if enabled)
    if (this.options.includeSnippets && typeof result.metadata.snippet === 'string') {
      const truncatedSnippet = this.truncateSnippet(
        result.metadata.snippet,
        this.options.maxSnippetLines
      );
      lines.push(this.indentText(truncatedSnippet, 3));
    }

    // Imports (if enabled)
    if (this.options.includeImports && Array.isArray(result.metadata.imports)) {
      const imports = result.metadata.imports as string[];
      if (imports.length > 0) {
        const displayImports = imports.slice(0, MAX_IMPORTS_DISPLAY);
        const suffix = imports.length > MAX_IMPORTS_DISPLAY ? ' ...' : '';
        lines.push(`   Imports: ${displayImports.join(', ')}${suffix}`);
      }
    }

    return lines.join('\n');
  }

  private formatHeader(result: SearchResult): string {
    const parts: string[] = [];

    // Score
    parts.push(`[${(result.score * 100).toFixed(0)}%]`);

    // Type
    if (this.options.includeTypes && typeof result.metadata.type === 'string') {
      parts.push(`${result.metadata.type}:`);
    }

    // Name
    if (typeof result.metadata.name === 'string') {
      parts.push(result.metadata.name);
    }

    // Path with line numbers
    if (this.options.includePaths && typeof result.metadata.path === 'string') {
      const pathPart =
        this.options.includeLineNumbers && typeof result.metadata.startLine === 'number'
          ? `(${result.metadata.path}:${result.metadata.startLine})`
          : `(${result.metadata.path})`;
      parts.push(pathPart);
    }

    return parts.join(' ');
  }

  private truncateSnippet(snippet: string, maxLines: number): string {
    const lines = snippet.split('\n');
    if (lines.length <= maxLines) {
      return snippet;
    }
    const truncated = lines.slice(0, maxLines).join('\n');
    const remaining = lines.length - maxLines;
    return `${truncated}\n// ... ${remaining} more lines`;
  }

  private indentText(text: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return text
      .split('\n')
      .map((line) => indent + line)
      .join('\n');
  }

  formatResults(results: SearchResult[]): FormattedResult {
    // Handle empty results
    if (results.length === 0) {
      const content = 'No results found';
      return {
        content,
        tokens: estimateTokensForText(content),
      };
    }

    // Respect max results
    const limitedResults = results.slice(0, this.options.maxResults);

    // Format each result
    const formatted = limitedResults.map((result, index) => {
      return `${index + 1}. ${this.formatResult(result)}`;
    });

    // Calculate total tokens (content only, no footer)
    const content = formatted.join('\n');
    const tokens = estimateTokensForText(content);

    return {
      content,
      tokens,
    };
  }

  estimateTokens(result: SearchResult): number {
    let estimate = estimateTokensForText(this.formatHeader(result));

    if (this.options.includeSnippets && typeof result.metadata.snippet === 'string') {
      estimate += estimateTokensForText(result.metadata.snippet);
    }

    if (this.options.includeImports && Array.isArray(result.metadata.imports)) {
      // ~3 tokens per import path
      estimate += (result.metadata.imports as string[]).length * 3;
    }

    return estimate;
  }
}
