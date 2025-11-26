import { describe, expect, it } from 'vitest';
import type { Plan } from '../../types';
import { formatError, formatJSON, formatMarkdown, formatPretty } from '../formatting';

describe('formatPretty', () => {
  const mockPlan: Plan = {
    issueNumber: 42,
    title: 'Add user authentication',
    description: 'Implement JWT-based authentication',
    tasks: [
      {
        id: '1',
        description: 'Design authentication flow',
        phase: 'Planning',
        relevantCode: [],
      },
      {
        id: '2',
        description: 'Implement JWT tokens',
        phase: 'Implementation',
        estimatedHours: 4,
        relevantCode: [
          { path: 'src/auth/jwt.ts', score: 0.85, reason: 'JWT utilities' },
          { path: 'src/auth/middleware.ts', score: 0.72, reason: 'Auth middleware' },
        ],
      },
    ],
    totalEstimate: '8-12 hours',
    priority: 'high',
    metadata: {
      generatedAt: '2025-01-01T00:00:00Z',
      explorerUsed: true,
      strategy: 'sequential',
    },
  };

  it('should format plan with header', () => {
    const output = formatPretty(mockPlan);

    expect(output).toContain('📋 Plan for Issue #42: Add user authentication');
  });

  it('should group tasks by phase', () => {
    const output = formatPretty(mockPlan);

    expect(output).toContain('## Planning');
    expect(output).toContain('## Implementation');
  });

  it('should format tasks with checkboxes', () => {
    const output = formatPretty(mockPlan);

    expect(output).toContain('1. ☐ Design authentication flow');
    expect(output).toContain('2. ☐ Implement JWT tokens');
  });

  it('should show relevant code with similarity scores', () => {
    const output = formatPretty(mockPlan);

    expect(output).toContain('📁 src/auth/jwt.ts (85% similar)');
    expect(output).toContain('📁 src/auth/middleware.ts (72% similar)');
  });

  it('should limit relevant code to 2 items', () => {
    const planWithManyFiles: Plan = {
      ...mockPlan,
      tasks: [
        {
          id: '1',
          description: 'Task with many files',
          relevantCode: [
            { path: 'file1.ts', score: 0.9, reason: 'test' },
            { path: 'file2.ts', score: 0.8, reason: 'test' },
            { path: 'file3.ts', score: 0.7, reason: 'test' },
          ],
        },
      ],
    };

    const output = formatPretty(planWithManyFiles);
    const fileMatches = output.match(/📁/g);

    expect(fileMatches).toHaveLength(2);
  });

  it('should show estimated hours', () => {
    const output = formatPretty(mockPlan);

    expect(output).toContain('⏱️  ~4h');
  });

  it('should include summary footer', () => {
    const output = formatPretty(mockPlan);

    expect(output).toContain('💡 2 tasks • 8-12 hours');
    expect(output).toContain('🎯 Priority: high');
  });

  it('should handle tasks without phase', () => {
    const planWithoutPhases: Plan = {
      ...mockPlan,
      tasks: [
        {
          id: '1',
          description: 'Task without phase',
          relevantCode: [],
        },
      ],
    };

    const output = formatPretty(planWithoutPhases);

    // When there's only one phase, no phase header is shown
    expect(output).toContain('1. ☐ Task without phase');
  });

  it('should handle empty relevant code', () => {
    const planWithoutCode: Plan = {
      ...mockPlan,
      tasks: [
        {
          id: '1',
          description: 'Task without code',
          relevantCode: [],
        },
      ],
    };

    const output = formatPretty(planWithoutCode);

    expect(output).not.toContain('📁');
  });
});

