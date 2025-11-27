/**
 * Effort Estimation Utilities
 * Pure functions for estimating task effort
 *
 * @deprecated These utilities use heuristics that duplicate LLM capabilities.
 * Use assembleContext() to provide raw context and let the LLM estimate effort.
 */

import type { PlanTask } from '../types';

/**
 * Estimate hours for a single task based on description
 *
 * @deprecated Use assembleContext() instead - let LLMs estimate effort
 */
export function estimateTaskHours(description: string): number {
  // Simple heuristic-based estimation
  // In production, this could use historical data or ML

  const lowerDesc = description.toLowerCase();

  // Documentation tasks: 1-2 hours
  if (lowerDesc.includes('document') || lowerDesc.includes('readme')) {
    return 2;
  }

  // Testing tasks: 2-4 hours
  if (lowerDesc.includes('test')) {
    return 3;
  }

  // Design/planning tasks: 2-4 hours
  if (
    lowerDesc.includes('design') ||
    lowerDesc.includes('plan') ||
    lowerDesc.includes('research')
  ) {
    return 3;
  }

  // Implementation tasks: 4-8 hours
  if (
    lowerDesc.includes('implement') ||
    lowerDesc.includes('create') ||
    lowerDesc.includes('add')
  ) {
    return 6;
  }

  // Refactoring tasks: 3-6 hours
  if (lowerDesc.includes('refactor') || lowerDesc.includes('optimize')) {
    return 4;
  }

  // Default: 4 hours
  return 4;
}

/**
 * Calculate total estimate for all tasks
 */
export function calculateTotalEstimate(tasks: PlanTask[]): string {
  const totalHours = tasks.reduce((sum, task) => {
    return sum + (task.estimatedHours || estimateTaskHours(task.description));
  }, 0);

  return formatEstimate(totalHours);
}

/**
 * Format hours into human-readable estimate
 */
export function formatEstimate(hours: number): string {
  if (hours < 8) {
    return `${hours} hours`;
  }

  const days = Math.ceil(hours / 8);

  if (days === 1) {
    return '1 day';
  }

  if (days < 5) {
    return `${days} days`;
  }

  const weeks = Math.ceil(days / 5);
  if (weeks === 1) {
    return '1 week';
  }

  return `${weeks} weeks`;
}

/**
 * Add estimates to tasks
 */
export function addEstimatesToTasks(tasks: PlanTask[]): PlanTask[] {
  return tasks.map((task) => ({
    ...task,
    estimatedHours: task.estimatedHours || estimateTaskHours(task.description),
  }));
}
