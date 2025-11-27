/**
 * Map Adapter
 * Provides codebase structure overview via the dev_map tool
 */

import {
  formatCodebaseMap,
  generateCodebaseMap,
  type MapOptions,
  type RepositoryIndexer,
} from '@lytics/dev-agent-core';
import { estimateTokensForText, startTimer } from '../../formatters/utils';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';

/**
 * Map adapter configuration
 */
export interface MapAdapterConfig {
  /**
   * Repository indexer instance
   */
  repositoryIndexer: RepositoryIndexer;

  /**
   * Default depth for map generation
   */
  defaultDepth?: number;

  /**
   * Default token budget
   */
  defaultTokenBudget?: number;
}

/**
 * Map Adapter
 * Implements the dev_map tool for codebase structure overview
 */
export class MapAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'map-adapter',
    version: '1.0.0',
    description: 'Codebase structure overview adapter',
    author: 'Dev-Agent Team',
  };

  private indexer: RepositoryIndexer;
  private config: Required<MapAdapterConfig>;

  constructor(config: MapAdapterConfig) {
    super();
    this.indexer = config.repositoryIndexer;
    this.config = {
      repositoryIndexer: config.repositoryIndexer,
      defaultDepth: config.defaultDepth ?? 2,
      defaultTokenBudget: config.defaultTokenBudget ?? 2000,
    };
  }

  async initialize(context: AdapterContext): Promise<void> {
    context.logger.info('MapAdapter initialized', {
      defaultDepth: this.config.defaultDepth,
      defaultTokenBudget: this.config.defaultTokenBudget,
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_map',
      description:
        'Get a high-level overview of the codebase structure. Shows directories, component counts, and exported symbols.',
      inputSchema: {
        type: 'object',
        properties: {
          depth: {
            type: 'number',
            description: `Directory depth to show (1-5, default: ${this.config.defaultDepth})`,
            minimum: 1,
            maximum: 5,
            default: this.config.defaultDepth,
          },
          focus: {
            type: 'string',
            description: 'Focus on a specific directory path (e.g., "packages/core/src")',
          },
          includeExports: {
            type: 'boolean',
            description: 'Include exported symbols in output (default: true)',
            default: true,
          },
          tokenBudget: {
            type: 'number',
            description: `Maximum tokens for output (default: ${this.config.defaultTokenBudget})`,
            minimum: 500,
            maximum: 10000,
            default: this.config.defaultTokenBudget,
          },
        },
        required: [],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const {
      depth = this.config.defaultDepth,
      focus,
      includeExports = true,
      tokenBudget = this.config.defaultTokenBudget,
    } = args as {
      depth?: number;
      focus?: string;
      includeExports?: boolean;
      tokenBudget?: number;
    };

    // Validate depth
    if (typeof depth !== 'number' || depth < 1 || depth > 5) {
      return {
        success: false,
        error: {
          code: 'INVALID_DEPTH',
          message: 'Depth must be a number between 1 and 5',
        },
      };
    }

    // Validate focus if provided
    if (focus !== undefined && typeof focus !== 'string') {
      return {
        success: false,
        error: {
          code: 'INVALID_FOCUS',
          message: 'Focus must be a string path',
        },
      };
    }

    // Validate tokenBudget
    if (typeof tokenBudget !== 'number' || tokenBudget < 500 || tokenBudget > 10000) {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN_BUDGET',
          message: 'Token budget must be a number between 500 and 10000',
        },
      };
    }

    try {
      const timer = startTimer();
      context.logger.debug('Generating codebase map', {
        depth,
        focus,
        includeExports,
        tokenBudget,
      });

      const mapOptions: MapOptions = {
        depth,
        focus: focus || '',
        includeExports,
        tokenBudget,
      };

      // Generate the map
      const map = await generateCodebaseMap(this.indexer, mapOptions);

      // Format the output
      let content = formatCodebaseMap(map, mapOptions);

      // Check token budget and truncate if needed
      let tokens = estimateTokensForText(content);
      let truncated = false;

      if (tokens > tokenBudget) {
        // Try reducing depth
        let reducedDepth = depth;
        while (tokens > tokenBudget && reducedDepth > 1) {
          reducedDepth--;
          const reducedMap = await generateCodebaseMap(this.indexer, {
            ...mapOptions,
            depth: reducedDepth,
          });
          content = formatCodebaseMap(reducedMap, { ...mapOptions, depth: reducedDepth });
          tokens = estimateTokensForText(content);
          truncated = true;
        }

        if (truncated) {
          content += `\n\n*Note: Depth reduced to ${reducedDepth} to fit token budget*`;
        }
      }

      const duration_ms = timer.elapsed();

      context.logger.info('Codebase map generated', {
        depth,
        focus,
        totalComponents: map.totalComponents,
        totalDirectories: map.totalDirectories,
        tokens,
        truncated,
        duration_ms,
      });

      return {
        success: true,
        data: {
          content,
          totalComponents: map.totalComponents,
          totalDirectories: map.totalDirectories,
          depth,
          focus: focus || null,
          truncated,
        },
        metadata: {
          tokens,
          duration_ms,
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };
    } catch (error) {
      context.logger.error('Map generation failed', { error });
      return {
        success: false,
        error: {
          code: 'MAP_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  estimateTokens(args: Record<string, unknown>): number {
    const { depth = this.config.defaultDepth, tokenBudget = this.config.defaultTokenBudget } = args;

    // Estimate based on depth - each level roughly doubles the output
    const baseTokens = 100;
    const depthMultiplier = 2 ** ((depth as number) - 1);

    return Math.min(baseTokens * depthMultiplier, tokenBudget as number);
  }
}
