/**
 * Search Adapter
 * Provides semantic code search via the dev_search tool
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import { CompactFormatter, type FormatMode, VerboseFormatter } from '../../formatters';
import { SearchArgsSchema } from '../../schemas/index.js';
import { findRelatedTestFiles, formatRelatedFiles } from '../../utils/related-files';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';
import { validateArgs } from '../validation.js';

/**
 * Search adapter configuration
 */
export interface SearchAdapterConfig {
  /**
   * Repository indexer instance
   */
  repositoryIndexer: RepositoryIndexer;

  /**
   * Repository root path (for finding related files)
   */
  repositoryPath?: string;

  /**
   * Default format mode
   */
  defaultFormat?: FormatMode;

  /**
   * Default result limit
   */
  defaultLimit?: number;

  /**
   * Include related test files in results
   */
  includeRelatedFiles?: boolean;
}

/**
 * Search Adapter
 * Implements the dev_search tool for semantic code search
 */
export class SearchAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'search-adapter',
    version: '1.0.0',
    description: 'Semantic code search adapter',
    author: 'Dev-Agent Team',
  };

  private indexer: RepositoryIndexer;
  private config: Required<Omit<SearchAdapterConfig, 'repositoryPath'>> & {
    repositoryPath?: string;
  };

  constructor(config: SearchAdapterConfig) {
    super();
    this.indexer = config.repositoryIndexer;
    this.config = {
      repositoryIndexer: config.repositoryIndexer,
      repositoryPath: config.repositoryPath,
      defaultFormat: config.defaultFormat ?? 'compact',
      defaultLimit: config.defaultLimit ?? 10,
      includeRelatedFiles: config.includeRelatedFiles ?? true,
    };
  }

  async initialize(context: AdapterContext): Promise<void> {
    context.logger.info('SearchAdapter initialized', {
      defaultFormat: this.config.defaultFormat,
      defaultLimit: this.config.defaultLimit,
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_search',
      description:
        'USE THIS FIRST for code exploration. Semantic search finds code by meaning, not just keywords. ' +
        'Better than grep for conceptual queries like "authentication flow", "error handling", "database connections". ' +
        'Returns ranked results with context snippets.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Natural language search query (e.g., "authentication middleware", "database connection logic")',
          },
          format: {
            type: 'string',
            enum: ['compact', 'verbose'],
            description:
              'Output format: "compact" for summaries (default), "verbose" for full details',
            default: this.config.defaultFormat,
          },
          limit: {
            type: 'number',
            description: `Maximum number of results to return (default: ${this.config.defaultLimit})`,
            minimum: 1,
            maximum: 50,
            default: this.config.defaultLimit,
          },
          scoreThreshold: {
            type: 'number',
            description: 'Minimum similarity score (0-1). Lower = more results (default: 0)',
            minimum: 0,
            maximum: 1,
            default: 0,
          },
          tokenBudget: {
            type: 'number',
            description:
              'Maximum tokens for results. Uses progressive disclosure to fit within budget (default: 2000 compact, 5000 verbose)',
            minimum: 500,
            maximum: 10000,
          },
        },
        required: ['query'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod
    const validation = validateArgs(SearchArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { query, format, limit, scoreThreshold, tokenBudget } = validation.data;

    try {
      const startTime = Date.now();
      context.logger.debug('Executing search', {
        query,
        format,
        limit,
        scoreThreshold,
        tokenBudget,
      });

      // Perform search
      const results = await this.indexer.search(query as string, {
        limit: limit as number,
        scoreThreshold: scoreThreshold as number,
      });

      // Create formatter with token budget if specified
      const formatter =
        format === 'verbose'
          ? new VerboseFormatter({
              maxResults: limit as number,
              tokenBudget: (tokenBudget as number | undefined) ?? 5000,
              includeSnippets: true,
              includeImports: true,
            })
          : new CompactFormatter({
              maxResults: limit as number,
              tokenBudget: (tokenBudget as number | undefined) ?? 2000,
              includeSnippets: true,
              includeImports: true,
            });

      const formatted = formatter.formatResults(results);

      // Find related test files if enabled and repository path is available
      let relatedFilesSection = '';
      let relatedFilesCount = 0;
      if (this.config.includeRelatedFiles && this.config.repositoryPath && results.length > 0) {
        const sourcePaths = results
          .map((r) => r.metadata.path)
          .filter((p): p is string => typeof p === 'string');

        if (sourcePaths.length > 0) {
          const relatedFiles = await findRelatedTestFiles(sourcePaths, this.config.repositoryPath);
          relatedFilesCount = relatedFiles.length;
          relatedFilesSection = formatRelatedFiles(relatedFiles);
        }
      }

      const duration_ms = Date.now() - startTime;

      context.logger.info('Search completed', {
        query,
        resultCount: results.length,
        relatedFilesCount,
        tokens: formatted.tokens,
        duration_ms,
      });

      return {
        success: true,
        data: {
          query,
          format,
          content: formatted.content + relatedFilesSection,
        },
        metadata: {
          tokens: formatted.tokens,
          duration_ms,
          timestamp: new Date().toISOString(),
          cached: false,
          results_total: results.length,
          results_returned: Math.min(results.length, limit as number),
          results_truncated: results.length > (limit as number),
          related_files_count: relatedFilesCount,
        },
      };
    } catch (error) {
      context.logger.error('Search failed', { error });
      return {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  estimateTokens(args: Record<string, unknown>): number {
    const { format = this.config.defaultFormat, limit = this.config.defaultLimit } = args;

    // Rough estimate based on format and limit
    const tokensPerResult = format === 'verbose' ? 100 : 20;
    return (limit as number) * tokensPerResult + 50; // +50 for overhead
  }
}
