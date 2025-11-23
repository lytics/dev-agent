/**
 * Tests for Effort Estimation Utilities
 */

import { describe, expect, it } from 'vitest';
import type { PlanTask } from '../types';
import {
  addEstimatesToTasks,
  calculateTotalEstimate,
  estimateTaskHours,
  formatEstimate,
} from './estimation';

describe('estimateTaskHours', () => {
  it('should estimate 2 hours for documentation tasks', () => {
    expect(estimateTaskHours('Update documentation')).toBe(2);
    expect(estimateTaskHours('Write README')).toBe(2);
  });

  it('should estimate 3 hours for testing tasks', () => {
    expect(estimateTaskHours('Write tests')).toBe(3);
    expect(estimateTaskHours('Add unit tests')).toBe(3);
  });

  it('should estimate 3 hours for design tasks', () => {
    expect(estimateTaskHours('Design solution')).toBe(3);
    expect(estimateTaskHours('Plan architecture')).toBe(3);
    expect(estimateTaskHours('Research approaches')).toBe(3);
  });

  it('should estimate 6 hours for implementation tasks', () => {
    expect(estimateTaskHours('Implement feature')).toBe(6);
    expect(estimateTaskHours('Create component')).toBe(6);
    expect(estimateTaskHours('Add functionality')).toBe(6);
  });

  it('should estimate 4 hours for refactoring tasks', () => {
    expect(estimateTaskHours('Refactor code')).toBe(4);
    expect(estimateTaskHours('Optimize performance')).toBe(4);
  });

  it('should default to 4 hours for unknown tasks', () => {
    expect(estimateTaskHours('Generic task')).toBe(4);
    expect(estimateTaskHours('Something')).toBe(4);
  });

  it('should be case-insensitive', () => {
    expect(estimateTaskHours('DOCUMENT the API')).toBe(2);
    expect(estimateTaskHours('TEST the feature')).toBe(3);
  });
});

describe('formatEstimate', () => {
  it('should format hours for tasks under 8 hours', () => {
    expect(formatEstimate(1)).toBe('1 hours');
    expect(formatEstimate(4)).toBe('4 hours');
    expect(formatEstimate(7)).toBe('7 hours');
  });

  it('should format as days for 8+ hours', () => {
    expect(formatEstimate(8)).toBe('1 day');
    expect(formatEstimate(16)).toBe('2 days');
    expect(formatEstimate(24)).toBe('3 days');
  });

  it('should round up to nearest day', () => {
    expect(formatEstimate(9)).toBe('2 days');
    expect(formatEstimate(12)).toBe('2 days');
  });

  it('should format as weeks for 40+ hours', () => {
    expect(formatEstimate(40)).toBe('1 week');
    expect(formatEstimate(80)).toBe('2 weeks');
  });

  it('should round up to nearest week', () => {
    expect(formatEstimate(45)).toBe('2 weeks'); // 45h = 6d = 2w
    expect(formatEstimate(60)).toBe('2 weeks'); // 60h = 8d = 2w
    expect(formatEstimate(88)).toBe('3 weeks'); // 88h = 11d = 3w
  });
});

describe('calculateTotalEstimate', () => {
  it('should sum all task estimates', () => {
    const tasks: PlanTask[] = [
      { id: '1', description: 'Task 1', estimatedHours: 4, relevantCode: [] },
      { id: '2', description: 'Task 2', estimatedHours: 6, relevantCode: [] },
      { id: '3', description: 'Task 3', estimatedHours: 2, relevantCode: [] },
    ];
    expect(calculateTotalEstimate(tasks)).toBe('2 days');
  });

  it('should use heuristic for tasks without estimates', () => {
    const tasks: PlanTask[] = [
      { id: '1', description: 'Implement feature', relevantCode: [] },
      { id: '2', description: 'Write tests', relevantCode: [] },
    ];
    // implement=6h, tests=3h, total=9h -> 2 days
    expect(calculateTotalEstimate(tasks)).toBe('2 days');
  });

  it('should handle empty task list', () => {
    expect(calculateTotalEstimate([])).toBe('0 hours');
  });

  it('should mix explicit and estimated hours', () => {
    const tasks: PlanTask[] = [
      { id: '1', description: 'Task with estimate', estimatedHours: 10, relevantCode: [] },
      { id: '2', description: 'Write tests', relevantCode: [] }, // Will be 3h
    ];
    // 10 + 3 = 13h -> 2 days
    expect(calculateTotalEstimate(tasks)).toBe('2 days');
  });
});

describe('addEstimatesToTasks', () => {
  it('should add estimates to tasks without them', () => {
    const tasks: PlanTask[] = [
      { id: '1', description: 'Implement feature', relevantCode: [] },
      { id: '2', description: 'Write tests', relevantCode: [] },
    ];

    const result = addEstimatesToTasks(tasks);

    expect(result[0].estimatedHours).toBe(6); // implement
    expect(result[1].estimatedHours).toBe(3); // tests
  });

  it('should preserve existing estimates', () => {
    const tasks: PlanTask[] = [
      { id: '1', description: 'Task', estimatedHours: 10, relevantCode: [] },
    ];

    const result = addEstimatesToTasks(tasks);

    expect(result[0].estimatedHours).toBe(10);
  });

  it('should not mutate original tasks', () => {
    const tasks: PlanTask[] = [{ id: '1', description: 'Task', relevantCode: [] }];

    const result = addEstimatesToTasks(tasks);

    expect(tasks[0].estimatedHours).toBeUndefined();
    expect(result[0].estimatedHours).toBeDefined();
  });

  it('should handle empty array', () => {
    expect(addEstimatesToTasks([])).toEqual([]);
  });
});