describe('formatMarkdown', () => {
  const mockPlan: Plan = {
    issueNumber: 42,
    title: 'Add user authentication',
    description: 'Implement JWT-based authentication',
    tasks: [
      {
        id: '1',
        description: 'Design authentication flow',
        phase: 'Planning',
        relevantCode: [],
      },
      {
        id: '2',
        description: 'Implement JWT tokens',
        phase: 'Implementation',
        estimatedHours: 4,
        relevantCode: [
          {
            path: 'src/auth/jwt.ts',
            score: 0.85,
            reason: 'JWT utilities',
          },
        ],
      },
    ],
    totalEstimate: '8-12 hours',
    priority: 'high',
    metadata: {
      generatedAt: '2025-01-01T00:00:00Z',
      explorerUsed: true,
      strategy: 'sequential',
    },
  };

  it('should format plan with markdown headers', () => {
    const output = formatMarkdown(mockPlan);

    expect(output).toContain('# Plan: Add user authentication');
    expect(output).toContain('## Tasks');
  });

  it('should include metadata', () => {
    const output = formatMarkdown(mockPlan);

    expect(output).toContain('**Issue:** #42');
    expect(output).toContain('**Priority:** high');
    expect(output).toContain('**Estimated Effort:** 8-12 hours');
    expect(output).toContain('**Generated:**');
  });

  it('should format tasks as markdown checkboxes', () => {
    const output = formatMarkdown(mockPlan);

    expect(output).toContain('- [ ] **Design authentication flow**');
    expect(output).toContain('- [ ] **Implement JWT tokens**');
  });

  it('should include task estimates', () => {
    const output = formatMarkdown(mockPlan);

    expect(output).toContain('- Estimate: ~4h');
  });

  it('should include relevant code with reasons', () => {
    const output = formatMarkdown(mockPlan);

    expect(output).toContain('- Relevant code:');
    expect(output).toContain('- `src/auth/jwt.ts` - JWT utilities');
  });

  it('should group tasks by phase', () => {
    const output = formatMarkdown(mockPlan);

    expect(output).toContain('### Planning');
    expect(output).toContain('### Implementation');
  });

  it('should handle tasks without phase', () => {
    const planWithoutPhases: Plan = {
      ...mockPlan,
      tasks: [
        {
          id: '1',
          description: 'Task without phase',
          relevantCode: [],
        },
      ],
    };

    const output = formatMarkdown(planWithoutPhases);

    // When there's only one phase, no phase header is shown
    expect(output).toContain('- [ ] **Task without phase**');
  });

  it('should include description when present', () => {
    const output = formatMarkdown(mockPlan);

    expect(output).toContain('## Description');
    expect(output).toContain('Implement JWT-based authentication');
  });

  it('should omit description section when not present', () => {
    const planWithoutDescription = {
      ...mockPlan,
      description: undefined,
    } as unknown as Plan;

    const output = formatMarkdown(planWithoutDescription);

    expect(output).not.toContain('## Description');
  });
});

describe('formatJSON', () => {
  const mockPlan: Plan = {
    issueNumber: 42,
    title: 'Add user authentication',
    description: 'Implement JWT-based authentication',
    tasks: [
      {
        id: '1',
        description: 'Design authentication flow',
        relevantCode: [],
      },
    ],
    totalEstimate: '8-12 hours',
    priority: 'high',
    metadata: {
      generatedAt: '2025-01-01T00:00:00Z',
      explorerUsed: true,
      strategy: 'sequential',
    },
  };

  it('should format plan as pretty-printed JSON', () => {
    const output = formatJSON(mockPlan);
    const parsed = JSON.parse(output);

    expect(parsed.issueNumber).toBe(42);
    expect(parsed.title).toBe('Add user authentication');
    expect(parsed.tasks).toHaveLength(1);
  });

  it('should include all plan properties', () => {
    const output = formatJSON(mockPlan);

    expect(output).toContain('"issueNumber": 42');
    expect(output).toContain('"title"');
    expect(output).toContain('"tasks"');
    expect(output).toContain('"metadata"');
  });

  it('should be valid JSON', () => {
    const output = formatJSON(mockPlan);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should be pretty-printed with indentation', () => {
    const output = formatJSON(mockPlan);

    // Check for indentation (2 spaces)
    expect(output).toMatch(/\n\s{2}"issueNumber"/);
  });
});

describe('formatError', () => {
  it('should format error with message', () => {
    const output = formatError('Something went wrong');

    expect(output).toContain('❌ Error: Something went wrong');
  });

  it('should include details when provided', () => {
    const output = formatError('Something went wrong', 'Check the logs for more information');

    expect(output).toContain('❌ Error: Something went wrong');
    expect(output).toContain('Check the logs for more information');
  });

  it('should omit details when not provided', () => {
    const output = formatError('Something went wrong');

    expect(output).toContain('❌ Error: Something went wrong');
    expect(output).not.toContain('undefined');
  });

  it('should include newlines for spacing', () => {
    const output = formatError('Error message');

    expect(output.startsWith('\n')).toBe(true);
    expect(output.endsWith('\n')).toBe(true);
  });
});
