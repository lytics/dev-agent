/**
 * Coordinator Service
 *
 * Shared service for setting up and managing the SubagentCoordinator.
 * Used by both MCP server and CLI commands that need agent coordination.
 */

import type { Logger } from '@lytics/kero';
import type { RepositoryIndexer } from '../indexer/index.js';

/**
 * Minimal coordinator interface
 *
 * This matches the SubagentCoordinator from @lytics/dev-agent-subagents
 * but avoids cross-package import issues. TypeScript's structural typing
 * ensures compatibility at runtime.
 *
 * Only defines methods we actually use in CoordinatorService.
 */
export interface SubagentCoordinator {
  /**
   * Register a subagent with the coordinator
   */
  registerAgent(agent: unknown): Promise<void>;

  /**
   * Get the context manager for setting up indexer
   */
  getContextManager(): {
    setIndexer(indexer: RepositoryIndexer): void;
  };

  /**
   * Graceful shutdown (optional for future use)
   */
  shutdown?(): Promise<void>;
}

export interface CoordinatorServiceConfig {
  repositoryPath: string;
  logger?: Logger;
  maxConcurrentTasks?: number;
  defaultMessageTimeout?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface CoordinatorConfig {
  maxConcurrentTasks: number;
  defaultMessageTimeout: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Factory functions for creating coordinator and agents
 */
export type CoordinatorFactory = (config: CoordinatorConfig) => Promise<SubagentCoordinator>;
export type AgentFactory = () => Promise<unknown>;

export interface CoordinatorFactories {
  createCoordinator?: CoordinatorFactory;
  createExplorerAgent?: AgentFactory;
  createPlannerAgent?: AgentFactory;
  createPrAgent?: AgentFactory;
}

/**
 * Service for setting up and managing the SubagentCoordinator
 *
 * Encapsulates the boilerplate of:
 * - Creating coordinator
 * - Registering agents (Explorer, Planner, PR)
 * - Setting up context manager
 *
 * Makes coordinator setup testable and consistent.
 */
export class CoordinatorService {
  private repositoryPath: string;
  private logger?: Logger;
  private config: Required<Omit<CoordinatorServiceConfig, 'logger' | 'repositoryPath'>>;
  private factories: Required<CoordinatorFactories>;

  constructor(config: CoordinatorServiceConfig, factories?: CoordinatorFactories) {
    this.repositoryPath = config.repositoryPath;
    this.logger = config.logger;

    // Default configuration
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks ?? 5,
      defaultMessageTimeout: config.defaultMessageTimeout ?? 30000, // 30 seconds
      logLevel: config.logLevel ?? 'info',
    };

    // Use provided factories or defaults
    this.factories = {
      createCoordinator: factories?.createCoordinator || this.defaultCoordinatorFactory.bind(this),
      createExplorerAgent:
        factories?.createExplorerAgent || this.defaultExplorerAgentFactory.bind(this),
      createPlannerAgent:
        factories?.createPlannerAgent || this.defaultPlannerAgentFactory.bind(this),
      createPrAgent: factories?.createPrAgent || this.defaultPrAgentFactory.bind(this),
    };
  }

  /**
   * Default factory implementations
   */
  private async defaultCoordinatorFactory(config: CoordinatorConfig): Promise<SubagentCoordinator> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SubagentCoordinator: Coordinator } = require('@lytics/dev-agent-subagents');
    return new Coordinator(config) as SubagentCoordinator;
  }

  private async defaultExplorerAgentFactory(): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplorerAgent } = require('@lytics/dev-agent-subagents');
    return new ExplorerAgent();
  }

  private async defaultPlannerAgentFactory(): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PlannerAgent } = require('@lytics/dev-agent-subagents');
    return new PlannerAgent();
  }

  private async defaultPrAgentFactory(): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrAgent } = require('@lytics/dev-agent-subagents');
    return new PrAgent();
  }

  /**
   * Create and configure a coordinator with all agents registered
   *
   * @param indexer - Repository indexer to set in context manager
   * @returns Configured coordinator ready to use
   */
  async createCoordinator(indexer: RepositoryIndexer): Promise<SubagentCoordinator> {
    this.logger?.debug(
      {
        maxConcurrentTasks: this.config.maxConcurrentTasks,
        defaultMessageTimeout: this.config.defaultMessageTimeout,
        logLevel: this.config.logLevel,
      },
      'Creating SubagentCoordinator'
    );

    // Create coordinator
    const coordinator = await this.factories.createCoordinator({
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      defaultMessageTimeout: this.config.defaultMessageTimeout,
      logLevel: this.config.logLevel,
    });

    // Set up context manager with indexer
    coordinator.getContextManager().setIndexer(indexer);

    // Register all agents
    const explorerAgent = await this.factories.createExplorerAgent();
    const plannerAgent = await this.factories.createPlannerAgent();
    const prAgent = await this.factories.createPrAgent();

    await coordinator.registerAgent(explorerAgent);
    await coordinator.registerAgent(plannerAgent);
    await coordinator.registerAgent(prAgent);

    this.logger?.debug('SubagentCoordinator configured with 3 agents');

    return coordinator;
  }

  /**
   * Update configuration
   *
   * Useful for changing settings without recreating the service.
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<Omit<CoordinatorServiceConfig, 'repositoryPath'>>): void {
    if (config.maxConcurrentTasks !== undefined) {
      this.config.maxConcurrentTasks = config.maxConcurrentTasks;
    }
    if (config.defaultMessageTimeout !== undefined) {
      this.config.defaultMessageTimeout = config.defaultMessageTimeout;
    }
    if (config.logLevel !== undefined) {
      this.config.logLevel = config.logLevel;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<Omit<CoordinatorServiceConfig, 'logger' | 'repositoryPath'>> {
    return { ...this.config };
  }
}
