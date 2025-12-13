/**
 * Refs Adapter
 * Provides call graph queries via the dev_refs tool
 */

import type { CalleeInfo, RepositoryIndexer, SearchResult } from '@lytics/dev-agent-core';
import { estimateTokensForText, startTimer } from '../../formatters/utils';
import { RefsArgsSchema, type RefsOutput, RefsOutputSchema } from '../../schemas/index.js';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';
import { validateArgs } from '../validation.js';

/**
 * Direction of relationship query
 */
export type RefDirection = 'callees' | 'callers' | 'both';

/**
 * Refs adapter configuration
 */
export interface RefsAdapterConfig {
  /**
   * Repository indexer instance
   */
  repositoryIndexer: RepositoryIndexer;

  /**
   * Default result limit
   */
  defaultLimit?: number;
}

/**
 * Reference result for output
 */
interface RefResult {
  name: string;
  file?: string;
  line: number;
  type?: string;
  snippet?: string;
}

/**
 * Refs Adapter
 * Implements the dev_refs tool for querying call relationships
 */
export class RefsAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'refs-adapter',
    version: '1.0.0',
    description: 'Call graph relationship adapter',
    author: 'Dev-Agent Team',
  };

  private indexer: RepositoryIndexer;
  private config: Required<RefsAdapterConfig>;

  constructor(config: RefsAdapterConfig) {
    super();
    this.indexer = config.repositoryIndexer;
    this.config = {
      repositoryIndexer: config.repositoryIndexer,
      defaultLimit: config.defaultLimit ?? 20,
    };
  }

  async initialize(context: AdapterContext): Promise<void> {
    context.logger.info('RefsAdapter initialized', {
      defaultLimit: this.config.defaultLimit,
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_refs',
      description:
        'Find who calls a function and what it calls. Use when you have a SPECIFIC symbol name and need to trace dependencies. ' +
        'For conceptual queries like "where is auth used", use dev_search instead.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Name of the function or method to query (e.g., "createPlan", "SearchAdapter.execute")',
          },
          direction: {
            type: 'string',
            enum: ['callees', 'callers', 'both'],
            description:
              'Direction of query: "callees" (what this calls), "callers" (what calls this), or "both" (default)',
            default: 'both',
          },
          limit: {
            type: 'number',
            description: `Maximum number of results per direction (default: ${this.config.defaultLimit})`,
            minimum: 1,
            maximum: 50,
            default: this.config.defaultLimit,
          },
        },
        required: ['name'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Function/method name queried',
          },
          direction: {
            type: 'string',
            enum: ['callees', 'callers', 'both'],
            description: 'Direction of query',
          },
          content: {
            type: 'string',
            description: 'Formatted reference information',
          },
          target: {
            type: 'object',
            description: 'Target function details',
            properties: {
              name: { type: 'string' },
              file: { type: 'string' },
              line: { type: 'number' },
              type: { type: 'string' },
            },
          },
          callees: {
            type: 'array',
            description: 'Functions called by target (if requested)',
          },
          callers: {
            type: 'array',
            description: 'Functions calling target (if requested)',
          },
        },
        required: ['name', 'direction', 'content', 'target'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod
    const validation = validateArgs(RefsArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { name, direction, limit } = validation.data;

    try {
      const timer = startTimer();
      context.logger.debug('Executing refs query', { name, direction, limit });

      // First, find the target component
      const searchResults = await this.indexer.search(name, { limit: 10 });
      const target = this.findBestMatch(searchResults, name);

      if (!target) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Could not find function or method named "${name}"`,
          },
        };
      }

      const result: {
        target: {
          name: string;
          file: string;
          line: number;
          type: string;
        };
        callees?: RefResult[];
        callers?: RefResult[];
      } = {
        target: {
          name: target.metadata.name || name,
          file: target.metadata.path || '',
          line: target.metadata.startLine || 0,
          type: (target.metadata.type as string) || 'unknown',
        },
      };

      // Get callees if requested
      if (direction === 'callees' || direction === 'both') {
        result.callees = this.getCallees(target, limit);
      }

      // Get callers if requested
      if (direction === 'callers' || direction === 'both') {
        result.callers = await this.getCallers(target, limit);
      }

      const content = this.formatOutput(result, direction);
      const duration_ms = timer.elapsed();

      context.logger.info('Refs query completed', {
        name,
        direction,
        calleesCount: result.callees?.length ?? 0,
        callersCount: result.callers?.length ?? 0,
        duration_ms,
      });

      const tokens = estimateTokensForText(content);

      // Validate output with Zod
      const outputData: RefsOutput = {
        name,
        direction,
        content,
        target: result.target,
        callees: result.callees,
        callers: result.callers,
      };

      const outputValidation = RefsOutputSchema.safeParse(outputData);
      if (!outputValidation.success) {
        context.logger.error('Output validation failed', { error: outputValidation.error });
        throw new Error(`Output validation failed: ${outputValidation.error.message}`);
      }

      return {
        success: true,
        data: outputValidation.data,
        metadata: {
          tokens,
          duration_ms,
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };
    } catch (error) {
      context.logger.error('Refs query failed', { error });
      return {
        success: false,
        error: {
          code: 'REFS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  /**
   * Find the best matching result for a name query
   */
  private findBestMatch(results: SearchResult[], name: string): SearchResult | null {
    if (results.length === 0) return null;

    // Exact name match takes priority
    const exactMatch = results.find(
      (r) => r.metadata.name === name || r.metadata.name?.endsWith(`.${name}`)
    );
    if (exactMatch) return exactMatch;

    // Otherwise return the highest scoring result
    return results[0];
  }

  /**
   * Get callees from the target's metadata
   */
  private getCallees(target: SearchResult, limit: number): RefResult[] {
    const callees = target.metadata.callees as CalleeInfo[] | undefined;
    if (!callees || callees.length === 0) return [];

    return callees.slice(0, limit).map((c) => ({
      name: c.name,
      file: c.file,
      line: c.line,
    }));
  }

  /**
   * Find callers by searching all indexed components for callees that reference the target
   */
  private async getCallers(target: SearchResult, limit: number): Promise<RefResult[]> {
    const targetName = target.metadata.name;
    if (!targetName) return [];

    // Search for components that might call this target
    // We search broadly and then filter by callees
    const candidates = await this.indexer.search(targetName, { limit: 100 });

    const callers: RefResult[] = [];

    for (const candidate of candidates) {
      // Skip the target itself
      if (candidate.id === target.id) continue;

      const callees = candidate.metadata.callees as CalleeInfo[] | undefined;
      if (!callees) continue;

      // Check if any callee matches our target
      const callsTarget = callees.some(
        (c) =>
          c.name === targetName ||
          c.name.endsWith(`.${targetName}`) ||
          targetName.endsWith(`.${c.name}`)
      );

      if (callsTarget) {
        callers.push({
          name: candidate.metadata.name || 'unknown',
          file: candidate.metadata.path,
          line: candidate.metadata.startLine || 0,
          type: candidate.metadata.type as string,
          snippet: candidate.metadata.signature as string | undefined,
        });

        if (callers.length >= limit) break;
      }
    }

    return callers;
  }

  /**
   * Format the output as readable text
   */
  private formatOutput(
    result: {
      target: { name: string; file: string; line: number; type: string };
      callees?: RefResult[];
      callers?: RefResult[];
    },
    direction: RefDirection
  ): string {
    const lines: string[] = [];

    lines.push(`# References for ${result.target.name}`);
    lines.push(`**Location:** ${result.target.file}:${result.target.line}`);
    lines.push(`**Type:** ${result.target.type}`);
    lines.push('');

    if (direction === 'callees' || direction === 'both') {
      lines.push('## Callees (what this calls)');
      if (result.callees && result.callees.length > 0) {
        for (const callee of result.callees) {
          const location = callee.file ? `${callee.file}:${callee.line}` : `line ${callee.line}`;
          lines.push(`- \`${callee.name}\` at ${location}`);
        }
      } else {
        lines.push('*No callees found*');
      }
      lines.push('');
    }

    if (direction === 'callers' || direction === 'both') {
      lines.push('## Callers (what calls this)');
      if (result.callers && result.callers.length > 0) {
        for (const caller of result.callers) {
          const location = caller.file ? `${caller.file}:${caller.line}` : `line ${caller.line}`;
          lines.push(`- \`${caller.name}\` (${caller.type}) at ${location}`);
        }
      } else {
        lines.push('*No callers found in indexed code*');
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  estimateTokens(args: Record<string, unknown>): number {
    const { limit = this.config.defaultLimit, direction = 'both' } = args;
    const multiplier = direction === 'both' ? 2 : 1;
    return (limit as number) * 15 * multiplier + 50;
  }
}
