/**
 * GitHub Adapter
 * Exposes GitHub context and search capabilities via MCP (dev_gh tool)
 */

import type { GitHubService } from '@lytics/dev-agent-core';
import type {
  GitHubDocument,
  GitHubSearchOptions,
  GitHubSearchResult,
} from '@lytics/dev-agent-types/github';
import { estimateTokensForText } from '../../formatters/utils';
import { GitHubArgsSchema, type GitHubOutput, GitHubOutputSchema } from '../../schemas/index.js';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';
import { validateArgs } from '../validation.js';

export interface GitHubAdapterConfig {
  githubService: GitHubService;
  repositoryPath: string;
  defaultLimit?: number;
  defaultFormat?: 'compact' | 'verbose';
}

/**
 * GitHubAdapter - GitHub issues and PRs search and context
 *
 * Provides semantic search across GitHub issues/PRs and contextual information
 * through the dev_gh MCP tool.
 */
export class GitHubAdapter extends ToolAdapter {
  metadata = {
    name: 'github',
    version: '1.0.0',
    description: 'GitHub issues and PRs search and context',
  };

  private githubService: GitHubService;
  private repositoryPath: string;
  private defaultLimit: number;
  private defaultFormat: 'compact' | 'verbose';

  constructor(config: GitHubAdapterConfig) {
    super();
    this.githubService = config.githubService;
    this.repositoryPath = config.repositoryPath;
    this.defaultLimit = config.defaultLimit ?? 10;
    this.defaultFormat = config.defaultFormat ?? 'compact';
  }

