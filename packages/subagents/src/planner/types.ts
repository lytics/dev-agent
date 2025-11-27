/**
 * Planner Subagent Types
 * Type definitions for GitHub issue analysis and task planning
 */

/**
 * GitHub issue comment
 */
export interface GitHubComment {
  author?: string;
  body: string;
  createdAt?: string;
}

/**
 * GitHub issue data from gh CLI
 */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  author?: string;
  createdAt: string;
  updatedAt: string;
  comments?: GitHubComment[];
}

/**
 * Relevant code found by Explorer for a task
 */
export interface RelevantCode {
  path: string;
  reason: string;
  score: number;
  type?: string;
  name?: string;
}

/**
 * Individual task in a plan
 */
export interface PlanTask {
  id: string;
  description: string;
  relevantCode: RelevantCode[];
  estimatedHours?: number;
  priority?: 'low' | 'medium' | 'high';
  phase?: string;
}

/**
 * Complete development plan
 */
export interface Plan {
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
 * Planning request from user/tool
 */
export interface PlanningRequest {
  action: 'plan';
  issueNumber: number;
  useExplorer?: boolean;
  detailLevel?: 'simple' | 'detailed';
  strategy?: 'sequential' | 'parallel';
}

/**
 * Planning result for agent communication
 */
export interface PlanningResult {
  action: 'plan';
  plan: Plan;
}

/**
 * Planning error
 */
export interface PlanningError {
  action: 'plan';
  error: string;
  code?: 'NOT_FOUND' | 'INVALID_ISSUE' | 'NO_GITHUB_REPO' | 'GH_CLI_ERROR';
  details?: string;
}

/**
 * Options for task breakdown
 */
export interface BreakdownOptions {
  detailLevel: 'simple' | 'detailed';
  maxTasks?: number;
  includeEstimates?: boolean;
}

/**
 * Options for planning
 */
export interface PlanOptions {
  useExplorer: boolean;
  detailLevel: 'simple' | 'detailed';
  format: 'json' | 'pretty' | 'markdown';
}
