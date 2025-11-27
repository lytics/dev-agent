/**
 * Verbose Formatter
 * Full-detail formatter with progressive disclosure support
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import type { DetailLevel, FormattedResult, FormatterOptions, ResultFormatter } from './types';
import { estimateTokensForText } from './utils';

/** Default max snippet lines for verbose mode */
const DEFAULT_MAX_SNIPPET_LINES = 20;
/** Default token budget for verbose */
const DEFAULT_TOKEN_BUDGET = 5000;
/** Default number of results with full detail */
const DEFAULT_FULL_DETAIL_COUNT = 3;
/** Default number of results with signature detail */
const DEFAULT_SIGNATURE_DETAIL_COUNT = 4;

/**
 * Verbose formatter - includes all available information
 * Supports progressive disclosure to fit within token budgets
 */
export class VerboseFormatter implements ResultFormatter {
  private options: Required<FormatterOptions>;

  constructor(options: FormatterOptions = {}) {
    this.options = {
      maxResults: options.maxResults ?? 10,
      includePaths: options.includePaths ?? true,
      includeLineNumbers: options.includeLineNumbers ?? true,
      includeTypes: options.includeTypes ?? true,
      includeSignatures: options.includeSignatures ?? true,
      includeSnippets: options.includeSnippets ?? true,
      includeImports: options.includeImports ?? true,
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

    // Path with line range (always include in verbose)
    if (this.options.includePaths && typeof result.metadata.path === 'string') {
      const location = this.formatLocation(result);
      lines.push(`  Location: ${location}`);
    }

    if (level === 'full') {
      // Full detail: signature + imports + metadata + snippet
      if (this.options.includeSignatures && typeof result.metadata.signature === 'string') {
        lines.push(`  Signature: ${result.metadata.signature}`);
      }

      if (this.options.includeImports && Array.isArray(result.metadata.imports)) {
        const imports = result.metadata.imports as string[];
        if (imports.length > 0) {
          lines.push(`  Imports: ${imports.join(', ')}`);
        }
      }

      const metadata = this.formatMetadata(result);
      if (metadata) {
        lines.push(`  Metadata: ${metadata}`);
      }

      if (this.options.includeSnippets && typeof result.metadata.snippet === 'string') {
        lines.push('  Code:');
        const truncatedSnippet = this.truncateSnippet(
          result.metadata.snippet,
          this.options.maxSnippetLines
        );
        lines.push(this.indentText(truncatedSnippet, 4));
      }
    } else if (level === 'signature') {
      // Signature detail: signature + metadata (no snippet)
      if (typeof result.metadata.signature === 'string') {
        lines.push(`  Signature: ${result.metadata.signature}`);
      }

      const metadata = this.formatMetadata(result);
      if (metadata) {
        lines.push(`  Metadata: ${metadata}`);
      }
    }
    // 'minimal' level = header + location only

    return lines.join('\n');
  }

  private formatHeader(result: SearchResult): string {
    const header: string[] = [];
    header.push(`[Score: ${(result.score * 100).toFixed(1)}%]`);

    if (this.options.includeTypes && typeof result.metadata.type === 'string') {
      header.push(`${result.metadata.type}:`);
    }

    if (typeof result.metadata.name === 'string') {
      header.push(result.metadata.name);
    }

    return header.join(' ');
  }

  private formatLocation(result: SearchResult): string {
    const path = result.metadata.path as string;

    if (!this.options.includeLineNumbers || typeof result.metadata.startLine !== 'number') {
      return path;
    }

    if (typeof result.metadata.endLine === 'number') {
      return `${path}:${result.metadata.startLine}-${result.metadata.endLine}`;
    }

    return `${path}:${result.metadata.startLine}`;
  }

  private formatMetadata(result: SearchResult): string | null {
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

    return metadata.length > 0 ? metadata.join(', ') : null;
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
    if (index < this.options.fullDetailCount && remainingBudget > 500) {
      return 'full';
    }

    // Next M get signatures if budget allows
    if (
      index < this.options.fullDetailCount + this.options.signatureDetailCount &&
      remainingBudget > 150
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

    const content = formatted.join('\n\n'); // Double newline for separation

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
