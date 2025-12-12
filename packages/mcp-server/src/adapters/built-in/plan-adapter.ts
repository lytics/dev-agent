/**
 * Plan Adapter
 * Assembles context for development planning from GitHub issues
 *
 * Philosophy: Provide raw, structured context - let the LLM do the reasoning
 */

import type { GitIndexer, RepositoryIndexer } from '@lytics/dev-agent-core';
import type { ContextAssemblyOptions } from '@lytics/dev-agent-subagents';
import { assembleContext, formatContextPackage } from '@lytics/dev-agent-subagents';
import { estimateTokensForText, startTimer } from '../../formatters/utils';
import { PlanArgsSchema } from '../../schemas/index.js';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';
import { validateArgs } from '../validation.js';

/**
 * Plan adapter configuration
 */
export interface PlanAdapterConfig {
  /**
   * Repository indexer instance (for finding relevant code)
   */
  repositoryIndexer: RepositoryIndexer;

  /**
   * Git indexer instance (for finding relevant commits)
   */
  gitIndexer?: GitIndexer;

  /**
   * Repository path
   */
  repositoryPath: string;

  /**
   * Default format mode
   */
  defaultFormat?: 'compact' | 'verbose';

  /**
   * Timeout for context assembly (milliseconds)
   */
  timeout?: number;
}

/**
 * Plan Adapter
 * Implements the dev_plan tool for assembling implementation context from GitHub issues
 */
export class PlanAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'plan-adapter',
    version: '2.1.0',
    description: 'GitHub issue context assembler with git history',
    author: 'Dev-Agent Team',
  };

  private indexer: RepositoryIndexer;
  private gitIndexer?: GitIndexer;
  private repositoryPath: string;
  private defaultFormat: 'compact' | 'verbose';
  private timeout: number;

  constructor(config: PlanAdapterConfig) {
    super();
    this.indexer = config.repositoryIndexer;
    this.gitIndexer = config.gitIndexer;
    this.repositoryPath = config.repositoryPath;
    this.defaultFormat = config.defaultFormat ?? 'compact';
    this.timeout = config.timeout ?? 60000; // 60 seconds default
  }

  async initialize(context: AdapterContext): Promise<void> {
    this.initializeBase(context);

    context.logger.info('PlanAdapter initialized', {
      repositoryPath: this.repositoryPath,
      defaultFormat: this.defaultFormat,
      timeout: this.timeout,
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_plan',
      description:
        'When implementing a GitHub issue, use this to get ALL context in one call: issue details, relevant code, similar patterns, ' +
        'and related commits. Saves multiple tool calls vs searching manually.',
      inputSchema: {
        type: 'object',
        properties: {
          issue: {
            type: 'number',
            description: 'GitHub issue number (e.g., 29)',
          },
          format: {
            type: 'string',
            enum: ['compact', 'verbose'],
            description: 'Output format: "compact" for markdown (default), "verbose" for JSON',
            default: this.defaultFormat,
          },
          includeCode: {
            type: 'boolean',
            description: 'Include relevant code snippets (default: true)',
            default: true,
          },
          includePatterns: {
            type: 'boolean',
            description: 'Include detected codebase patterns (default: true)',
            default: true,
          },
          tokenBudget: {
            type: 'number',
            description: 'Maximum tokens for output (default: 4000)',
            default: 4000,
          },
          includeGitHistory: {
            type: 'boolean',
            description: 'Include related git commits (default: true)',
            default: true,
          },
        },
        required: ['issue'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod
    const validation = validateArgs(PlanArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { issue, format, includeCode, includePatterns, tokenBudget, includeGitHistory } =
      validation.data;

    try {
      const timer = startTimer();

      context.logger.debug('Assembling context', {
        issue,
        format,
        includeCode,
        includePatterns,
        includeGitHistory,
        tokenBudget,
      });

      const options: ContextAssemblyOptions = {
        includeCode: includeCode as boolean,
        includePatterns: includePatterns as boolean,
        includeHistory: false, // TODO: Enable when GitHub indexer integration is ready
        includeGitHistory: (includeGitHistory as boolean) && !!this.gitIndexer,
        maxCodeResults: 10,
        maxGitCommitResults: 5,
        tokenBudget: tokenBudget as number,
      };

      const contextPackage = await this.withTimeout(
        assembleContext(
          issue as number,
          { indexer: this.indexer, gitIndexer: this.gitIndexer },
          this.repositoryPath,
          options
        ),
        this.timeout
      );

      // Format output
      const content =
        format === 'verbose'
          ? JSON.stringify(contextPackage, null, 2)
          : formatContextPackage(contextPackage);

      const tokens = estimateTokensForText(content);
      const duration_ms = timer.elapsed();

      context.logger.info('Context assembled', {
        issue,
        codeResults: contextPackage.relevantCode.length,
        commitResults: contextPackage.relatedCommits.length,
        hasPatterns: !!contextPackage.codebasePatterns.testPattern,
        tokens,
        duration_ms,
      });

      return {
        success: true,
        data: {
          issue,
          format,
          content,
          context: format === 'verbose' ? contextPackage : undefined,
        },
        metadata: {
          tokens,
          duration_ms,
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };
    } catch (error) {
      context.logger.error('Context assembly failed', { error });
      return this.handleError(error, issue as number);
    }
  }

  /**
   * Handle errors with appropriate error codes
   */
  private handleError(error: unknown, issueNumber: number): ToolResult {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return {
          success: false,
          error: {
            code: 'CONTEXT_TIMEOUT',
            message: `Context assembly timeout after ${this.timeout / 1000}s.`,
            suggestion: 'Try reducing tokenBudget or disabling some options.',
          },
        };
      }

      if (error.message.includes('not found') || error.message.includes('404')) {
        return {
          success: false,
          error: {
            code: 'ISSUE_NOT_FOUND',
            message: `GitHub issue #${issueNumber} not found`,
            suggestion: 'Check the issue number or ensure you are in a GitHub repository.',
          },
        };
      }

      if (error.message.includes('GitHub') || error.message.includes('gh')) {
        return {
          success: false,
          error: {
            code: 'GITHUB_ERROR',
            message: error.message,
            suggestion: 'Ensure GitHub CLI (gh) is installed and authenticated.',
          },
        };
      }
    }

    return {
      success: false,
      error: {
        code: 'CONTEXT_ASSEMBLY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }

  /**
   * Execute a promise with a timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  estimateTokens(args: Record<string, unknown>): number {
    const { tokenBudget = 4000 } = args;
    return tokenBudget as number;
  }
}
