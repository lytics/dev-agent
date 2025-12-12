/**
 * Schema validation tests
 *
 * These tests validate schemas in isolation (pure functions, no mocks needed)
 * Adapter tests focus on business logic, not validation
 */

import { describe, expect, it } from 'vitest';
import {
  ExploreArgsSchema,
  GitHubArgsSchema,
  HealthArgsSchema,
  HistoryArgsSchema,
  MapArgsSchema,
  PlanArgsSchema,
  RefsArgsSchema,
  SearchArgsSchema,
  StatusArgsSchema,
} from '../index';

describe('ExploreArgsSchema', () => {
  it('should validate valid input', () => {
    const result = ExploreArgsSchema.safeParse({
      action: 'pattern',
      query: 'authentication',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('pattern');
      expect(result.data.limit).toBe(10); // default
    }
  });

  it('should apply defaults', () => {
    const result = ExploreArgsSchema.safeParse({
      action: 'similar',
      query: 'test',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        limit: 10,
        threshold: 0.7,
        format: 'compact',
      });
    }
  });

  it('should reject invalid action', () => {
    const result = ExploreArgsSchema.safeParse({
      action: 'invalid',
      query: 'test',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['action']);
    }
  });

  it('should reject empty query', () => {
    const result = ExploreArgsSchema.safeParse({
      action: 'pattern',
      query: '',
    });

    expect(result.success).toBe(false);
  });

  it('should reject out-of-range limit', () => {
    const result = ExploreArgsSchema.safeParse({
      action: 'pattern',
      query: 'test',
      limit: 200,
    });

    expect(result.success).toBe(false);
  });

  it('should reject out-of-range threshold', () => {
    const result = ExploreArgsSchema.safeParse({
      action: 'pattern',
      query: 'test',
      threshold: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it('should reject unknown properties', () => {
    const result = ExploreArgsSchema.safeParse({
      action: 'pattern',
      query: 'test',
      unknownProp: 'value',
    });

    expect(result.success).toBe(false);
  });
});

describe('SearchArgsSchema', () => {
  it('should validate valid input', () => {
    const result = SearchArgsSchema.safeParse({
      query: 'authentication flow',
    });

    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = SearchArgsSchema.safeParse({
      query: 'test',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        format: 'compact',
        limit: 10,
        scoreThreshold: 0,
      });
    }
  });

  it('should validate tokenBudget range', () => {
    const validResult = SearchArgsSchema.safeParse({
      query: 'test',
      tokenBudget: 5000,
    });
    expect(validResult.success).toBe(true);

    const invalidResult = SearchArgsSchema.safeParse({
      query: 'test',
      tokenBudget: 50000,
    });
    expect(invalidResult.success).toBe(false);
  });
});

describe('RefsArgsSchema', () => {
  it('should validate valid input', () => {
    const result = RefsArgsSchema.safeParse({
      name: 'createPlan',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe('both'); // default
    }
  });

  it('should validate direction values', () => {
    const validDirections = ['callees', 'callers', 'both'];
    for (const direction of validDirections) {
      const result = RefsArgsSchema.safeParse({
        name: 'test',
        direction,
      });
      expect(result.success).toBe(true);
    }

    const invalidResult = RefsArgsSchema.safeParse({
      name: 'test',
      direction: 'invalid',
    });
    expect(invalidResult.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = RefsArgsSchema.safeParse({
      name: '',
    });

    expect(result.success).toBe(false);
  });
});

describe('MapArgsSchema', () => {
  it('should validate valid input with defaults', () => {
    const result = MapArgsSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        depth: 2,
        includeExports: true,
        includeChangeFrequency: false,
        tokenBudget: 2000,
      });
    }
  });

  it('should validate depth range', () => {
    const validResult = MapArgsSchema.safeParse({ depth: 3 });
    expect(validResult.success).toBe(true);

    const tooLowResult = MapArgsSchema.safeParse({ depth: 0 });
    expect(tooLowResult.success).toBe(false);

    const tooHighResult = MapArgsSchema.safeParse({ depth: 10 });
    expect(tooHighResult.success).toBe(false);
  });
});

describe('HistoryArgsSchema', () => {
  it('should validate with query', () => {
    const result = HistoryArgsSchema.safeParse({
      query: 'authentication refactor',
    });

    expect(result.success).toBe(true);
  });

  it('should validate with file', () => {
    const result = HistoryArgsSchema.safeParse({
      file: 'src/auth/token.ts',
    });

    expect(result.success).toBe(true);
  });

  it('should reject when neither query nor file provided', () => {
    const result = HistoryArgsSchema.safeParse({
      author: 'john@example.com',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('query or file');
    }
  });

  it('should accept both query and file', () => {
    const result = HistoryArgsSchema.safeParse({
      query: 'bug fix',
      file: 'src/index.ts',
    });

    expect(result.success).toBe(true);
  });
});

describe('PlanArgsSchema', () => {
  it('should validate valid input', () => {
    const result = PlanArgsSchema.safeParse({
      issue: 42,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        includeCode: true,
        includeGitHistory: true,
        includePatterns: true,
        tokenBudget: 4000,
        format: 'compact',
      });
    }
  });

  it('should reject non-positive issue numbers', () => {
    const zeroResult = PlanArgsSchema.safeParse({ issue: 0 });
    expect(zeroResult.success).toBe(false);

    const negativeResult = PlanArgsSchema.safeParse({ issue: -1 });
    expect(negativeResult.success).toBe(false);
  });

  it('should reject non-integer issue numbers', () => {
    const result = PlanArgsSchema.safeParse({ issue: 42.5 });
    expect(result.success).toBe(false);
  });
});

describe('GitHubArgsSchema', () => {
  it('should validate search action with query', () => {
    const result = GitHubArgsSchema.safeParse({
      action: 'search',
      query: 'authentication bug',
    });

    expect(result.success).toBe(true);
  });

  it('should reject search action without query', () => {
    const result = GitHubArgsSchema.safeParse({
      action: 'search',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('query');
    }
  });

  it('should validate context action with number', () => {
    const result = GitHubArgsSchema.safeParse({
      action: 'context',
      number: 42,
    });

    expect(result.success).toBe(true);
  });

  it('should reject context action without number', () => {
    const result = GitHubArgsSchema.safeParse({
      action: 'context',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('number');
    }
  });

  it('should validate related action with number', () => {
    const result = GitHubArgsSchema.safeParse({
      action: 'related',
      number: 42,
    });

    expect(result.success).toBe(true);
  });

  it('should validate optional filters', () => {
    const result = GitHubArgsSchema.safeParse({
      action: 'search',
      query: 'bug',
      type: 'issue',
      state: 'open',
      author: 'username',
      labels: ['bug', 'urgent'],
    });

    expect(result.success).toBe(true);
  });
});

describe('StatusArgsSchema', () => {
  it('should validate with defaults', () => {
    const result = StatusArgsSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        format: 'compact',
        section: 'summary',
      });
    }
  });

  it('should validate all section values', () => {
    const sections = ['summary', 'repo', 'indexes', 'github', 'health'];
    for (const section of sections) {
      const result = StatusArgsSchema.safeParse({ section });
      expect(result.success).toBe(true);
    }
  });
});

describe('HealthArgsSchema', () => {
  it('should validate with default', () => {
    const result = HealthArgsSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verbose).toBe(false);
    }
  });

  it('should validate verbose flag', () => {
    const result = HealthArgsSchema.safeParse({ verbose: true });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verbose).toBe(true);
    }
  });

  it('should reject unknown properties', () => {
    const result = HealthArgsSchema.safeParse({
      verbose: true,
      unknownProp: 'value',
    });

    expect(result.success).toBe(false);
  });
});