  async initialize(context: AdapterContext): Promise<void> {
    context.logger.info('GitHubAdapter initialized', {
      repositoryPath: this.repositoryPath,
      defaultLimit: this.defaultLimit,
      defaultFormat: this.defaultFormat,
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_gh',
      description:
        'Search GitHub issues/PRs by MEANING, not just keywords - finds relevant issues even without exact terms. ' +
        'Actions: "search" (semantic query), "context" (full details for issue #), "related" (find similar issues). ' +
        'Use when exploring project history or finding past discussions about a topic.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['search', 'context', 'related'],
            description:
              'GitHub action: "search" (semantic search), "context" (get full context for issue/PR), "related" (find related issues/PRs)',
          },
          query: {
            type: 'string',
            description: 'Search query (for search action)',
          },
          number: {
            type: 'number',
            description: 'Issue or PR number (for context/related actions)',
          },
          type: {
            type: 'string',
            enum: ['issue', 'pull_request'],
            description: 'Filter by document type (default: both)',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'merged'],
            description: 'Filter by state (default: all states)',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by labels (e.g., ["bug", "enhancement"])',
          },
          author: {
            type: 'string',
            description: 'Filter by author username',
          },
          limit: {
            type: 'number',
            description: `Maximum number of results (default: ${this.defaultLimit})`,
            default: this.defaultLimit,
          },
          format: {
            type: 'string',
            enum: ['compact', 'verbose'],
            description:
              'Output format: "compact" for summaries (default), "verbose" for full details',
            default: this.defaultFormat,
          },
        },
        required: ['action'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The action that was executed',
          },
          format: {
            type: 'string',
            description: 'The output format used',
          },
          content: {
            type: 'string',
            description: 'Formatted GitHub data',
          },
          resultsTotal: {
            type: 'number',
            description: 'Total number of results found (for search/related actions)',
          },
          resultsReturned: {
            type: 'number',
            description: 'Number of results returned (for search/related actions)',
          },
        },
        required: ['action', 'format', 'content'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod
    const validation = validateArgs(GitHubArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { action, query, number, type, state, labels, author, limit, format } = validation.data;

    try {
      const startTime = Date.now();
      context.logger.debug('Executing GitHub action', { action, query, number });

      let content: string;
      let resultsTotal = 0;
      let resultsReturned = 0;

      switch (action) {
        case 'search': {
          const result = await this.searchGitHub(
            query as string,
            {
              type: type as 'issue' | 'pull_request' | undefined,
              state: state as 'open' | 'closed' | 'merged' | undefined,
              labels: labels as string[] | undefined,
              author: author as string | undefined,
              limit,
            },
            format
          );
          content = result.content;
          resultsTotal = result.resultsTotal;
          resultsReturned = result.resultsReturned;
          break;
        }
        case 'context':
          content = await this.getIssueContext(number as number, format);
          resultsTotal = 1;
          resultsReturned = 1;
          break;
        case 'related': {
          const result = await this.getRelated(number as number, limit, format);
          content = result.content;
          resultsTotal = result.resultsTotal;
          resultsReturned = result.resultsReturned;
          break;
        }
      }

      const duration_ms = Date.now() - startTime;
      const tokens = estimateTokensForText(content);

      // Validate output with Zod
      const outputData: GitHubOutput = {
        action,
        format,
        content,
        resultsTotal: resultsTotal > 0 ? resultsTotal : undefined,
        resultsReturned: resultsReturned > 0 ? resultsReturned : undefined,
      };

      const outputValidation = GitHubOutputSchema.safeParse(outputData);
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
          results_total: resultsTotal,
          results_returned: resultsReturned,
        },
      };
    } catch (error) {
      context.logger.error('GitHub action failed', { error });

      if (error instanceof Error) {
        if (error.message.includes('not indexed')) {
          return {
            success: false,
            error: {
              code: 'INDEX_NOT_READY',
              message: 'GitHub index is not ready',
              suggestion: 'Run "dev gh index" to index GitHub issues and PRs.',
            },
          };
        }

        if (error.message.includes('not found')) {
          return {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `GitHub issue/PR #${number} not found`,
              suggestion: 'Check the issue/PR number or re-index GitHub data.',
            },
          };
        }
      }

      return {
        success: false,
        error: {
          code: 'GITHUB_ERROR',
          message: error instanceof Error ? error.message : 'Unknown GitHub error',
        },
      };
    }
  }

  /**
   * Search GitHub issues and PRs
   */
  private async searchGitHub(
    query: string,
    options: GitHubSearchOptions,
    format: string
  ): Promise<{ content: string; resultsTotal: number; resultsReturned: number }> {
    const results = await this.githubService.search(query, options);

    if (results.length === 0) {
      const content =
        '## GitHub Search Results\n\nNo matching issues or PRs found. Try:\n- Using different keywords\n- Removing filters (type, state, labels)\n- Re-indexing GitHub data with "dev gh index"';
      return { content, resultsTotal: 0, resultsReturned: 0 };
    }

    const content =
      format === 'verbose'
        ? this.formatSearchVerbose(query, results, options)
        : this.formatSearchCompact(query, results, options);

    return {
      content,
      resultsTotal: results.length,
      resultsReturned: Math.min(results.length, options.limit ?? this.defaultLimit),
    };
  }

  /**
   * Get full context for an issue/PR
   */
  private async getIssueContext(number: number, format: string): Promise<string> {
    // Get document using the service
    const doc = await this.githubService.getContext(number);

    if (!doc) {
      throw new Error(`Issue/PR #${number} not found`);
    }

    if (format === 'verbose') {
      return this.formatContextVerbose(doc);
    }

    return this.formatContextCompact(doc);
  }

  /**
   * Find related issues and PRs
   */
  private async getRelated(
    number: number,
    limit: number,
    format: string
  ): Promise<{ content: string; resultsTotal: number; resultsReturned: number }> {
    // Get the main document
    const mainDoc = await this.githubService.getContext(number);

    if (!mainDoc) {
      throw new Error(`Issue/PR #${number} not found`);
    }

    // Get related items using the service
    const related = await this.githubService.findRelated(number, limit);

    if (related.length === 0) {
      return {
        content: `## Related Issues/PRs\n\n**#${number}: ${mainDoc.title}**\n\nNo related issues or PRs found.`,
        resultsTotal: 0,
        resultsReturned: 0,
      };
    }

    const content =
      format === 'verbose'
        ? this.formatRelatedVerbose(mainDoc, related)
        : this.formatRelatedCompact(mainDoc, related);

    return {
      content,
      resultsTotal: related.length,
      resultsReturned: related.length,
    };
  }

  /**
   * Format search results in compact mode
   */
  private formatSearchCompact(
    query: string,
    results: GitHubSearchResult[],
    options: GitHubSearchOptions
  ): string {
    const filters: string[] = [];
    if (options.type) filters.push(`type:${options.type}`);
    if (options.state) filters.push(`state:${options.state}`);
    if (options.labels?.length) filters.push(`labels:[${options.labels.join(',')}]`);
    if (options.author) filters.push(`author:${options.author}`);

    const lines = [
      '## GitHub Search Results',
      '',
      `**Query:** "${query}"`,
      filters.length > 0 ? `**Filters:** ${filters.join(', ')}` : null,
      `**Found:** ${results.length} results`,
      '',
    ].filter(Boolean) as string[];

    for (const result of results.slice(0, 5)) {
      const doc = result.document;
      const score = (result.score * 100).toFixed(0);
      const icon = doc.type === 'issue' ? '🔵' : '🟣';
      const stateIcon = doc.state === 'open' ? '○' : doc.state === 'merged' ? '●' : '×';
      lines.push(`- ${icon} ${stateIcon} **#${doc.number}**: ${doc.title} [${score}%]`);
    }

    if (results.length > 5) {
      lines.push('', `_...and ${results.length - 5} more results_`);
    }

    return lines.join('\n');
  }

  /**
   * Format search results in verbose mode
   */
  private formatSearchVerbose(
    query: string,
    results: GitHubSearchResult[],
    options: GitHubSearchOptions
  ): string {
    const filters: string[] = [];
    if (options.type) filters.push(`type:${options.type}`);
    if (options.state) filters.push(`state:${options.state}`);
    if (options.labels?.length) filters.push(`labels:[${options.labels.join(',')}]`);
    if (options.author) filters.push(`author:${options.author}`);

    const lines = [
      '## GitHub Search Results',
      '',
      `**Query:** "${query}"`,
      filters.length > 0 ? `**Filters:** ${filters.join(', ')}` : null,
      `**Total Found:** ${results.length}`,
      '',
    ].filter(Boolean) as string[];

    for (const result of results) {
      const doc = result.document;
      const score = (result.score * 100).toFixed(1);
      const typeLabel = doc.type === 'issue' ? 'Issue' : 'Pull Request';

      lines.push(`### #${doc.number}: ${doc.title}`);
      lines.push(`- **Type:** ${typeLabel}`);
      lines.push(`- **State:** ${doc.state}`);
      lines.push(`- **Author:** ${doc.author}`);
      if (doc.labels.length > 0) {
        lines.push(`- **Labels:** ${doc.labels.join(', ')}`);
      }
      lines.push(`- **Created:** ${new Date(doc.createdAt).toLocaleDateString()}`);
      lines.push(`- **Relevance:** ${score}%`);
      lines.push(`- **URL:** ${doc.url}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format context in compact mode
   */
  private formatContextCompact(doc: GitHubDocument): string {
    const typeLabel = doc.type === 'issue' ? 'Issue' : 'Pull Request';
    const stateIcon =
      doc.state === 'open' ? '○ Open' : doc.state === 'merged' ? '● Merged' : '× Closed';

    const lines = [
      `## ${typeLabel} #${doc.number}`,
      '',
      `**${doc.title}**`,
      '',
      `**Status:** ${stateIcon}`,
      `**Author:** ${doc.author}`,
      doc.labels.length > 0 ? `**Labels:** ${doc.labels.join(', ')}` : null,
      `**Created:** ${new Date(doc.createdAt).toLocaleDateString()}`,
      '',
      '**Description:**',
      doc.body.slice(0, 300) + (doc.body.length > 300 ? '...' : ''),
      '',
      `**URL:** ${doc.url}`,
    ].filter(Boolean) as string[];

    return lines.join('\n');
  }

  /**
   * Format context in verbose mode
   */
  private formatContextVerbose(doc: GitHubDocument): string {
    const typeLabel = doc.type === 'issue' ? 'Issue' : 'Pull Request';
    const stateIcon =
      doc.state === 'open' ? '○ Open' : doc.state === 'merged' ? '● Merged' : '× Closed';

    const lines = [
      `## ${typeLabel} #${doc.number}: ${doc.title}`,
      '',
      `**Status:** ${stateIcon}`,
      `**Author:** ${doc.author}`,
      doc.labels.length > 0 ? `**Labels:** ${doc.labels.join(', ')}` : null,
      `**Created:** ${new Date(doc.createdAt).toLocaleString()}`,
      `**Updated:** ${new Date(doc.updatedAt).toLocaleString()}`,
      doc.closedAt ? `**Closed:** ${new Date(doc.closedAt).toLocaleString()}` : null,
      doc.mergedAt ? `**Merged:** ${new Date(doc.mergedAt).toLocaleString()}` : null,
      doc.headBranch ? `**Branch:** ${doc.headBranch} → ${doc.baseBranch}` : null,
      `**Comments:** ${doc.comments}`,
      '',
      '**Description:**',
      '',
      doc.body,
      '',
      doc.relatedIssues.length > 0
        ? `**Related Issues:** ${doc.relatedIssues.map((n: number) => `#${n}`).join(', ')}`
        : null,
      doc.relatedPRs.length > 0
        ? `**Related PRs:** ${doc.relatedPRs.map((n: number) => `#${n}`).join(', ')}`
        : null,
      doc.linkedFiles.length > 0
        ? `**Linked Files:** ${doc.linkedFiles.map((f: string) => `\`${f}\``).join(', ')}`
        : null,
      doc.mentions.length > 0
        ? `**Mentions:** ${doc.mentions.map((m: string) => `@${m}`).join(', ')}`
        : null,
      '',
      `**URL:** ${doc.url}`,
    ].filter(Boolean) as string[];

    return lines.join('\n');
  }

  /**
   * Format related items in compact mode
   */
  private formatRelatedCompact(mainDoc: GitHubDocument, related: GitHubSearchResult[]): string {
    const lines = [
      '## Related Issues/PRs',
      '',
      `**#${mainDoc.number}: ${mainDoc.title}**`,
      '',
      `**Found:** ${related.length} related items`,
      '',
    ];

    for (const result of related.slice(0, 5)) {
      const doc = result.document;
      const score = (result.score * 100).toFixed(0);
      const icon = doc.type === 'issue' ? '🔵' : '🟣';
      lines.push(`- ${icon} **#${doc.number}**: ${doc.title} [${score}% similar]`);
    }

    if (related.length > 5) {
      lines.push('', `_...and ${related.length - 5} more items_`);
    }

    return lines.join('\n');
  }

  /**
   * Format related items in verbose mode
   */
  private formatRelatedVerbose(mainDoc: GitHubDocument, related: GitHubSearchResult[]): string {
    const lines = [
      '## Related Issues and Pull Requests',
      '',
      `**Reference: #${mainDoc.number} - ${mainDoc.title}**`,
      '',
      `**Total Related:** ${related.length}`,
      '',
    ];

    for (const result of related) {
      const doc = result.document;
      const score = (result.score * 100).toFixed(1);
      const typeLabel = doc.type === 'issue' ? 'Issue' : 'Pull Request';

      lines.push(`### #${doc.number}: ${doc.title}`);
      lines.push(`- **Type:** ${typeLabel}`);
      lines.push(`- **State:** ${doc.state}`);
      lines.push(`- **Author:** ${doc.author}`);
      if (doc.labels.length > 0) {
        lines.push(`- **Labels:** ${doc.labels.join(', ')}`);
      }
      lines.push(`- **Similarity:** ${score}%`);
      lines.push(`- **URL:** ${doc.url}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}
