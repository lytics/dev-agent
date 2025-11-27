/**
 * Plan Adapter
 * Assembles context for development planning from GitHub issues
 *
 * Philosophy: Provide raw, structured context - let the LLM do the reasoning
 *
 * Two modes:
 * - "context" (default): Returns rich context package for LLM consumption
 * - "legacy": Returns heuristic task breakdown (deprecated)
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import type {
  Plan as AgentPlan,
  PlanTask as AgentPlanTask,
  ContextAssemblyOptions,
  ContextPackage,
  PlanningResult,
  RelevantCode,
} from '@lytics/dev-agent-subagents';
import {
  addEstimatesToTasks,
  assembleContext,
  breakdownIssue,
  calculateTotalEstimate,
  cleanDescription,
  extractAcceptanceCriteria,
  fetchGitHubIssue,
  formatContextPackage,
  inferPriority,
} from '@lytics/dev-agent-subagents';
import { estimateTokensForText, startTimer } from '../../formatters/utils';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';

/**
 * Plan task (local type definition - matches planner/types.ts)
 * @deprecated Use ContextPackage instead
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
 * @deprecated Use ContextPackage instead
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
 * Implements the dev_plan tool for generating implementation context from GitHub issues
 */
export class PlanAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'plan-adapter',
    version: '2.0.0',
    description: 'GitHub issue context assembler',
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
        'Assemble context for implementing a GitHub issue. Returns issue details, relevant code, and codebase patterns for LLM consumption.',
      inputSchema: {
        type: 'object',
        properties: {
          issue: {
            type: 'number',
            description: 'GitHub issue number (e.g., 29)',
          },
          mode: {
            type: 'string',
            enum: ['context', 'legacy'],
            description:
              'Mode: "context" returns rich context package (default), "legacy" returns heuristic task breakdown (deprecated)',
            default: 'context',
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
        },
        required: ['issue'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const {
      issue,
      mode = 'context',
      format = this.defaultFormat,
      includeCode = true,
      includePatterns = true,
      tokenBudget = 4000,
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

    // Validate mode
    if (mode !== 'context' && mode !== 'legacy') {
      return {
        success: false,
        error: {
          code: 'INVALID_MODE',
          message: 'Mode must be either "context" or "legacy"',
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
      const timer = startTimer();

      // Route based on mode
      if (mode === 'legacy') {
        context.logger.warn('Using deprecated legacy mode', { issue });
        return this.executeLegacy(args, context);
      }

      // Context mode (new default)
      context.logger.debug('Assembling context', {
        issue,
        format,
        includeCode,
        includePatterns,
        tokenBudget,
      });

      const options: ContextAssemblyOptions = {
        includeCode: includeCode as boolean,
        includePatterns: includePatterns as boolean,
        includeHistory: false, // TODO: Enable when GitHub indexer is available
        maxCodeResults: 10,
        tokenBudget: tokenBudget as number,
      };

      const contextPackage = await this.withTimeout(
        assembleContext(issue as number, this.indexer, this.repositoryPath, options),
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
        hasPatterns: !!contextPackage.codebasePatterns.testPattern,
        tokens,
        duration_ms,
      });

      return {
        success: true,
        data: {
          issue,
          format,
          mode: 'context',
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
   * Execute legacy mode (deprecated heuristic task breakdown)
   */
  private async executeLegacy(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const {
      issue,
      format = this.defaultFormat,
      useExplorer = true,
      detailLevel = 'detailed',
    } = args;

    try {
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
          plan = await this.withTimeout(
            this.generateLegacyPlan(
              issue as number,
              useExplorer as boolean,
              detailLevel as 'simple' | 'detailed',
              context
            ),
            this.timeout
          );
        }
      } else {
        plan = await this.withTimeout(
          this.generateLegacyPlan(
            issue as number,
            useExplorer as boolean,
            detailLevel as 'simple' | 'detailed',
            context
          ),
          this.timeout
        );
      }

      const content = format === 'verbose' ? this.formatVerbose(plan) : this.formatCompact(plan);

      context.logger.info('Legacy plan generated', {
        issue,
        taskCount: plan.tasks.length,
        totalEstimate: plan.totalEstimate,
      });

      return {
        success: true,
        data: {
          issue,
          format,
          mode: 'legacy',
          content,
          plan: format === 'verbose' ? plan : undefined,
        },
      };
    } catch (error) {
      context.logger.error('Legacy plan generation failed', { error });
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
            code: 'PLANNER_TIMEOUT',
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
        code: 'CONTEXT_ASSEMBLY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }

  /**
   * Execute planning via PlannerAgent through the coordinator
   * @deprecated Use context mode instead
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

    const response = await this.dispatchToAgent('planner', payload);

    if (!response) {
      return null;
    }

    if (response.type === 'error') {
      this.logger?.warn('PlannerAgent returned error', {
        error: response.payload.error,
      });
      return null;
    }

    const result = response.payload as unknown as PlanningResult;
    return result.plan;
  }

  /**
   * Convert agent plan format to adapter plan format
   * @deprecated Use context mode instead
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
        dependencies: undefined,
        priority: task.priority,
        phase: task.phase,
      })),
      totalEstimate: agentPlan.totalEstimate,
      priority: agentPlan.priority,
      metadata: agentPlan.metadata,
    };
  }

  /**
   * Generate a legacy development plan from a GitHub issue
   * @deprecated Use context mode instead
   */
  private async generateLegacyPlan(
    issueNumber: number,
    useExplorer: boolean,
    detailLevel: 'simple' | 'detailed',
    context: ToolExecutionContext
  ): Promise<Plan> {
    context.logger.debug('Fetching GitHub issue', { issueNumber });
    const issue = await fetchGitHubIssue(issueNumber, this.repositoryPath);

    const acceptanceCriteria = extractAcceptanceCriteria(issue.body);
    const priority = inferPriority(issue.labels);
    const description = cleanDescription(issue.body);

    const maxTasks = detailLevel === 'simple' ? 8 : 15;
    let tasks = breakdownIssue(issue, acceptanceCriteria, {
      detailLevel,
      maxTasks,
      includeEstimates: false,
    });

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
          context.logger.debug('Explorer search failed for task', { task: task.id, error });
        }
      }
    }

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
   * @deprecated Use context mode instead
   */
  private formatCompact(plan: Plan): string {
    const lines: string[] = [];

    lines.push(`## Plan for #${plan.issueNumber}: ${plan.title}`);
    lines.push('');
    lines.push(
      `**Estimate:** ${plan.totalEstimate} | **Priority:** ${plan.priority} | **Tasks:** ${plan.tasks.length}`
    );
    lines.push('');
    lines.push('### Implementation Steps');
    lines.push('');

    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      const estimate = task.estimatedHours ? ` (${task.estimatedHours}h)` : '';
      lines.push(`${i + 1}. ${task.description}${estimate}`);

      if (task.relevantCode && task.relevantCode.length > 0) {
        const paths = task.relevantCode
          .slice(0, 2)
          .map((c: { path: string; reason: string; score: number }) => c.path)
          .join(', ');
        lines.push(`   _See:_ \`${paths}\``);
      }

      lines.push('');
    }

    lines.push('### Next Step');
    lines.push('');
    lines.push(
      `Start with: **${plan.tasks[0]?.description}**${plan.tasks[0]?.estimatedHours ? ` (~${plan.tasks[0].estimatedHours}h)` : ''}`
    );

    return lines.join('\n');
  }

  /**
   * Format plan as verbose JSON with all details
   * @deprecated Use context mode instead
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
    const { mode = 'context', tokenBudget = 4000 } = args;

    if (mode === 'context') {
      return tokenBudget as number;
    }

    // Legacy mode estimates
    const { format = this.defaultFormat, detailLevel = 'detailed' } = args;
    if (format === 'verbose') {
      return detailLevel === 'simple' ? 800 : 1500;
    }
    return detailLevel === 'simple' ? 300 : 600;
  }
}
