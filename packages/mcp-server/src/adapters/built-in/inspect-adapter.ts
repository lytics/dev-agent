/**
 * Inspect Adapter
 * Exposes code inspection capabilities via MCP (dev_inspect tool)
 *
 * Provides file-level analysis: similarity comparison and pattern consistency checking.
 */

import type { SearchService } from '@lytics/dev-agent-core';
import type { SimilarCodeResult } from '@lytics/dev-agent-subagents';
import { InspectArgsSchema, type InspectOutput, InspectOutputSchema } from '../../schemas/index.js';
import { ToolAdapter } from '../tool-adapter.js';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types.js';
import { validateArgs } from '../validation.js';

export interface InspectAdapterConfig {
  repositoryPath: string;
  searchService: SearchService;
  defaultLimit?: number;
  defaultThreshold?: number;
  defaultFormat?: 'compact' | 'verbose';
}

/**
 * InspectAdapter - Deep file analysis
 *
 * Provides similarity comparison and pattern validation
 * through the dev_inspect MCP tool.
 *
 * Actions:
 * - compare: Find similar implementations in the codebase
 * - validate: Check against codebase patterns (placeholder for future)
 */
export class InspectAdapter extends ToolAdapter {
  metadata = {
    name: 'inspect',
    version: '1.0.0',
    description: 'Deep file analysis and pattern checking',
  };

  private repositoryPath: string;
  private searchService: SearchService;
  private defaultLimit: number;
  private defaultThreshold: number;
  private defaultFormat: 'compact' | 'verbose';

  constructor(config: InspectAdapterConfig) {
    super();
    this.repositoryPath = config.repositoryPath;
    this.searchService = config.searchService;
    this.defaultLimit = config.defaultLimit ?? 10;
    this.defaultThreshold = config.defaultThreshold ?? 0.7;
    this.defaultFormat = config.defaultFormat ?? 'compact';
  }

  async initialize(context: AdapterContext): Promise<void> {
    // Store coordinator and logger from base class
    this.initializeBase(context);

    context.logger.info('InspectAdapter initialized', {
      repositoryPath: this.repositoryPath,
      defaultLimit: this.defaultLimit,
      defaultThreshold: this.defaultThreshold,
      defaultFormat: this.defaultFormat,
      hasCoordinator: this.hasCoordinator(),
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_inspect',
      description:
        'Inspect specific files for deep analysis. "compare" finds similar implementations, ' +
        '"validate" checks against codebase patterns. Takes a file path (not a search query).',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['compare', 'validate'],
            description:
              'Inspection action: "compare" (find similar code), "validate" (check patterns)',
          },
          query: {
            type: 'string',
            description: 'File path to inspect (e.g., "src/auth/middleware.ts")',
          },
          limit: {
            type: 'number',
            description: `Maximum number of results (default: ${this.defaultLimit})`,
            default: this.defaultLimit,
          },
          threshold: {
            type: 'number',
            description: `Similarity threshold 0-1 (default: ${this.defaultThreshold})`,
            default: this.defaultThreshold,
            minimum: 0,
            maximum: 1,
          },
          format: {
            type: 'string',
            enum: ['compact', 'verbose'],
            description:
              'Output format: "compact" for summaries (default), "verbose" for full details',
            default: this.defaultFormat,
          },
        },
        required: ['action', 'query'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['compare', 'validate'],
            description: 'Inspection action performed',
          },
          query: {
            type: 'string',
            description: 'File path inspected',
          },
          format: {
            type: 'string',
            description: 'Output format used',
          },
          content: {
            type: 'string',
            description: 'Formatted inspection results',
          },
        },
        required: ['action', 'query', 'format', 'content'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod
    const validation = validateArgs(InspectArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { action, query, limit, threshold, format } = validation.data;

    try {
      context.logger.debug('Executing inspection', {
        action,
        query,
        limit,
        threshold,
        viaAgent: this.hasCoordinator(),
      });

      let content: string;

      // Try routing through agent if coordinator is available
      if (this.hasCoordinator() && action === 'compare') {
        const agentResult = await this.executeViaAgent(query, limit, threshold, format);

        if (agentResult) {
          return {
            success: true,
            data: {
              action,
              query,
              format,
              content: agentResult,
            },
          };
        }
        // Fall through to direct execution if agent dispatch failed
        context.logger.debug('Agent dispatch returned null, falling back to direct execution');
      }

      // Direct execution (fallback or no coordinator)
      switch (action) {
        case 'compare':
          content = await this.compareImplementations(query, limit, threshold, format);
          break;
        case 'validate':
          content = await this.validatePatterns(query, format);
          break;
      }

      // Validate output with Zod
      const outputData: InspectOutput = {
        action,
        query,
        format,
        content,
      };

      const outputValidation = InspectOutputSchema.safeParse(outputData);
      if (!outputValidation.success) {
        context.logger.error('Output validation failed', { error: outputValidation.error });
        throw new Error(`Output validation failed: ${outputValidation.error.message}`);
      }

      return {
        success: true,
        data: outputValidation.data,
      };
    } catch (error) {
      context.logger.error('Inspection failed', { error });

      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          return {
            success: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: `File not found: ${query}`,
              suggestion: 'Check the file path and ensure it exists in the repository.',
            },
          };
        }

        if (error.message.includes('not indexed')) {
          return {
            success: false,
            error: {
              code: 'INDEX_NOT_READY',
              message: 'Code index is not ready',
              suggestion: 'Run "dev index" to index the repository.',
            },
          };
        }
      }

