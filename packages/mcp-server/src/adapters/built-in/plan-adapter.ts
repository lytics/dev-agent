/**
 * Plan Adapter
 * Generates development plans from GitHub issues
 *
 * Routes through PlannerAgent when coordinator is available,
 * falls back to direct utility calls otherwise.
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import type {
  Plan as AgentPlan,
  PlanTask as AgentPlanTask,
  PlanningResult,
  RelevantCode,
} from '@lytics/dev-agent-subagents';
import {
  addEstimatesToTasks,
  breakdownIssue,
  calculateTotalEstimate,
  cleanDescription,
  extractAcceptanceCriteria,
  fetchGitHubIssue,
  inferPriority,
} from '@lytics/dev-agent-subagents';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';

/**
 * Plan task (local type definition - matches planner/types.ts)
 */
interface PlanTask {
  id: string;
  description: string;
  relevantCode?: Array<{
    path: string;
    reason: string;
    score: number;
  }>;
  estimatedHours?: number;
  dependencies?: string[];
  priority?: 'low' | 'medium' | 'high';
  phase?: string;
}

/**
 * Development plan (local type definition - matches planner/types.ts)
 */
interface Plan {
  issueNumber: number;
  title: string;
  description: string;
  tasks: PlanTask[];
  totalEstimate: string;
  priority: 'low' | 'medium' | 'high';
  metadata: {
    generatedAt: string;
    explorerUsed: boolean;
    strategy: string;
  };
}

/**
 * Plan adapter configuration
 */
export interface PlanAdapterConfig {
  /**
   * Repository indexer instance (for finding relevant code)
   */
  repositoryIndexer: RepositoryIndexer;

  /**
   * Repository path
   */
  repositoryPath: string;

  /**
   * Default format mode
   */
  defaultFormat?: 'compact' | 'verbose';

  /**
   * Timeout for plan generation (milliseconds)
   */
  timeout?: number;
}

/**
 * Plan Adapter
 * Implements the dev_plan tool for generating implementation plans from GitHub issues
 */
