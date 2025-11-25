/**
 * GitHub Adapter
 * Exposes GitHub context and search capabilities via MCP (dev_gh tool)
 */

import type {
  GitHubDocument,
  GitHubIndexer,
  GitHubSearchOptions,
  GitHubSearchResult,
} from '@lytics/dev-agent-subagents';
import { estimateTokensForText } from '../../formatters/utils';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';

export interface GitHubAdapterConfig {
  repositoryPath: string;
  // Either pass an initialized indexer OR paths for lazy initialization
  githubIndexer?: GitHubIndexer;
  vectorStorePath?: string;
  statePath?: string;
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

  private repositoryPath: string;
  public githubIndexer?: GitHubIndexer; // Public for cleanup in shutdown
  private vectorStorePath?: string;
  private statePath?: string;
  private defaultLimit: number;
  private defaultFormat: 'compact' | 'verbose';

  constructor(config: GitHubAdapterConfig) {
    super();
    this.repositoryPath = config.repositoryPath;
    this.githubIndexer = config.githubIndexer;
    this.vectorStorePath = config.vectorStorePath;
    this.statePath = config.statePath;
    this.defaultLimit = config.defaultLimit ?? 10;
    this.defaultFormat = config.defaultFormat ?? 'compact';

    // Validate: either githubIndexer OR both paths must be provided
    if (!this.githubIndexer && (!this.vectorStorePath || !this.statePath)) {
      throw new Error(
        'GitHubAdapter requires either githubIndexer or both vectorStorePath and statePath'
      );
    }
  }

  async initialize(context: AdapterContext): Promise<void> {
    context.logger.info('GitHubAdapter initialized', {
      repositoryPath: this.repositoryPath,
      defaultLimit: this.defaultLimit,
      defaultFormat: this.defaultFormat,
      lazyInit: !this.githubIndexer,
    });
  }

  /**
   * Lazy initialization of GitHubIndexer
   * Only creates the indexer when first needed
   */
  private async ensureGitHubIndexer(): Promise<GitHubIndexer> {
    if (this.githubIndexer) {
      return this.githubIndexer;
    }

    // Validate paths are available
    if (!this.vectorStorePath || !this.statePath) {
      throw new Error('GitHubAdapter not configured for lazy initialization');
    }

    // Lazy initialization
    const { GitHubIndexer: GitHubIndexerClass } = await import('@lytics/dev-agent-subagents');

    // Try to load repository from state file to avoid gh CLI call
    let repository: string | undefined;
    try {
      const fs = await import('node:fs/promises');
      const stateContent = await fs.readFile(this.statePath, 'utf-8');
      const state = JSON.parse(stateContent);
      repository = state.repository;
    } catch {
      // State file doesn't exist or can't be read
      // GitHubIndexer will try gh CLI as fallback
    }

    this.githubIndexer = new GitHubIndexerClass(
      {
        vectorStorePath: this.vectorStorePath,
        statePath: this.statePath,
        autoUpdate: false,
      },
      repository // Pass repository to avoid gh CLI call
    );

    await this.githubIndexer.initialize();
    return this.githubIndexer;
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_gh',
      description:
        'Search GitHub issues and pull requests using semantic search. Supports filtering by type, state, labels, and more.',
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
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const {
      action,
      query,
      number,
      type,
      state,
      labels,
      author,
      limit = this.defaultLimit,
      format = this.defaultFormat,
    } = args;

    // Validate action
    if (action !== 'search' && action !== 'context' && action !== 'related') {
      return {
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: 'Action must be "search", "context", or "related"',
        },
      };
    }

    // Validate action-specific requirements
    if (action === 'search' && (typeof query !== 'string' || query.trim().length === 0)) {
      return {
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Search action requires a query parameter',
        },
      };
    }

    if ((action === 'context' || action === 'related') && typeof number !== 'number') {
      return {
        success: false,
        error: {
          code: 'MISSING_NUMBER',
          message: `${action} action requires a number parameter`,
        },
      };
    }

    // Validate limit
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return {
        success: false,
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be between 1 and 100',
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

    try {
      context.logger.debug('Executing GitHub action', { action, query, number });

      let content: string;

      switch (action) {
        case 'search':
          content = await this.searchGitHub(
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
          break;
        case 'context':
          content = await this.getContext(number as number, format);
          break;
        case 'related':
          content = await this.getRelated(number as number, limit, format);
          break;
      }

      return {
        success: true,
        data: {
          action,
          query: query || number,
          format,
          content,
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
  ): Promise<string> {
    const indexer = await this.ensureGitHubIndexer();
    const results = await indexer.search(query, options);

    if (results.length === 0) {
      const noResultsMsg =
        '## GitHub Search Results\n\nNo matching issues or PRs found. Try:\n- Using different keywords\n- Removing filters (type, state, labels)\n- Re-indexing GitHub data with "dev gh index"';
      const tokens = estimateTokensForText(noResultsMsg);
      return `${noResultsMsg}\n\n🪙 ~${tokens} tokens`;
    }

    if (format === 'verbose') {
      return this.formatSearchVerbose(query, results, options);
    }

    return this.formatSearchCompact(query, results, options);
  }

  /**
   * Get full context for an issue/PR
   */
  private async getContext(number: number, format: string): Promise<string> {
    // Search for the specific issue/PR
    const indexer = await this.ensureGitHubIndexer();
    const results = await indexer.search(`#${number}`, { limit: 1 });

    if (results.length === 0) {
      throw new Error(`Issue/PR #${number} not found`);
    }

    const doc = results[0].document;

    if (format === 'verbose') {
      return this.formatContextVerbose(doc);
    }

    return this.formatContextCompact(doc);
  }

  /**
   * Find related issues and PRs
   */
  private async getRelated(number: number, limit: number, format: string): Promise<string> {
    // First get the main issue/PR
    const indexer = await this.ensureGitHubIndexer();
    const mainResults = await indexer.search(`#${number}`, { limit: 1 });

    if (mainResults.length === 0) {
      throw new Error(`Issue/PR #${number} not found`);
    }

    const mainDoc = mainResults[0].document;

    // Search for related items using the title
    const relatedResults = await indexer.search(mainDoc.title, { limit: limit + 1 });

    // Filter out the main item itself
    const related = relatedResults.filter((r) => r.document.number !== number).slice(0, limit);

    if (related.length === 0) {
      return `## Related Issues/PRs\n\n**#${number}: ${mainDoc.title}**\n\nNo related issues or PRs found.`;
    }

    if (format === 'verbose') {
      return this.formatRelatedVerbose(mainDoc, related);
    }

    return this.formatRelatedCompact(mainDoc, related);
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

    const content = lines.join('\n');
    const tokens = estimateTokensForText(content);
    return `${content}\n\n🪙 ~${tokens} tokens`;
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

    const content = lines.join('\n');
    const tokens = estimateTokensForText(content);
    return `${content}\n\n🪙 ~${tokens} tokens`;
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

    const content = lines.join('\n');
    const tokens = estimateTokensForText(content);
    return `${content}\n\n🪙 ~${tokens} tokens`;
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

    const content = lines.join('\n');
    const tokens = estimateTokensForText(content);
    return `${content}\n\n🪙 ~${tokens} tokens`;
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
