/**
 * Explore Adapter
 * Exposes code exploration capabilities via MCP (dev_explore tool)
 *
 * Routes through ExplorerAgent when coordinator is available,
 * falls back to direct indexer calls otherwise.
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import type {
  ExplorationResult,
  PatternResult,
  RelationshipResult,
  SimilarCodeResult,
} from '@lytics/dev-agent-subagents';
import { ExploreArgsSchema } from '../../schemas/index.js';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';
import { validateArgs } from '../validation.js';

export interface ExploreAdapterConfig {
  repositoryPath: string;
  repositoryIndexer: RepositoryIndexer;
  defaultLimit?: number;
  defaultThreshold?: number;
  defaultFormat?: 'compact' | 'verbose';
}

/**
 * ExploreAdapter - Code exploration via semantic search
 *
 * Provides pattern search, similar code detection, and relationship mapping
 * through the dev_explore MCP tool.
 *
 * When a coordinator is available, routes requests through ExplorerAgent
 * for coordinated execution. Falls back to direct indexer calls otherwise.
 */
export class ExploreAdapter extends ToolAdapter {
  metadata = {
    name: 'explore',
    version: '1.0.0',
    description: 'Code exploration via semantic search',
  };

  private repositoryPath: string;
  private repositoryIndexer: RepositoryIndexer;
  private defaultLimit: number;
  private defaultThreshold: number;
  private defaultFormat: 'compact' | 'verbose';

  constructor(config: ExploreAdapterConfig) {
    super();
    this.repositoryPath = config.repositoryPath;
    this.repositoryIndexer = config.repositoryIndexer;
    this.defaultLimit = config.defaultLimit ?? 10;
    this.defaultThreshold = config.defaultThreshold ?? 0.7;
    this.defaultFormat = config.defaultFormat ?? 'compact';
  }