export class PlanAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'plan-adapter',
    version: '1.0.0',
    description: 'GitHub issue planning adapter',
    author: 'Dev-Agent Team',
  };

  private indexer: RepositoryIndexer;
  private repositoryPath: string;
  private defaultFormat: 'compact' | 'verbose';
  private timeout: number;

  constructor(config: PlanAdapterConfig) {
    super();
    this.indexer = config.repositoryIndexer;
    this.repositoryPath = config.repositoryPath;
    this.defaultFormat = config.defaultFormat ?? 'compact';
    this.timeout = config.timeout ?? 60000; // 60 seconds default
  }

  async initialize(context: AdapterContext): Promise<void> {
    // Store coordinator and logger from base class
    this.initializeBase(context);

    context.logger.info('PlanAdapter initialized', {
      repositoryPath: this.repositoryPath,
      defaultFormat: this.defaultFormat,
      timeout: this.timeout,
      hasCoordinator: this.hasCoordinator(),
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_plan',
      description:
        'Generate implementation plan from GitHub issue with tasks, estimates, and dependencies',
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
            description:
              'Output format: "compact" for markdown checklist (default), "verbose" for detailed JSON',
            default: this.defaultFormat,
          },
          useExplorer: {
            type: 'boolean',
            description: 'Find relevant code using semantic search (default: true)',
            default: true,
          },
          detailLevel: {
            type: 'string',
            enum: ['simple', 'detailed'],
            description: 'Task granularity: "simple" (4-8 tasks) or "detailed" (10-15 tasks)',
            default: 'detailed',
          },
        },
        required: ['issue'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const {
      issue,
      format = this.defaultFormat,
      useExplorer = true,
      detailLevel = 'detailed',
    } = args;

    // Validate issue number
    if (typeof issue !== 'number' || issue < 1) {
      return {
        success: false,
        error: {
          code: 'INVALID_ISSUE',
          message: 'Issue must be a positive number',
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

    // Validate detailLevel
    if (detailLevel !== 'simple' && detailLevel !== 'detailed') {
      return {
        success: false,
        error: {
          code: 'INVALID_DETAIL_LEVEL',
          message: 'Detail level must be either "simple" or "detailed"',
        },
      };
    }

    try {
      context.logger.debug('Generating plan', {
        issue,
        format,
        useExplorer,
        detailLevel,
        viaAgent: this.hasCoordinator(),
      });

      let plan: Plan;

      // Try routing through PlannerAgent if coordinator is available
      if (this.hasCoordinator()) {
        const agentPlan = await this.executeViaAgent(
          issue as number,
          useExplorer as boolean,
          detailLevel as 'simple' | 'detailed'
        );

        if (agentPlan) {
          plan = this.convertAgentPlan(agentPlan);
        } else {
          // Fall through to direct execution if agent dispatch failed
          context.logger.debug('Agent dispatch returned null, falling back to direct execution');
          plan = await this.withTimeout(
            this.generatePlan(
              issue as number,
              useExplorer as boolean,
              detailLevel as 'simple' | 'detailed',
              context
            ),
            this.timeout
          );
        }
      } else {
        // Direct execution (no coordinator)
        plan = await this.withTimeout(
          this.generatePlan(
            issue as number,
            useExplorer as boolean,
            detailLevel as 'simple' | 'detailed',
            context
          ),
          this.timeout
        );
      }

      // Format plan based on format parameter
      const content = format === 'verbose' ? this.formatVerbose(plan) : this.formatCompact(plan);

      context.logger.info('Plan generated', {
        issue,
        taskCount: plan.tasks.length,
        totalEstimate: plan.totalEstimate,
      });

      return {
        success: true,
        data: {
          issue,
          format,
          content,
          plan: format === 'verbose' ? plan : undefined, // Include full plan in verbose mode
        },
      };
    } catch (error) {
      context.logger.error('Plan generation failed', { error });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          return {
            success: false,
            error: {
              code: 'PLANNER_TIMEOUT',
              message: `Planning timeout after ${this.timeout / 1000}s. Issue may be too complex.`,
              suggestion: 'Try breaking the issue into smaller sub-issues or increase timeout.',
            },
          };
        }

        if (error.message.includes('not found') || error.message.includes('404')) {
          return {
            success: false,
            error: {
              code: 'ISSUE_NOT_FOUND',
              message: `GitHub issue #${issue} not found`,
              suggestion: 'Check the issue number or run "dev gh index" to sync GitHub data.',
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
          code: 'PLANNING_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  /**
   * Execute planning via PlannerAgent through the coordinator
   * Returns agent plan, or null if dispatch fails
   */
  private async executeViaAgent(
    issueNumber: number,
    useExplorer: boolean,
    detailLevel: 'simple' | 'detailed'
  ): Promise<AgentPlan | null> {
    const payload = {
      action: 'plan',
      issueNumber,
      useExplorer,
      detailLevel,
    };

    // Dispatch to PlannerAgent
    const response = await this.dispatchToAgent('planner', payload);

    if (!response) {
      return null;
    }

    // Check for error response
    if (response.type === 'error') {
      this.logger?.warn('PlannerAgent returned error', {
        error: response.payload.error,
      });
      return null;
    }

    // Extract plan from response payload
    const result = response.payload as unknown as PlanningResult;
    return result.plan;
  }

  /**
   * Convert agent plan format to adapter plan format
   * (They're nearly identical, but we ensure type safety)
   */
  private convertAgentPlan(agentPlan: AgentPlan): Plan {
    return {
      issueNumber: agentPlan.issueNumber,
      title: agentPlan.title,
      description: agentPlan.description,
      tasks: agentPlan.tasks.map((task: AgentPlanTask) => ({
        id: task.id,
        description: task.description,
        relevantCode: task.relevantCode?.map((code: RelevantCode) => ({
          path: code.path,
          reason: code.reason,
          score: code.score,
        })),
        estimatedHours: task.estimatedHours,
        dependencies: undefined, // Not in agent plan
        priority: task.priority,
        phase: task.phase,
      })),
      totalEstimate: agentPlan.totalEstimate,
      priority: agentPlan.priority,
      metadata: agentPlan.metadata,
    };
  }

  /**
   * Generate a development plan from a GitHub issue (direct execution)
   */
  private async generatePlan(
    issueNumber: number,
    useExplorer: boolean,
    detailLevel: 'simple' | 'detailed',
    context: ToolExecutionContext
  ): Promise<Plan> {
    // Fetch GitHub issue
    context.logger.debug('Fetching GitHub issue', { issueNumber });
    const issue = await fetchGitHubIssue(issueNumber, this.repositoryPath);

    // Parse issue content
    const acceptanceCriteria = extractAcceptanceCriteria(issue.body);
    const priority = inferPriority(issue.labels);
    const description = cleanDescription(issue.body);

    // Break down into tasks
    const maxTasks = detailLevel === 'simple' ? 8 : 15;
    let tasks = breakdownIssue(issue, acceptanceCriteria, {
      detailLevel,
      maxTasks,
      includeEstimates: false,
    });

    // Find relevant code if Explorer enabled
    if (useExplorer) {
      context.logger.debug('Finding relevant code', { taskCount: tasks.length });

      for (const task of tasks) {
        try {
          const results = await this.indexer.search(task.description, {
            limit: 3,
            scoreThreshold: 0.6,
          });

          task.relevantCode = results.map((r) => ({
            path: (r.metadata as { path?: string }).path || '',
            reason: 'Similar pattern found',
            score: r.score,
          }));
        } catch (error) {
          // Continue without Explorer context for this task
          context.logger.debug('Explorer search failed for task', { task: task.id, error });
        }
      }
    }

    // Add effort estimates
    tasks = addEstimatesToTasks(tasks);
    const totalEstimate = calculateTotalEstimate(tasks);

    return {
      issueNumber,
      title: issue.title,
      description,
      tasks,
      totalEstimate,
      priority,
      metadata: {
        generatedAt: new Date().toISOString(),
        explorerUsed: useExplorer,
        strategy: detailLevel === 'simple' ? 'sequential' : 'parallel',
      },
    };
  }

  /**
   * Format plan as compact markdown checklist
   */
  private formatCompact(plan: Plan): string {
    const lines: string[] = [];

    // Header
    lines.push(`## Plan for #${plan.issueNumber}: ${plan.title}`);
    lines.push('');
    lines.push(
      `**Estimate:** ${plan.totalEstimate} | **Priority:** ${plan.priority} | **Tasks:** ${plan.tasks.length}`
    );
    lines.push('');

    // Tasks as checklist
    lines.push('### Implementation Steps');
    lines.push('');

    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      const estimate = task.estimatedHours ? ` (${task.estimatedHours}h)` : '';
      lines.push(`${i + 1}. ${task.description}${estimate}`);

      // Add relevant code if available (compact: just file paths)
      if (task.relevantCode && task.relevantCode.length > 0) {
        const paths = task.relevantCode
          .slice(0, 2)
          .map((c: { path: string; reason: string; score: number }) => c.path)
          .join(', ');
        lines.push(`   _See:_ \`${paths}\``);
      }

      lines.push('');
    }

    // Next step
    lines.push('### Next Step');
    lines.push('');
    lines.push(
      `Start with: **${plan.tasks[0]?.description}**${plan.tasks[0]?.estimatedHours ? ` (~${plan.tasks[0].estimatedHours}h)` : ''}`
    );

    return lines.join('\n');
  }

  /**
   * Format plan as verbose JSON with all details
   */
  private formatVerbose(plan: Plan): string {
    return JSON.stringify(plan, null, 2);
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
    const { format = this.defaultFormat, detailLevel = 'detailed' } = args;

    // Rough estimates based on format and detail level
    if (format === 'verbose') {
      return detailLevel === 'simple' ? 800 : 1500;
    }

    // Compact estimates
    return detailLevel === 'simple' ? 300 : 600;
  }
}
