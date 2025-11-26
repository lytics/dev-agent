import { describe, expect, it } from 'vitest';
import { PromptRegistry } from '../prompts';

describe('PromptRegistry', () => {
  describe('constructor', () => {
    it('should register default prompts on initialization', () => {
      const registry = new PromptRegistry();
      const prompts = registry.listPrompts();

      expect(prompts.length).toBeGreaterThan(0);
    });

    it('should include analyze-issue prompt', () => {
      const registry = new PromptRegistry();

      expect(registry.hasPrompt('analyze-issue')).toBe(true);
    });

    it('should include find-pattern prompt', () => {
      const registry = new PromptRegistry();

      expect(registry.hasPrompt('find-pattern')).toBe(true);
    });

    it('should include repo-overview prompt', () => {
      const registry = new PromptRegistry();

      expect(registry.hasPrompt('repo-overview')).toBe(true);
    });
  });

  describe('listPrompts', () => {
    it('should return all registered prompts', () => {
      const registry = new PromptRegistry();
      const prompts = registry.listPrompts();

      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(5);
    });

    it('should return prompt definitions with name and description', () => {
      const registry = new PromptRegistry();
      const prompts = registry.listPrompts();

      for (const prompt of prompts) {
        expect(prompt.name).toBeDefined();
        expect(prompt.description).toBeDefined();
      }
    });

    it('should include prompt arguments', () => {
      const registry = new PromptRegistry();
      const prompts = registry.listPrompts();
      const analyzeIssue = prompts.find((p) => p.name === 'analyze-issue');

      expect(analyzeIssue?.arguments).toBeDefined();
      expect(analyzeIssue?.arguments?.length).toBeGreaterThan(0);
    });

    it('should mark required arguments', () => {
      const registry = new PromptRegistry();
      const prompts = registry.listPrompts();
      const analyzeIssue = prompts.find((p) => p.name === 'analyze-issue');
      const issueNumArg = analyzeIssue?.arguments?.find((a) => a.name === 'issue_number');

      expect(issueNumArg?.required).toBe(true);
    });
  });

  describe('getPrompt', () => {
    it('should retrieve prompt by name', () => {
      const registry = new PromptRegistry();
      const prompt = registry.getPrompt('analyze-issue', { issue_number: '42' });

      expect(prompt).toBeDefined();
      expect(prompt?.messages).toBeDefined();
    });

    it('should return null for non-existent prompt', () => {
      const registry = new PromptRegistry();
      const prompt = registry.getPrompt('non-existent');

      expect(prompt).toBeNull();
    });

    it('should generate messages with arguments', () => {
      const registry = new PromptRegistry();
      const prompt = registry.getPrompt('analyze-issue', { issue_number: '42' });

      expect(prompt?.messages).toHaveLength(1);
      expect(prompt?.messages[0].role).toBe('user');
      expect(prompt?.messages[0].content.text).toContain('#42');
    });

    it('should include description', () => {
      const registry = new PromptRegistry();
      const prompt = registry.getPrompt('analyze-issue', { issue_number: '42' });

      expect(prompt?.description).toBeDefined();
      expect(prompt?.description).toContain('issue');
    });

    it('should handle prompts without arguments', () => {
      const registry = new PromptRegistry();
      const prompt = registry.getPrompt('repo-overview');

      expect(prompt).toBeDefined();
      expect(prompt?.messages).toBeDefined();
    });

    it('should handle optional arguments', () => {
      const registry = new PromptRegistry();
      const withDetail = registry.getPrompt('analyze-issue', {
        issue_number: '42',
        detail_level: 'simple',
      });
      const withoutDetail = registry.getPrompt('analyze-issue', { issue_number: '42' });

      // When detail_level is provided, it appears in the prompt
      expect(withDetail?.messages[0].content.text).toContain('detailLevel "simple"');
      // When not provided, it doesn't appear
      expect(withoutDetail?.messages[0].content.text).not.toContain('detailLevel');
    });

    it('should use default empty args when not provided', () => {
      const registry = new PromptRegistry();
      const prompt = registry.getPrompt('repo-overview');

      expect(prompt).toBeDefined();
    });

    it('should generate different messages for different args', () => {
      const registry = new PromptRegistry();
      const prompt1 = registry.getPrompt('analyze-issue', { issue_number: '42' });
      const prompt2 = registry.getPrompt('analyze-issue', { issue_number: '99' });

      expect(prompt1?.messages[0].content.text).toContain('#42');
      expect(prompt2?.messages[0].content.text).toContain('#99');
      expect(prompt1?.messages[0].content.text).not.toEqual(prompt2?.messages[0].content.text);
    });
  });

  describe('hasPrompt', () => {
    it('should return true for existing prompt', () => {
      const registry = new PromptRegistry();

      expect(registry.hasPrompt('analyze-issue')).toBe(true);
      expect(registry.hasPrompt('find-pattern')).toBe(true);
    });

    it('should return false for non-existent prompt', () => {
      const registry = new PromptRegistry();

      expect(registry.hasPrompt('non-existent')).toBe(false);
      expect(registry.hasPrompt('random-prompt')).toBe(false);
    });
  });

  describe('default prompts', () => {
    it('should include all expected workflow prompts', () => {
      const registry = new PromptRegistry();
      const expectedPrompts = [
        'analyze-issue',
        'find-pattern',
        'repo-overview',
        'find-similar',
        'search-github',
        'explore-relationships',
        'create-plan',
        'quick-search',
      ];

      for (const name of expectedPrompts) {
        expect(registry.hasPrompt(name)).toBe(true);
      }
    });

    it('should register exactly 8 prompts', () => {
      const registry = new PromptRegistry();
      const prompts = registry.listPrompts();

      expect(prompts).toHaveLength(8);
    });

    it('should provide user-facing messages', () => {
      const registry = new PromptRegistry();
      const prompts = registry.listPrompts();

      for (const promptDef of prompts) {
        // Provide required arguments based on prompt
        const args: Record<string, string> = {};
        if (promptDef.arguments) {
          for (const arg of promptDef.arguments) {
            if (arg.required) {
              args[arg.name] = arg.name === 'issue_number' ? '42' : 'test-value';
            }
          }
        }

        const prompt = registry.getPrompt(promptDef.name, args);
        expect(prompt?.messages[0].role).toBe('user');
        expect(prompt?.messages[0].content.type).toBe('text');
        expect(prompt?.messages[0].content.text.length).toBeGreaterThan(0);
      }
    });
  });
});
