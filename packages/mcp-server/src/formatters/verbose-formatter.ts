/**
 * Verbose Formatter
 * Full-detail formatter that includes signatures, snippets, and metadata
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import type { FormattedResult, FormatterOptions, ResultFormatter } from './types';
import { estimateTokensForText } from './utils';

/** Default max snippet lines for verbose mode */
const DEFAULT_MAX_SNIPPET_LINES = 20;

/**
 * Verbose formatter - includes all available information
 * Returns: path, type, name, signature, imports, snippet, metadata, score
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
      includeSnippets: options.includeSnippets ?? true, // On by default for verbose
      includeImports: options.includeImports ?? true, // On by default for verbose
      maxSnippetLines: options.maxSnippetLines ?? DEFAULT_MAX_SNIPPET_LINES,
      tokenBudget: options.tokenBudget ?? 5000,
    };
  }

  formatResult(result: SearchResult): string {
    const lines: string[] = [];

    // Header: score + type + name
    lines.push(this.formatHeader(result));

    // Path with line range
    if (this.options.includePaths && typeof result.metadata.path === 'string') {
      const location = this.formatLocation(result);
      lines.push(`  Location: ${location}`);
    }

    // Signature (if available and enabled)
    if (this.options.includeSignatures && typeof result.metadata.signature === 'string') {
      lines.push(`  Signature: ${result.metadata.signature}`);
    }

    // Imports (if enabled)
    if (this.options.includeImports && Array.isArray(result.metadata.imports)) {
      const imports = result.metadata.imports as string[];
      if (imports.length > 0) {
        lines.push(`  Imports: ${imports.join(', ')}`);
      }
    }

    // Additional metadata
    const metadata = this.formatMetadata(result);
    if (metadata) {
      lines.push(`  Metadata: ${metadata}`);
    }

    // Code snippet (if enabled)
    if (this.options.includeSnippets && typeof result.metadata.snippet === 'string') {
      lines.push('  Code:');
      const truncatedSnippet = this.truncateSnippet(
        result.metadata.snippet,
        this.options.maxSnippetLines
      );
      lines.push(this.indentText(truncatedSnippet, 4));
    }

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

    // Format each result with separator
    const formatted = limitedResults.map((result, index) => {
      return `${index + 1}. ${this.formatResult(result)}`;
    });

    // Calculate total tokens (content only, no footer)
    const content = formatted.join('\n\n'); // Double newline for separation
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
