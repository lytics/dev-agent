/**
 * Task Breakdown Utilities
 * Pure functions for breaking issues into actionable tasks
 *
 * @deprecated These utilities use heuristics that duplicate LLM capabilities.
 * Use assembleContext() to provide raw context and let the LLM do reasoning.
 */

import type { BreakdownOptions, GitHubIssue, PlanTask } from '../types';

/**
 * Break down a GitHub issue into tasks
 *
 * @deprecated Use assembleContext() instead - let LLMs do task breakdown
 */
export function breakdownIssue(
  issue: GitHubIssue,
  acceptanceCriteria: string[],
  options: BreakdownOptions
): PlanTask[] {
  const tasks: PlanTask[] = [];

  // If we have acceptance criteria, use those as tasks
  if (acceptanceCriteria.length > 0) {
    tasks.push(
      ...acceptanceCriteria.map((criterion, index) => ({
        id: `${index + 1}`,
        description: criterion,
        relevantCode: [],
      }))
    );
  } else {
    // Generate tasks based on title and description
    tasks.push(...generateTasksFromContent(issue, options));
  }

  // Limit tasks based on detail level
  const maxTasks = options.maxTasks || (options.detailLevel === 'simple' ? 6 : 12);
  const limitedTasks = tasks.slice(0, maxTasks);

  return limitedTasks;
}

/**
 * Generate tasks from issue content when no acceptance criteria exists
 */
function generateTasksFromContent(issue: GitHubIssue, options: BreakdownOptions): PlanTask[] {
  const tasks: PlanTask[] = [];

  // Simple heuristic-based task generation
  // In a real implementation, this could use LLM or more sophisticated analysis

  // For 'simple' detail level, create high-level phases
  if (options.detailLevel === 'simple') {
    tasks.push(
      {
        id: '1',
        description: `Design solution for: ${issue.title}`,
        relevantCode: [],
        phase: 'Planning',
      },
      {
        id: '2',
        description: 'Implement core functionality',
        relevantCode: [],
        phase: 'Implementation',
      },
      {
        id: '3',
        description: 'Write tests',
        relevantCode: [],
        phase: 'Testing',
      },
      {
        id: '4',
        description: 'Update documentation',
        relevantCode: [],
        phase: 'Documentation',
      }
    );
  } else {
    // For 'detailed', break down further
    tasks.push(
      {
        id: '1',
        description: 'Research and design approach',
        relevantCode: [],
        phase: 'Planning',
      },
      {
        id: '2',
        description: 'Define interfaces and types',
        relevantCode: [],
        phase: 'Planning',
      },
      {
        id: '3',
        description: 'Implement core logic',
        relevantCode: [],
        phase: 'Implementation',
      },
      {
        id: '4',
        description: 'Add error handling',
        relevantCode: [],
        phase: 'Implementation',
      },
      {
        id: '5',
        description: 'Write unit tests',
        relevantCode: [],
        phase: 'Testing',
      },
      {
        id: '6',
        description: 'Write integration tests',
        relevantCode: [],
        phase: 'Testing',
      },
      {
        id: '7',
        description: 'Update API documentation',
        relevantCode: [],
        phase: 'Documentation',
      },
      {
        id: '8',
        description: 'Add usage examples',
        relevantCode: [],
        phase: 'Documentation',
      }
    );
  }

  return tasks;
}

/**
 * Group tasks by phase
 */
export function groupTasksByPhase(tasks: PlanTask[]): Map<string, PlanTask[]> {
  const grouped = new Map<string, PlanTask[]>();

  for (const task of tasks) {
    const phase = task.phase || 'Implementation';
    if (!grouped.has(phase)) {
      grouped.set(phase, []);
    }
    grouped.get(phase)?.push(task);
  }

  return grouped;
}

/**
 * Validate task structure
 */
export function validateTasks(tasks: PlanTask[]): boolean {
  if (tasks.length === 0) {
    return false;
  }

  for (const task of tasks) {
    if (!task.id || !task.description) {
      return false;
    }
  }

  return true;
}