      return {
        success: false,
        error: {
          code: 'INSPECTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown inspection error',
        },
      };
    }
  }

  /**
   * Execute similarity comparison via agent
   * Returns formatted content string, or null if dispatch fails
   */
  private async executeViaAgent(
    filePath: string,
    limit: number,
    threshold: number,
    format: string
  ): Promise<string | null> {
    // Build request payload
    const payload = {
      action: 'similar',
      filePath,
      limit,
      threshold,
    };

    // Dispatch to ExplorerAgent
    const response = await this.dispatchToAgent('explorer', payload);

    if (!response) {
      return null;
    }

    // Check for error response
    if (response.type === 'error') {
      this.logger?.warn('ExplorerAgent returned error', {
        error: response.payload.error,
      });
      return null;
    }

    // Extract result from response payload
    const result = response.payload as unknown as SimilarCodeResult;

    // Format the result
    if (format === 'verbose') {
      return this.formatSimilarVerbose(
        result.referenceFile,
        result.similar.map((r) => ({
          id: r.id,
          score: r.score,
          metadata: r.metadata as Record<string, unknown>,
        }))
      );
    }

    return this.formatSimilarCompact(
      result.referenceFile,
      result.similar.map((r) => ({
        id: r.id,
        score: r.score,
        metadata: r.metadata as Record<string, unknown>,
      }))
    );
  }

  /**
   * Compare implementations - find similar code
   */
  private async compareImplementations(
    filePath: string,
    limit: number,
    threshold: number,
    format: string
  ): Promise<string> {
    const results = await this.searchService.findSimilar(filePath, {
      limit: limit + 1,
      threshold,
    });

    // Exclude the reference file itself
    const filteredResults = results.filter((r) => r.metadata.path !== filePath).slice(0, limit);

    if (filteredResults.length === 0) {
      return `## Similar Code\n\n**Reference:** \`${filePath}\`\n\nNo similar code found. The file may be unique in the repository.`;
    }

    if (format === 'verbose') {
      return this.formatSimilarVerbose(filePath, filteredResults);
    }

    return this.formatSimilarCompact(filePath, filteredResults);
  }

  /**
   * Validate patterns - check against codebase patterns
   * TODO: Implement pattern consistency validation
   */
  private async validatePatterns(filePath: string, format: string): Promise<string> {
    // Placeholder implementation
    return `## Pattern Validation\n\n**File:** \`${filePath}\`\n\n**Status:** Feature coming soon\n\nThis action will validate:\n- Naming conventions vs. similar files\n- Error handling patterns\n- Code structure consistency\n- Framework-specific best practices\n\nUse \`dev_inspect { action: "compare", query: "${filePath}" }\` to see similar implementations in the meantime.`;
  }

  /**
   * Format similar code results in compact mode
   */
  private formatSimilarCompact(
    filePath: string,
    results: Array<{ id: string; score: number; metadata: Record<string, unknown> }>
  ): string {
    const lines = [
      '## Similar Code',
      '',
      `**Reference:** \`${filePath}\``,
      `**Found:** ${results.length} similar files`,
      '',
    ];

    for (const result of results.slice(0, 5)) {
      const score = (result.score * 100).toFixed(0);
      lines.push(`- \`${result.metadata.path}\` [${score}% similar]`);
    }

    if (results.length > 5) {
      lines.push('', `_...and ${results.length - 5} more files_`);
    }

    return lines.join('\n');
  }

  /**
   * Format similar code results in verbose mode
   */
  private formatSimilarVerbose(
    filePath: string,
    results: Array<{ id: string; score: number; metadata: Record<string, unknown> }>
  ): string {
    const lines = [
      '## Similar Code Analysis',
      '',
      `**Reference File:** \`${filePath}\``,
      `**Total Matches:** ${results.length}`,
      '',
    ];

    for (const result of results) {
      const score = (result.score * 100).toFixed(1);
      const type = result.metadata.type || 'file';
      const name = result.metadata.name || result.metadata.path;

      lines.push(`### ${name}`);
      lines.push(`- **Path:** \`${result.metadata.path}\``);
      lines.push(`- **Type:** ${type}`);
      lines.push(`- **Similarity:** ${score}%`);
      lines.push('');
    }

    return lines.join('\n');
  }
}
