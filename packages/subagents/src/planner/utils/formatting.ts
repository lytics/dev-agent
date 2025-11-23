/**
 * Output Formatting Utilities
 * Pure functions for formatting plans in different output formats
 */

import type { Plan } from '../types';

/**
 * Format plan as pretty CLI output
 */
export function formatPretty(plan: Plan): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`📋 Plan for Issue #${plan.issueNumber}: ${plan.title}`);
  lines.push('');

  // Tasks by phase
  const tasksByPhase = new Map<string, typeof plan.tasks>();
  for (const task of plan.tasks) {
    const phase = task.phase || 'Tasks';
    if (!tasksByPhase.has(phase)) {
      tasksByPhase.set(phase, []);
    }
    tasksByPhase.get(phase)?.push(task);
  }

  // Output tasks
  for (const [phase, tasks] of tasksByPhase) {
    if (tasksByPhase.size > 1) {
      lines.push(`## ${phase}`);
    }

    for (const task of tasks) {
      lines.push(`${task.id}. ☐ ${task.description}`);

      // Show relevant code
      if (task.relevantCode.length > 0) {
        for (const code of task.relevantCode.slice(0, 2)) {
          const score = (code.score * 100).toFixed(0);
          lines.push(`   📁 ${code.path} (${score}% similar)`);
        }
      }

      // Show estimate
      if (task.estimatedHours) {
        lines.push(`   ⏱️  ~${task.estimatedHours}h`);
      }

      lines.push('');
    }
  }

  // Summary
  lines.push('---');
  lines.push(`💡 ${plan.tasks.length} tasks • ${plan.totalEstimate}`);
  lines.push(`🎯 Priority: ${plan.priority}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format plan as Markdown document
 */
export function formatMarkdown(plan: Plan): string {
  const lines: string[] = [];

  lines.push(`# Plan: ${plan.title}`);
  lines.push('');
  lines.push(`**Issue:** #${plan.issueNumber}`);
  lines.push(`**Generated:** ${new Date(plan.metadata.generatedAt).toLocaleString()}`);
  lines.push(`**Priority:** ${plan.priority}`);
  lines.push(`**Estimated Effort:** ${plan.totalEstimate}`);
  lines.push('');

  // Description
  if (plan.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(plan.description);
    lines.push('');
  }

  // Tasks
  lines.push('## Tasks');
  lines.push('');

  const tasksByPhase = new Map<string, typeof plan.tasks>();
  for (const task of plan.tasks) {
    const phase = task.phase || 'Implementation';
    if (!tasksByPhase.has(phase)) {
      tasksByPhase.set(phase, []);
    }
    tasksByPhase.get(phase)?.push(task);
  }

  for (const [phase, tasks] of tasksByPhase) {
    if (tasksByPhase.size > 1) {
      lines.push(`### ${phase}`);
      lines.push('');
    }

    for (const task of tasks) {
      lines.push(`- [ ] **${task.description}**`);

      if (task.estimatedHours) {
        lines.push(`  - Estimate: ~${task.estimatedHours}h`);
      }

      if (task.relevantCode.length > 0) {
        lines.push('  - Relevant code:');
        for (const code of task.relevantCode) {
          lines.push(`    - \`${code.path}\` - ${code.reason}`);
        }
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format plan as JSON string (pretty-printed)
 */
export function formatJSON(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}

/**
 * Format error message for CLI
 */
export function formatError(error: string, details?: string): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`❌ Error: ${error}`);
  if (details) {
    lines.push('');
    lines.push(details);
  }
  lines.push('');
  return lines.join('\n');
}
