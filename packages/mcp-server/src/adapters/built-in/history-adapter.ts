/**
 * History Adapter
 * Provides semantic search over git commit history via the dev_history tool
 */

import type { GitCommit, GitIndexer, LocalGitExtractor } from '@lytics/dev-agent-core';
import { estimateTokensForText, startTimer } from '../../formatters/utils';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';

/**
 * History adapter configuration
 */
export interface HistoryAdapterConfig {
  /**
   * Git indexer instance for semantic search
   */
  gitIndexer: GitIndexer;

  /**
   * Git extractor for direct file history
   */
  gitExtractor: LocalGitExtractor;

  /**
   * Default result limit
   */
  defaultLimit?: number;

  /**
   * Default token budget
   */
  defaultTokenBudget?: number;
}

/**
 * History Adapter
 * Implements the dev_history tool for querying git commit history
 */
export class HistoryAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'history-adapter',
    version: '1.0.0',
    description: 'Git history semantic search adapter',
    author: 'Dev-Agent Team',
  };

  private gitIndexer: GitIndexer;
  private gitExtractor: LocalGitExtractor;
  private config: Required<HistoryAdapterConfig>;

  constructor(config: HistoryAdapterConfig) {
    super();
    this.gitIndexer = config.gitIndexer;
    this.gitExtractor = config.gitExtractor;
    this.config = {
      gitIndexer: config.gitIndexer,
      gitExtractor: config.gitExtractor,
      defaultLimit: config.defaultLimit ?? 10,
      defaultTokenBudget: config.defaultTokenBudget ?? 2000,
    };
  }

  async initialize(context: AdapterContext): Promise<void> {
    context.logger.info('HistoryAdapter initialized', {
      defaultLimit: this.config.defaultLimit,
      defaultTokenBudget: this.config.defaultTokenBudget,
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_history',
      description:
        'Understand WHY code looks the way it does. Search commits by concept ("auth refactor", "bug fix") or get file history. ' +
        'Use after finding code with dev_search to understand its evolution.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Semantic search query over commit messages (e.g., "authentication token expiry fix")',
          },
          file: {
            type: 'string',
            description: 'Get history for a specific file path (e.g., "src/auth/token.ts")',
          },
          limit: {
            type: 'number',
            description: `Maximum number of commits to return (default: ${this.config.defaultLimit})`,
            minimum: 1,
            maximum: 50,
            default: this.config.defaultLimit,
          },
          since: {
            type: 'string',
            description:
              'Only show commits after this date (ISO format or relative like "2 weeks ago")',
          },
          author: {
            type: 'string',
            description: 'Filter by author email',
          },
          tokenBudget: {
            type: 'number',
            description: `Maximum tokens for output (default: ${this.config.defaultTokenBudget})`,
            minimum: 100,
            maximum: 10000,
            default: this.config.defaultTokenBudget,
          },
        },
        // At least one of query or file is required
        anyOf: [{ required: ['query'] }, { required: ['file'] }],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const {
      query,
      file,
      limit = this.config.defaultLimit,
      since,
      author,
      tokenBudget = this.config.defaultTokenBudget,
    } = args as {
      query?: string;
      file?: string;
      limit?: number;
      since?: string;
      author?: string;
      tokenBudget?: number;
    };

    // Validate inputs
    if (!query && !file) {
      return {
        success: false,
        error: {
          code: 'MISSING_INPUT',
          message: 'Either "query" or "file" must be provided',
        },
      };
    }

    if (typeof limit !== 'number' || limit < 1 || limit > 50) {
      return {
        success: false,
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be a number between 1 and 50',
        },
      };
    }

    try {
      const timer = startTimer();
      context.logger.debug('Executing history query', { query, file, limit, since, author });

      let commits: GitCommit[];
      let searchType: 'semantic' | 'file';

      if (query) {
        // Semantic search over commit messages
        searchType = 'semantic';
        commits = await this.gitIndexer.search(query, { limit });
      } else {
        // File-specific history
        searchType = 'file';
        commits = await this.gitExtractor.getCommits({
          path: file,
          limit,
          since,
          author,
          follow: true,
          noMerges: true,
        });
      }

      // Format output with token budget
      const content = this.formatCommits(commits, tokenBudget, searchType, query || file || '');
      const duration_ms = timer.elapsed();

      context.logger.info('History query completed', {
        searchType,
        commitsFound: commits.length,
        duration_ms,
      });

      const tokens = estimateTokensForText(content);

      return {
        success: true,
        data: {
          searchType,
          query: query || undefined,
          file: file || undefined,
          commits: commits.map((c) => ({
            hash: c.shortHash,
            subject: c.subject,
            author: c.author.name,
            date: c.author.date,
            filesChanged: c.stats.filesChanged,
          })),
          content,
        },
        metadata: {
          tokens,
          duration_ms,
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };
    } catch (error) {
      context.logger.error('History query failed', { error });
      return {
        success: false,
        error: {
          code: 'HISTORY_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  /**
   * Format commits into readable output with token budget
   */
  private formatCommits(
    commits: GitCommit[],
    tokenBudget: number,
    searchType: 'semantic' | 'file',
    searchTerm: string
  ): string {
    const lines: string[] = [];

    // Header
    if (searchType === 'semantic') {
      lines.push(`# Git History: "${searchTerm}"`);
      lines.push(`Found ${commits.length} relevant commits`);
    } else {
      lines.push(`# File History: ${searchTerm}`);
      lines.push(`Showing ${commits.length} commits`);
    }
    lines.push('');

    if (commits.length === 0) {
      lines.push('*No commits found*');
      return lines.join('\n');
    }

    // Track token usage
    let tokensUsed = estimateTokensForText(lines.join('\n'));
    const reserveTokens = 50; // For footer

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const commitLines = this.formatSingleCommit(commit, i === 0);

      const commitText = commitLines.join('\n');
      const commitTokens = estimateTokensForText(commitText);

      // Check if we can fit this commit
      if (tokensUsed + commitTokens + reserveTokens > tokenBudget && i > 0) {
        lines.push('');
        lines.push(`*... ${commits.length - i} more commits (token budget reached)*`);
        break;
      }

      lines.push(...commitLines);
      tokensUsed += commitTokens;
    }

    return lines.join('\n');
  }

  /**
   * Format a single commit
   */
  private formatSingleCommit(commit: GitCommit, includeBody: boolean): string[] {
    const lines: string[] = [];

    // Commit header
    const date = new Date(commit.author.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    lines.push(`## ${commit.shortHash} - ${commit.subject}`);
    lines.push(`**Author:** ${commit.author.name} | **Date:** ${date}`);

    // Stats
    const stats = [];
    if (commit.stats.filesChanged > 0) {
      stats.push(`${commit.stats.filesChanged} files`);
    }
    if (commit.stats.additions > 0) {
      stats.push(`+${commit.stats.additions}`);
    }
    if (commit.stats.deletions > 0) {
      stats.push(`-${commit.stats.deletions}`);
    }
    if (stats.length > 0) {
      lines.push(`**Changes:** ${stats.join(', ')}`);
    }

    // Issue/PR references
    const refs = [];
    if (commit.refs.issueRefs.length > 0) {
      refs.push(`Issues: ${commit.refs.issueRefs.map((n: number) => `#${n}`).join(', ')}`);
    }
    if (commit.refs.prRefs.length > 0) {
      refs.push(`PRs: ${commit.refs.prRefs.map((n: number) => `#${n}`).join(', ')}`);
    }
    if (refs.length > 0) {
      lines.push(`**Refs:** ${refs.join(' | ')}`);
    }

    // Body (for first commit only to save tokens)
    if (includeBody && commit.body) {
      lines.push('');
      // Truncate body if too long
      const body = commit.body.length > 200 ? `${commit.body.slice(0, 200)}...` : commit.body;
      lines.push(body);
    }

    // Files changed (abbreviated)
    if (commit.files.length > 0) {
      lines.push('');
      lines.push('**Files:**');
      const filesToShow = commit.files.slice(0, 5);
      for (const file of filesToShow) {
        const status = file.status === 'added' ? '+' : file.status === 'deleted' ? '-' : '~';
        lines.push(`- ${status} ${file.path}`);
      }
      if (commit.files.length > 5) {
        lines.push(`  *... and ${commit.files.length - 5} more files*`);
      }
    }

    lines.push('');
    return lines;
  }

  estimateTokens(args: Record<string, unknown>): number {
    const { limit = this.config.defaultLimit, tokenBudget = this.config.defaultTokenBudget } = args;
    // Estimate based on limit and token budget
    return Math.min((limit as number) * 100, tokenBudget as number);
  }
}
