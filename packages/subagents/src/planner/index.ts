/**
 * Planner Subagent = Strategic Planner
 * Analyzes GitHub issues and creates actionable development plans
 */

import type { Agent, AgentContext, Message } from '../types';
import type { Plan, PlanningError, PlanningRequest, PlanningResult } from './types';

export class PlannerAgent implements Agent {
  name = 'planner';
  capabilities = ['plan', 'analyze-issue', 'breakdown-tasks'];

  private context?: AgentContext;

  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
    this.name = context.agentName;
    context.logger.info('Planner agent initialized', {
      capabilities: this.capabilities,
    });
  }

  async handleMessage(message: Message): Promise<Message | null> {
    if (!this.context) {
      throw new Error('Planner not initialized');
    }

    const { logger } = this.context;

    if (message.type !== 'request') {
      logger.debug('Ignoring non-request message', { type: message.type });
      return null;
    }

    try {
      const request = message.payload as unknown as PlanningRequest;
      logger.debug('Processing planning request', { action: request.action });

      let result: PlanningResult | PlanningError;

      switch (request.action) {
        case 'plan':
          result = await this.createPlan(request);
          break;
        default:
          result = {
            action: 'plan',
            error: `Unknown action: ${(request as PlanningRequest).action}`,
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
      logger.error('Planning failed', error as Error, {
        messageId: message.id,
      });

      return {
        id: `${message.id}-error`,
        type: 'error',
        sender: this.name,
        recipient: message.sender,
        correlationId: message.id,
        payload: {
          error: (error as Error).message,
        },
        priority: message.priority,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create a development plan from a GitHub issue
   */
  private async createPlan(request: PlanningRequest): Promise<PlanningResult> {
    if (!this.context) {
      throw new Error('Planner not initialized');
    }

    const { logger, contextManager } = this.context;
    const useExplorer = request.useExplorer ?? true;
    const detailLevel = request.detailLevel ?? 'simple';

    logger.info('Creating plan for issue', {
      issueNumber: request.issueNumber,
      useExplorer,
      detailLevel,
    });

    // Import utilities
    const {
      fetchGitHubIssue,
      extractAcceptanceCriteria,
      extractTechnicalRequirements,
      inferPriority,
      cleanDescription,
      breakdownIssue,
      addEstimatesToTasks,
      calculateTotalEstimate,
    } = await import('./utils/index.js');

    // 1. Fetch GitHub issue
    const issue = await fetchGitHubIssue(request.issueNumber);

    // 2. Parse issue content
    const acceptanceCriteria = extractAcceptanceCriteria(issue.body);
    const technicalReqs = extractTechnicalRequirements(issue.body);
    const priority = inferPriority(issue.labels);
    const description = cleanDescription(issue.body);

    logger.debug('Parsed issue', {
      criteriaCount: acceptanceCriteria.length,
      reqsCount: technicalReqs.length,
      priority,
    });

    // 3. Break down into tasks
    let tasks = breakdownIssue(issue, acceptanceCriteria, {
      detailLevel,
      maxTasks: detailLevel === 'simple' ? 8 : 15,
      includeEstimates: false,
    });

    // 4. If useExplorer, find relevant code for each task
    if (useExplorer) {
      const indexer = contextManager.getIndexer();
      if (indexer) {
        logger.debug('Finding relevant code with Explorer');

        for (const task of tasks) {
          try {
            // Search for relevant code using task description
            const results = await indexer.search(task.description, {
              limit: 3,
              scoreThreshold: 0.6,
            });

            task.relevantCode = results.map((r) => ({
              path: (r.metadata as { path?: string }).path || '',
              reason: 'Similar pattern found',
              score: r.score,
              type: (r.metadata as { type?: string }).type,
              name: (r.metadata as { name?: string }).name,
            }));

            logger.debug('Found relevant code', {
              task: task.description,
              matches: task.relevantCode.length,
            });
          } catch (error) {
            logger.warn('Failed to find relevant code for task', {
              task: task.description,
              error: (error as Error).message,
            });
            // Continue without Explorer context
          }
        }
      } else {
        logger.warn('Explorer requested but indexer not available');
      }
    }

    // 5. Add effort estimates
    tasks = addEstimatesToTasks(tasks);
    const totalEstimate = calculateTotalEstimate(tasks);

    logger.info('Plan created', {
      taskCount: tasks.length,
      totalEstimate,
    });

    // 6. Return structured plan
    const plan: Plan = {
      issueNumber: request.issueNumber,
      title: issue.title,
      description,
      tasks,
      totalEstimate,
      priority,
      metadata: {
        generatedAt: new Date().toISOString(),
        explorerUsed: useExplorer && !!contextManager.getIndexer(),
        strategy: request.strategy || 'sequential',
      },
    };

    return {
      action: 'plan',
      plan,
    };
  }

  async healthCheck(): Promise<boolean> {
    // Planner is healthy if it's initialized
    // Could check for gh CLI availability
    return this.context !== undefined;
  }

  async shutdown(): Promise<void> {
    this.context?.logger.info('Planner agent shutting down');
    this.context = undefined;
  }
}

export type * from './context-types';
// Export types
export type * from './types';
