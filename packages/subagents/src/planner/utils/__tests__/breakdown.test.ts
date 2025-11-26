import { describe, expect, it } from 'vitest';
import type { BreakdownOptions, GitHubIssue } from '../../types';
import { breakdownIssue, groupTasksByPhase, validateTasks } from '../breakdown';

describe('breakdownIssue', () => {
  const mockIssue: GitHubIssue = {
    number: 42,
    title: 'Add user authentication',
    body: 'We need to add JWT-based authentication',
    state: 'open',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    labels: ['feature'],
    assignees: [],
  };

  it('should use acceptance criteria when provided', () => {
    const criteria = ['Implement JWT tokens', 'Add login endpoint', 'Add logout endpoint'];
    const options: BreakdownOptions = {
      detailLevel: 'simple',
    };

    const tasks = breakdownIssue(mockIssue, criteria, options);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].description).toBe('Implement JWT tokens');
    expect(tasks[1].description).toBe('Add login endpoint');
    expect(tasks[2].description).toBe('Add logout endpoint');
    expect(tasks[0].id).toBe('1');
    expect(tasks[1].id).toBe('2');
  });

  it('should generate simple tasks when no acceptance criteria', () => {
    const options: BreakdownOptions = {
      detailLevel: 'simple',
    };

    const tasks = breakdownIssue(mockIssue, [], options);

    expect(tasks).toHaveLength(4);
    expect(tasks[0].description).toContain('Design solution');
    expect(tasks[1].description).toBe('Implement core functionality');
    expect(tasks[2].description).toBe('Write tests');
    expect(tasks[3].description).toBe('Update documentation');
    expect(tasks[0].phase).toBe('Planning');
    expect(tasks[1].phase).toBe('Implementation');
  });

  it('should generate detailed tasks when detail level is detailed', () => {
    const options: BreakdownOptions = {
      detailLevel: 'detailed',
    };

    const tasks = breakdownIssue(mockIssue, [], options);

    expect(tasks).toHaveLength(8);
    expect(tasks[0].description).toBe('Research and design approach');
    expect(tasks[2].description).toBe('Implement core logic');
    expect(tasks[4].description).toBe('Write unit tests');
    expect(tasks[6].description).toBe('Update API documentation');
  });

  it('should limit tasks based on maxTasks option', () => {
    const criteria = ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5'];
    const options: BreakdownOptions = {
      detailLevel: 'simple',
      maxTasks: 3,
    };

    const tasks = breakdownIssue(mockIssue, criteria, options);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].description).toBe('Task 1');
    expect(tasks[2].description).toBe('Task 3');
  });

  it('should default maxTasks to 6 for simple detail level', () => {
    const criteria = Array.from({ length: 10 }, (_, i) => `Task ${i + 1}`);
    const options: BreakdownOptions = {
      detailLevel: 'simple',
    };

    const tasks = breakdownIssue(mockIssue, criteria, options);

    expect(tasks).toHaveLength(6);
  });

  it('should default maxTasks to 12 for detailed level', () => {
    const criteria = Array.from({ length: 20 }, (_, i) => `Task ${i + 1}`);
    const options: BreakdownOptions = {
      detailLevel: 'detailed',
    };

    const tasks = breakdownIssue(mockIssue, criteria, options);

    expect(tasks).toHaveLength(12);
  });

  it('should include issue title in generated tasks', () => {
    const options: BreakdownOptions = {
      detailLevel: 'simple',
    };

    const tasks = breakdownIssue(mockIssue, [], options);

    expect(tasks[0].description).toContain(mockIssue.title);
  });

  it('should initialize relevantCode as empty array', () => {
    const criteria = ['Test task'];
    const options: BreakdownOptions = {
      detailLevel: 'simple',
    };

    const tasks = breakdownIssue(mockIssue, criteria, options);

    expect(tasks[0].relevantCode).toEqual([]);
  });
});

describe('groupTasksByPhase', () => {
  it('should group tasks by phase', () => {
    const tasks = [
      { id: '1', description: 'Task 1', phase: 'Planning', relevantCode: [] },
      { id: '2', description: 'Task 2', phase: 'Implementation', relevantCode: [] },
      { id: '3', description: 'Task 3', phase: 'Planning', relevantCode: [] },
      { id: '4', description: 'Task 4', phase: 'Testing', relevantCode: [] },
    ];

    const grouped = groupTasksByPhase(tasks);

    expect(grouped.size).toBe(3);
    expect(grouped.get('Planning')).toHaveLength(2);
    expect(grouped.get('Implementation')).toHaveLength(1);
    expect(grouped.get('Testing')).toHaveLength(1);
  });

  it('should default to Implementation phase when not specified', () => {
    const tasks = [
      { id: '1', description: 'Task 1', relevantCode: [] },
      { id: '2', description: 'Task 2', relevantCode: [] },
    ];

    const grouped = groupTasksByPhase(tasks);

    expect(grouped.get('Implementation')).toHaveLength(2);
  });

  it('should handle empty task list', () => {
    const grouped = groupTasksByPhase([]);

    expect(grouped.size).toBe(0);
  });

  it('should handle mixed phase and no-phase tasks', () => {
    const tasks = [
      { id: '1', description: 'Task 1', phase: 'Planning', relevantCode: [] },
      { id: '2', description: 'Task 2', relevantCode: [] },
      { id: '3', description: 'Task 3', phase: 'Planning', relevantCode: [] },
    ];

    const grouped = groupTasksByPhase(tasks);

    expect(grouped.size).toBe(2);
    expect(grouped.get('Planning')).toHaveLength(2);
    expect(grouped.get('Implementation')).toHaveLength(1);
  });
});

describe('validateTasks', () => {
  it('should return true for valid tasks', () => {
    const tasks = [
      { id: '1', description: 'Task 1', relevantCode: [] },
      { id: '2', description: 'Task 2', relevantCode: [] },
    ];

    expect(validateTasks(tasks)).toBe(true);
  });

  it('should return false for empty task list', () => {
    expect(validateTasks([])).toBe(false);
  });

  it('should return false for tasks missing id', () => {
    const tasks = [
      { id: '', description: 'Task 1', relevantCode: [] },
      { id: '2', description: 'Task 2', relevantCode: [] },
    ];

    expect(validateTasks(tasks)).toBe(false);
  });

  it('should return false for tasks missing description', () => {
    const tasks = [
      { id: '1', description: '', relevantCode: [] },
      { id: '2', description: 'Task 2', relevantCode: [] },
    ];

    expect(validateTasks(tasks)).toBe(false);
  });

  it('should return false if any task is invalid', () => {
    const tasks = [
      { id: '1', description: 'Task 1', relevantCode: [] },
      { id: '2', description: '', relevantCode: [] },
      { id: '3', description: 'Task 3', relevantCode: [] },
    ];

    expect(validateTasks(tasks)).toBe(false);
  });

  it('should accept tasks with optional fields', () => {
    const tasks = [
      {
        id: '1',
        description: 'Task 1',
        relevantCode: [{ path: 'file.ts', score: 0.9, reason: 'test' }],
        phase: 'Planning',
        dependencies: ['0'],
      },
    ];

    expect(validateTasks(tasks)).toBe(true);
  });
});
