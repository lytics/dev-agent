/**
 * GitHub Context Agent
 * Provides rich context from GitHub issues, PRs, and discussions
 */

import type { Agent, AgentContext, Message } from '../types';
import { GitHubIndexer } from './indexer';
import type {
  GitHubContextError,
  GitHubContextRequest,
  GitHubContextResult,
  GitHubIndexOptions,
} from './types';

export interface GitHubAgentConfig {
  repositoryPath: string;
  vectorStorePath: string; // Path to LanceDB storage for GitHub data
  statePath?: string; // Path to state file (default: .dev-agent/github-state.json)
  autoUpdate?: boolean; // Enable auto-updates (default: true)
  staleThreshold?: number; // Stale threshold in ms (default: 15 minutes)
}

export class GitHubAgent implements Agent {
  name = 'github';
  capabilities = ['github-index', 'github-search', 'github-context', 'github-related'];

  private context?: AgentContext;
  private indexer?: GitHubIndexer;
  private config: GitHubAgentConfig;

  constructor(config: GitHubAgentConfig) {
    this.config = config;
  }

  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
    this.name = context.agentName;

    this.indexer = new GitHubIndexer(
      {
        vectorStorePath: this.config.vectorStorePath,
        statePath: this.config.statePath,
        autoUpdate: this.config.autoUpdate,
        staleThreshold: this.config.staleThreshold,
      },
      this.config.repositoryPath
    );

    await this.indexer.initialize();

    context.logger.info('GitHub agent initialized', {
      capabilities: this.capabilities,
      repository: this.config.repositoryPath,
    });
  }

  async handleMessage(message: Message): Promise<Message | null> {
    if (!this.context || !this.indexer) {
      throw new Error('GitHub agent not initialized');
    }

    const { logger } = this.context;

    if (message.type !== 'request') {
      logger.debug('Ignoring non-request message', { type: message.type });
      return null;
    }

    try {
      const request = message.payload as unknown as GitHubContextRequest;
      logger.debug('Processing GitHub request', { action: request.action });

      let result: GitHubContextResult | GitHubContextError;

      switch (request.action) {
        case 'index':
          result = await this.handleIndex(request.indexOptions);
          break;
        case 'search':
          result = await this.handleSearch(request.query || '', request.searchOptions);
          break;
        case 'context':
          if (typeof request.issueNumber !== 'number') {
            result = { action: 'context', error: 'issueNumber is required' };
          } else {
            result = await this.handleGetContext(request.issueNumber);
          }
          break;
        case 'related':
          if (typeof request.issueNumber !== 'number') {
            result = { action: 'related', error: 'issueNumber is required' };
          } else {
            result = await this.handleFindRelated(request.issueNumber);
          }
          break;
        default:
          result = {
            action: 'index',
            error: `Unknown action: ${(request as GitHubContextRequest).action}`,
          };
      }

      return {
        id: `${message.id}-response`,
        type: 'response',
        sender: this.name,
        recipient: message.sender,
        correlationId: message.id,
        payload: result as unknown as Record<string, unknown>,
        priority: message.priority,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(errorMsg);

      const errorResult = {
        action: 'index' as const,
        error: errorMsg,
      };

      return {
        id: `${message.id}-error`,
        type: 'response',
        sender: this.name,
        recipient: message.sender,
        correlationId: message.id,
        payload: errorResult as Record<string, unknown>,
        priority: message.priority,
        timestamp: Date.now(),
      };
    }
  }

  private async handleIndex(options?: GitHubIndexOptions): Promise<GitHubContextResult> {
    if (!this.indexer) throw new Error('Indexer not initialized');
    const stats = await this.indexer.index(options);
    return {
      action: 'index',
      stats,
    };
  }

  private async handleSearch(
    query: string,
    options?: { limit?: number }
  ): Promise<GitHubContextResult> {
    if (!this.indexer) throw new Error('Indexer not initialized');
    const results = await this.indexer.search(query, options);
    return {
      action: 'search',
      results,
    };
  }

  private async handleGetContext(issueNumber: number): Promise<GitHubContextResult> {
    if (!this.indexer) throw new Error('Indexer not initialized');
    const context = await this.indexer.getContext(issueNumber);
    return {
      action: 'context',
      context: context || undefined,
    };
  }

  private async handleFindRelated(issueNumber: number): Promise<GitHubContextResult> {
    if (!this.indexer) throw new Error('Indexer not initialized');
    const related = await this.indexer.findRelated(issueNumber);
    return {
      action: 'related',
      related,
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.indexer !== undefined;
  }

  async shutdown(): Promise<void> {
    if (this.context) {
      this.context.logger.info('GitHub agent shutting down');
    }
    this.indexer = undefined;
  }
}