  async initialize(context: AdapterContext): Promise<void> {
    // Store coordinator and logger from base class
    this.initializeBase(context);

    context.logger.info('ExploreAdapter initialized', {
      repositoryPath: this.repositoryPath,
      defaultLimit: this.defaultLimit,
      defaultThreshold: this.defaultThreshold,
      defaultFormat: this.defaultFormat,
      hasCoordinator: this.hasCoordinator(),
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_explore',
      description:
        'After finding code with dev_search, use this for deeper analysis: "similar" finds other code that looks like a given file, ' +
        '"relationships" maps a file\'s imports and what depends on it. (Also has "pattern" which works like dev_search.)',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['pattern', 'similar', 'relationships'],
            description:
              'Exploration action: "pattern" (search by concept), "similar" (find similar code to a file), "relationships" (map dependencies)',
          },
          query: {
            type: 'string',
            description:
              'Search query (for pattern action) or file path (for similar/relationships actions)',
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
          fileTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter results by file extensions (e.g., [".ts", ".js"])',
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
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod
    const validation = validateArgs(ExploreArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { action, query, limit, threshold, fileTypes, format } = validation.data;

    try {
      context.logger.debug('Executing exploration', {
        action,
        query,
        limit,
        threshold,
        viaAgent: this.hasCoordinator(),
      });

      let content: string;

      // Try routing through ExplorerAgent if coordinator is available
      if (this.hasCoordinator()) {
        const agentResult = await this.executeViaAgent(
          action as 'pattern' | 'similar' | 'relationships',
          query,
          limit,
          threshold,
          fileTypes as string[] | undefined,
          format
        );

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
        case 'pattern':
          content = await this.searchPattern(
            query,
            limit,
            threshold,
            fileTypes as string[] | undefined,
            format
          );
          break;
        case 'similar':
          content = await this.findSimilar(query, limit, threshold, format);
          break;
        case 'relationships':
          content = await this.findRelationships(query, format);
          break;
      }

      return {
        success: true,
        data: {
          action,
          query,
          format,
          content,
        },
      };
    } catch (error) {
      context.logger.error('Exploration failed', { error });

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
              suggestion: 'Run "dev scan" to index the repository.',
            },
          };
        }
      }

      return {
        success: false,
        error: {
          code: 'EXPLORATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown exploration error',
        },
      };
    }
  }

  /**
   * Execute exploration via ExplorerAgent through the coordinator
   * Returns formatted content string, or null if dispatch fails
   */
  private async executeViaAgent(
    action: 'pattern' | 'similar' | 'relationships',
    query: string,
    limit: number,
    threshold: number,
    fileTypes: string[] | undefined,
    format: string
  ): Promise<string | null> {
    // Build request payload based on action
    let payload: Record<string, unknown>;

    switch (action) {
      case 'pattern':
        payload = {
          action: 'pattern',
          query,
          limit,
          threshold,
          fileTypes,
        };
        break;
      case 'similar':
        payload = {
          action: 'similar',
          filePath: query,
          limit,
          threshold,
        };
        break;
      case 'relationships':
        payload = {
          action: 'relationships',
          component: query,
          limit,
        };
        break;
    }

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
    const result = response.payload as unknown as ExplorationResult;

    // Format the result based on action and format preference
    return this.formatAgentResult(result, format);
  }

  /**
   * Format ExplorerAgent result into display string
   */
  private formatAgentResult(result: ExplorationResult, format: string): string {
    switch (result.action) {
      case 'pattern': {
        const patternResult = result as PatternResult;
        if (format === 'verbose') {
          return this.formatPatternVerbose(
            patternResult.query,
            patternResult.results.map((r) => ({
              id: r.id,
              score: r.score,
              metadata: r.metadata as Record<string, unknown>,
            }))
          );
        }
        return this.formatPatternCompact(
          patternResult.query,
          patternResult.results.map((r) => ({
            id: r.id,
            score: r.score,
            metadata: r.metadata as Record<string, unknown>,
          }))
        );
      }

      case 'similar': {
        const similarResult = result as SimilarCodeResult;
        if (format === 'verbose') {
          return this.formatSimilarVerbose(
            similarResult.referenceFile,
            similarResult.similar.map((r) => ({
              id: r.id,
              score: r.score,
              metadata: r.metadata as Record<string, unknown>,
            }))
          );
        }
        return this.formatSimilarCompact(
          similarResult.referenceFile,
          similarResult.similar.map((r) => ({
            id: r.id,
            score: r.score,
            metadata: r.metadata as Record<string, unknown>,
          }))
        );
      }

      case 'relationships': {
        const relationshipResult = result as RelationshipResult;
        // Convert relationships to search result format for formatting
        const searchResults = relationshipResult.relationships.map((rel, idx) => ({
          id: `rel-${idx}`,
          score: 1.0,
          metadata: {
            path: rel.location.file,
            name: rel.to,
            type: rel.type,
            startLine: rel.location.line,
          } as Record<string, unknown>,
        }));

        if (format === 'verbose') {
          return this.formatRelationshipsVerbose(relationshipResult.component, searchResults);
        }
        return this.formatRelationshipsCompact(relationshipResult.component, searchResults);
      }

      default:
        return `## Exploration Result\n\nUnknown result type`;
    }
  }

  /**
   * Search for code patterns using semantic search (direct execution)
   */
  private async searchPattern(
    query: string,
    limit: number,
    threshold: number,
    fileTypes: string[] | undefined,
    format: string
  ): Promise<string> {
    const results = await this.repositoryIndexer.search(query, {
      limit,
      scoreThreshold: threshold,
    });

    // Filter by file types if specified
    const filteredResults = fileTypes
      ? results.filter((r) => {
          const path = r.metadata.path as string;
          return fileTypes.some((ext) => path.endsWith(ext));
        })
      : results;

    if (filteredResults.length === 0) {
      return '## Pattern Search Results\n\nNo matching patterns found. Try:\n- Using different keywords\n- Lowering the similarity threshold\n- Removing file type filters';
    }

    if (format === 'verbose') {
      return this.formatPatternVerbose(query, filteredResults);
    }

    return this.formatPatternCompact(query, filteredResults);
  }

  /**
   * Find code similar to a reference file
   */
  private async findSimilar(
    filePath: string,
    limit: number,
    threshold: number,
    format: string
  ): Promise<string> {
    const results = await this.repositoryIndexer.search(`file:${filePath}`, {
      limit: limit + 1,
      scoreThreshold: threshold,
    });

    // Exclude the reference file itself
    const filteredResults = results.filter((r) => r.metadata.path !== filePath).slice(0, limit);

    if (filteredResults.length === 0) {
      return `## Similar Code Search\n\n**Reference:** \`${filePath}\`\n\nNo similar code found. The file may be unique in the repository.`;
    }

    if (format === 'verbose') {
      return this.formatSimilarVerbose(filePath, filteredResults);
    }

    return this.formatSimilarCompact(filePath, filteredResults);
  }

  /**
   * Find relationships for a code component
   */
  private async findRelationships(filePath: string, format: string): Promise<string> {
    // Search for references to this file
    const fileName = filePath.split('/').pop() || filePath;
    const results = await this.repositoryIndexer.search(`import ${fileName}`, {
      limit: 20,
      scoreThreshold: 0.6,
    });

    if (results.length === 0) {
      return `## Code Relationships\n\n**Component:** \`${filePath}\`\n\nNo relationships found. This component may not be imported by others.`;
    }

    if (format === 'verbose') {
      return this.formatRelationshipsVerbose(filePath, results);
    }

    return this.formatRelationshipsCompact(filePath, results);
  }

  /**
   * Format pattern results in compact mode
   */
  private formatPatternCompact(
    query: string,
    results: Array<{ id: string; score: number; metadata: Record<string, unknown> }>
  ): string {
    const lines = [
      '## Pattern Search Results',
      '',
      `**Query:** "${query}"`,
      `**Found:** ${results.length} matches`,
      '',
    ];

    for (const result of results.slice(0, 5)) {
      const score = (result.score * 100).toFixed(0);
      const type = result.metadata.type || 'code';
      const name = result.metadata.name || '(unnamed)';
      lines.push(`- **${name}** (${type}) - \`${result.metadata.path}\` [${score}%]`);
    }

    if (results.length > 5) {
      lines.push('', `_...and ${results.length - 5} more results_`);
    }

    return lines.join('\n');
  }

  /**
   * Format pattern results in verbose mode
   */
  private formatPatternVerbose(
    query: string,
    results: Array<{ id: string; score: number; metadata: Record<string, unknown> }>
  ): string {
    const lines = [
      '## Pattern Search Results',
      '',
      `**Query:** "${query}"`,
      `**Total Found:** ${results.length}`,
      '',
    ];

    for (const result of results) {
      const score = (result.score * 100).toFixed(1);
      const type = result.metadata.type || 'code';
      const name = result.metadata.name || '(unnamed)';
      const path = result.metadata.path;
      const startLine = result.metadata.startLine;
      const endLine = result.metadata.endLine;

      lines.push(`### ${name}`);
      lines.push(`- **Type:** ${type}`);
      lines.push(`- **File:** \`${path}\``);
      if (startLine && endLine) {
        lines.push(`- **Lines:** ${startLine}-${endLine}`);
      }
      lines.push(`- **Similarity:** ${score}%`);
      lines.push('');
    }

    return lines.join('\n');
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

  /**
   * Format relationships in compact mode
   */
  private formatRelationshipsCompact(
    filePath: string,
    results: Array<{ id: string; score: number; metadata: Record<string, unknown> }>
  ): string {
    const lines = [
      '## Code Relationships',
      '',
      `**Component:** \`${filePath}\``,
      `**Used by:** ${results.length} files`,
      '',
    ];

    for (const result of results.slice(0, 5)) {
      lines.push(`- \`${result.metadata.path}\``);
    }

    if (results.length > 5) {
      lines.push('', `_...and ${results.length - 5} more files_`);
    }

    return lines.join('\n');
  }

  /**
   * Format relationships in verbose mode
   */
  private formatRelationshipsVerbose(
    filePath: string,
    results: Array<{ id: string; score: number; metadata: Record<string, unknown> }>
  ): string {
    const lines = [
      '## Code Relationships Analysis',
      '',
      `**Component:** \`${filePath}\``,
      `**Total Dependencies:** ${results.length}`,
      '',
    ];

    for (const result of results) {
      const score = (result.score * 100).toFixed(1);
      const type = result.metadata.type || 'unknown';
      const name = result.metadata.name || '(unnamed)';

      lines.push(`### ${name}`);
      lines.push(`- **Path:** \`${result.metadata.path}\``);
      lines.push(`- **Type:** ${type}`);
      lines.push(`- **Relevance:** ${score}%`);
      if (result.metadata.startLine) {
        lines.push(`- **Location:** Line ${result.metadata.startLine}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
