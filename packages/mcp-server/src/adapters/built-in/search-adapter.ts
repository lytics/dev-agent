/**
 * Search Adapter
 * Provides semantic code search via the dev_search tool
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import { CompactFormatter, type FormatMode, VerboseFormatter } from '../../formatters';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';

/**
 * Search adapter configuration
 */
export interface SearchAdapterConfig {
  /**
   * Repository indexer instance
   */
  repositoryIndexer: RepositoryIndexer;

  /**
   * Default format mode
   */
  defaultFormat?: FormatMode;

  /**
   * Default result limit
   */
  defaultLimit?: number;
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
  private compactFormatter: CompactFormatter;
  private verboseFormatter: VerboseFormatter;
  private config: Required<SearchAdapterConfig>;

  constructor(config: SearchAdapterConfig) {
    super();
    this.indexer = config.repositoryIndexer;
    this.config = {
      repositoryIndexer: config.repositoryIndexer,
      defaultFormat: config.defaultFormat ?? 'compact',
      defaultLimit: config.defaultLimit ?? 10,
    };

    // Initialize formatters
    this.compactFormatter = new CompactFormatter({
      maxResults: this.config.defaultLimit,
      tokenBudget: 1000,
    });

    this.verboseFormatter = new VerboseFormatter({
      maxResults: this.config.defaultLimit,
      tokenBudget: 5000,
    });
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
        'Semantic search for code components (functions, classes, interfaces) in the indexed repository',
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
        },
        required: ['query'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const {
      query,
      format = this.config.defaultFormat,
      limit = this.config.defaultLimit,
      scoreThreshold = 0,
    } = args;

    // Validate query
    if (typeof query !== 'string' || query.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Query must be a non-empty string',
        },
      };
    }

    // Validate format
    if (format !== 'compact' && format !== 'verbose') {
      return {
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: 'Format must be either "compact" or "verbose"',
        },
      };
    }

    // Validate limit
    if (typeof limit !== 'number' || limit < 1 || limit > 50) {
      return {
        success: false,
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be a number between 1 and 50',
        },
      };
    }

    // Validate scoreThreshold
    if (typeof scoreThreshold !== 'number' || scoreThreshold < 0 || scoreThreshold > 1) {
      return {
        success: false,
        error: {
          code: 'INVALID_SCORE_THRESHOLD',
          message: 'Score threshold must be a number between 0 and 1',
        },
      };
    }

    try {
      const startTime = Date.now();
      context.logger.debug('Executing search', { query, format, limit, scoreThreshold });

      // Perform search
      const results = await this.indexer.search(query as string, {
        limit: limit as number,
        scoreThreshold: scoreThreshold as number,
      });

      // Format results
      const formatter = format === 'verbose' ? this.verboseFormatter : this.compactFormatter;
      const formatted = formatter.formatResults(results);

      const duration_ms = Date.now() - startTime;

      context.logger.info('Search completed', {
        query,
        resultCount: results.length,
        tokens: formatted.tokens,
        duration_ms,
      });

      return {
        success: true,
        data: {
          query,
          format,
          content: formatted.content,
        },
        metadata: {
          tokens: formatted.tokens,
          duration_ms,
          timestamp: new Date().toISOString(),
          cached: false,
          results_total: results.length,
          results_returned: Math.min(results.length, limit as number),
          results_truncated: results.length > (limit as number),
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
