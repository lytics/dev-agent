/**
 * Compact Formatter
 * Token-efficient formatter with progressive disclosure support
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import type { DetailLevel, FormattedResult, FormatterOptions, ResultFormatter } from './types';
import { estimateTokensForText } from './utils';

/** Default max snippet lines for compact mode */
const DEFAULT_MAX_SNIPPET_LINES = 10;
/** Max imports to show before truncating */
const MAX_IMPORTS_DISPLAY = 5;
/** Default token budget */
const DEFAULT_TOKEN_BUDGET = 2000;
/** Default number of results with full detail */
const DEFAULT_FULL_DETAIL_COUNT = 3;
/** Default number of results with signature detail */
const DEFAULT_SIGNATURE_DETAIL_COUNT = 4;

/**
 * Compact formatter - optimized for token efficiency
 * Supports progressive disclosure to fit within token budgets
 */
export class CompactFormatter implements ResultFormatter {
  private options: Required<FormatterOptions>;

  constructor(options: FormatterOptions = {}) {
    this.options = {
      maxResults: options.maxResults ?? 10,
      includePaths: options.includePaths ?? true,
      includeLineNumbers: options.includeLineNumbers ?? true,
      includeTypes: options.includeTypes ?? true,
      includeSignatures: options.includeSignatures ?? false,
      includeSnippets: options.includeSnippets ?? false,
      includeImports: options.includeImports ?? false,
      maxSnippetLines: options.maxSnippetLines ?? DEFAULT_MAX_SNIPPET_LINES,
      tokenBudget: options.tokenBudget ?? DEFAULT_TOKEN_BUDGET,
      progressiveDisclosure: options.progressiveDisclosure ?? true,
      fullDetailCount: options.fullDetailCount ?? DEFAULT_FULL_DETAIL_COUNT,
      signatureDetailCount: options.signatureDetailCount ?? DEFAULT_SIGNATURE_DETAIL_COUNT,
    };
  }

  formatResult(result: SearchResult): string {
    return this.formatResultWithDetail(result, 'full');
  }

  /**
   * Format a result with a specific detail level
   */
  formatResultWithDetail(result: SearchResult, level: DetailLevel): string {
    const lines: string[] = [];

    // Always include header
    lines.push(this.formatHeader(result));

    if (level === 'full') {
      // Full detail: snippet + imports
      if (this.options.includeSnippets && typeof result.metadata.snippet === 'string') {
        const truncatedSnippet = this.truncateSnippet(
          result.metadata.snippet,
          this.options.maxSnippetLines
        );
        lines.push(this.indentText(truncatedSnippet, 3));
      }

      if (this.options.includeImports && Array.isArray(result.metadata.imports)) {
        const imports = result.metadata.imports as string[];
        if (imports.length > 0) {
          const displayImports = imports.slice(0, MAX_IMPORTS_DISPLAY);
          const suffix = imports.length > MAX_IMPORTS_DISPLAY ? ' ...' : '';
          lines.push(`   Imports: ${displayImports.join(', ')}${suffix}`);
        }
      }
    } else if (level === 'signature') {
      // Signature detail: just the signature
      if (typeof result.metadata.signature === 'string') {
        lines.push(`   ${result.metadata.signature}`);
      }
    }
    // 'minimal' level = header only

    return lines.join('\n');
  }

  private formatHeader(result: SearchResult): string {
    const parts: string[] = [];

    parts.push(`[${(result.score * 100).toFixed(0)}%]`);

    if (this.options.includeTypes && typeof result.metadata.type === 'string') {
      parts.push(`${result.metadata.type}:`);
    }

    if (typeof result.metadata.name === 'string') {
      parts.push(result.metadata.name);
    }

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

  /**
   * Determine detail level based on result position and remaining budget
   */
  private getDetailLevel(index: number, remainingBudget: number): DetailLevel {
    if (!this.options.progressiveDisclosure) {
      return 'full';
    }

    // Top N get full detail if budget allows
    if (index < this.options.fullDetailCount && remainingBudget > 300) {
      return 'full';
    }

    // Next M get signatures if budget allows
    if (
      index < this.options.fullDetailCount + this.options.signatureDetailCount &&
      remainingBudget > 100
    ) {
      return 'signature';
    }

    return 'minimal';
  }

  formatResults(results: SearchResult[]): FormattedResult {
    if (results.length === 0) {
      const content = 'No results found';
      return {
        content,
        tokens: estimateTokensForText(content),
      };
    }

    const limitedResults = results.slice(0, this.options.maxResults);
    const budget = this.options.tokenBudget;
    let usedTokens = 0;
    const formatted: string[] = [];
    let truncatedCount = 0;

    for (let i = 0; i < limitedResults.length; i++) {
      const result = limitedResults[i];
      const remainingBudget = budget - usedTokens;

      // Determine detail level
      const detailLevel = this.getDetailLevel(i, remainingBudget);
      const formattedResult = `${i + 1}. ${this.formatResultWithDetail(result, detailLevel)}`;
      const tokens = estimateTokensForText(formattedResult);

      // Check if we have budget (always include at least first result)
      if (usedTokens + tokens > budget && i > 0) {
        truncatedCount = limitedResults.length - i;
        break;
      }

      formatted.push(formattedResult);
      usedTokens += tokens;
    }

    // Add truncation notice if needed
    if (truncatedCount > 0) {
      const notice = `\n... ${truncatedCount} more results (token budget reached)`;
      formatted.push(notice);
      usedTokens += estimateTokensForText(notice);
    }

    const content = formatted.join('\n');

    return {
      content,
      tokens: usedTokens,
    };
  }

  estimateTokens(result: SearchResult): number {
    let estimate = estimateTokensForText(this.formatHeader(result));

    if (this.options.includeSnippets && typeof result.metadata.snippet === 'string') {
      estimate += estimateTokensForText(result.metadata.snippet);
    }

    if (this.options.includeImports && Array.isArray(result.metadata.imports)) {
      estimate += (result.metadata.imports as string[]).length * 3;
    }

    return estimate;
  }
}
