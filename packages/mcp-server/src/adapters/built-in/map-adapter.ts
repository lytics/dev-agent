/**
 * Map Adapter
 * Provides codebase structure overview via the dev_map tool
 */

import {
  formatCodebaseMap,
  generateCodebaseMap,
  LocalGitExtractor,
  type MapOptions,
  type RepositoryIndexer,
} from '@lytics/dev-agent-core';
import { estimateTokensForText, startTimer } from '../../formatters/utils';
import { MapArgsSchema, type MapOutput } from '../../schemas/index.js';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';
import { validateArgs } from '../validation.js';

/**
 * Map adapter configuration
 */
export interface MapAdapterConfig {
  /**
   * Repository indexer instance
   */
  repositoryIndexer: RepositoryIndexer;

  /**
   * Repository path for git operations
   */
  repositoryPath?: string;

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
  private repositoryPath?: string;
  private config: Required<Omit<MapAdapterConfig, 'repositoryPath'>>;

  constructor(config: MapAdapterConfig) {
    super();
    this.indexer = config.repositoryIndexer;
    this.repositoryPath = config.repositoryPath;
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
        'Get a structural overview showing WHAT IS IN each directory - not just file names but component counts (classes, functions, interfaces) ' +
        'and key exports. Better than list_dir when you need to understand code organization. Optionally shows git change frequency.',
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
          includeChangeFrequency: {
            type: 'boolean',
            description:
              'Include change frequency (commits per directory) - requires git access (default: false)',
            default: false,
          },
        },
        required: [],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod
    const validation = validateArgs(MapArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { depth, focus, includeExports, tokenBudget, includeChangeFrequency } = validation.data;

    try {
      const timer = startTimer();
      context.logger.debug('Generating codebase map', {
        depth,
        focus,
        includeExports,
        tokenBudget,
        includeChangeFrequency,
      });

      const mapOptions: MapOptions = {
        depth,
        focus: focus || '',
        includeExports,
        tokenBudget,
        includeChangeFrequency,
      };

      // Create git extractor if change frequency is requested
      const gitExtractor =
        includeChangeFrequency && this.repositoryPath
          ? new LocalGitExtractor(this.repositoryPath)
          : undefined;

      // Generate the map
      const map = await generateCodebaseMap({ indexer: this.indexer, gitExtractor }, mapOptions);

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
          const reducedMap = await generateCodebaseMap(
            { indexer: this.indexer, gitExtractor },
            { ...mapOptions, depth: reducedDepth }
          );
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

      // Validate output with Zod
      const _outputData: MapOutput = {
        content,
        totalComponents: map.totalComponents,
        totalDirectories: map.totalDirectories,
        depth,
        focus: focus || null,
        truncated,
      };

      // Return formatted content (MCP will wrap in content blocks)
      return {
        success: true,
        data: content,
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
