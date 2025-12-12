/**
 * Subagent Message Schema Tests
 * Validates inter-agent message payloads
 */

import { describe, expect, it } from 'vitest';
import {
  ExplorationRequestSchema,
  GitHubContextRequestSchema,
  PlanningRequestSchema,
  validateExplorationRequest,
  validateGitHubContextRequest,
  validatePlanningRequest,
} from '../messages.js';

describe('PlanningRequestSchema', () => {
  it('should validate valid planning request', () => {
    const input = {
      action: 'plan',
      issueNumber: 42,
      useExplorer: true,
      detailLevel: 'detailed',
      strategy: 'sequential',
    };

    const result = PlanningRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('plan');
      expect(result.data.issueNumber).toBe(42);
      expect(result.data.useExplorer).toBe(true);
    }
  });

  it('should allow optional fields', () => {
    const input = {
      action: 'plan',
      issueNumber: 1,
    };

    const result = PlanningRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject negative issue number', () => {
    const input = {
      action: 'plan',
      issueNumber: -1,
    };

    const result = PlanningRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid action', () => {
    const input = {
      action: 'invalid',
      issueNumber: 1,
    };

    const result = PlanningRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid detail level', () => {
    const input = {
      action: 'plan',
      issueNumber: 1,
      detailLevel: 'invalid',
    };

    const result = PlanningRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('ExplorationRequestSchema', () => {
  it('should validate pattern exploration', () => {
    const input = {
      action: 'pattern' as const,
      query: 'authentication',
      threshold: 0.8,
      limit: 10,
    };

    const result = ExplorationRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success && result.data.action === 'pattern') {
      expect(result.data.action).toBe('pattern');
      expect(result.data.query).toBe('authentication');
    }
  });

  it('should validate similar code search', () => {
    const input = {
      action: 'similar' as const,
      filePath: 'src/auth/token.ts',
    };

    const result = ExplorationRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate relationships query', () => {
    const input = {
      action: 'relationships' as const,
      component: 'MyClass',
      type: 'all' as const,
    };

    const result = ExplorationRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success && result.data.action === 'relationships') {
      expect(result.data.type).toBe('all');
    }
  });

  it('should reject empty query', () => {
    const input = {
      action: 'pattern' as const,
      query: '',
    };

    const result = ExplorationRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid action', () => {
    const input = {
      action: 'invalid',
      query: 'test',
    };

    const result = ExplorationRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject threshold out of range', () => {
    const input = {
      action: 'pattern' as const,
      query: 'test',
      threshold: 1.5,
    };

    const result = ExplorationRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('GitHubContextRequestSchema', () => {
  it('should validate context request for issue', () => {
    const input = {
      action: 'context' as const,
      issueNumber: 42,
    };

    const result = GitHubContextRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('context');
      expect(result.data.issueNumber).toBe(42);
    }
  });

  it('should validate search with options', () => {
    const input = {
      action: 'search' as const,
      query: 'authentication bug',
      searchOptions: {
        type: 'issue',
        state: 'open',
        labels: ['bug', 'high-priority'],
      },
    };

    const result = GitHubContextRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe('authentication bug');
    }
  });

  it('should validate context request', () => {
    const input = {
      action: 'context' as const,
      issueNumber: 42,
      includeCodeContext: true,
    };

    const result = GitHubContextRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should allow requests without optional fields', () => {
    const input = {
      action: 'index' as const,
    };

    const result = GitHubContextRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid action', () => {
    const input = {
      action: 'invalid-action',
    };

    const result = GitHubContextRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('Validation Functions', () => {
  describe('validatePlanningRequest', () => {
    it('should return validated data for valid input', () => {
      const input = {
        action: 'plan',
        issueNumber: 42,
      };

      const result = validatePlanningRequest(input);
      expect(result.action).toBe('plan');
      expect(result.issueNumber).toBe(42);
    });

    it('should throw descriptive error for invalid input', () => {
      const input = {
        action: 'plan',
        issueNumber: 'not-a-number',
      };

      expect(() => validatePlanningRequest(input)).toThrow('Invalid planning request');
      expect(() => validatePlanningRequest(input)).toThrow('issueNumber');
    });
  });

  describe('validateExplorationRequest', () => {
    it('should return validated data for valid input', () => {
      const input = {
        action: 'pattern' as const,
        query: 'auth',
      };

      const result = validateExplorationRequest(input);
      expect(result.action).toBe('pattern');
      if (result.action === 'pattern') {
        expect(result.query).toBe('auth');
      }
    });

    it('should throw descriptive error for invalid input', () => {
      const input = {
        action: 'pattern' as const,
        query: '',
      };

      expect(() => validateExplorationRequest(input)).toThrow('Invalid exploration request');
    });
  });

  describe('validateGitHubContextRequest', () => {
    it('should return validated data for valid input', () => {
      const input = {
        action: 'context' as const,
        issueNumber: 42,
      };

      const result = validateGitHubContextRequest(input);
      expect(result.action).toBe('context');
      expect(result.issueNumber).toBe(42);
    });

    it('should throw descriptive error for invalid input', () => {
      const input = {
        action: 'invalid',
      };

      expect(() => validateGitHubContextRequest(input)).toThrow('Invalid GitHub context request');
    });
  });
});
