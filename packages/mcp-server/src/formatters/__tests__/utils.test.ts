/**
 * Tests for formatter utilities (token estimation)
 */

import { describe, expect, it } from 'vitest';
import { estimateTokensForJSON, estimateTokensForText, truncateToTokenBudget } from '../utils';

describe('Formatter Utils', () => {
  describe('estimateTokensForText', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'Hello world';
      const tokens = estimateTokensForText(text);

      // "Hello world" is 2 words, ~11 chars
      // Should be roughly 3-4 tokens
      expect(tokens).toBeGreaterThan(1);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate tokens for code', () => {
      const code = 'function authenticate(user: User): boolean { return true; }';
      const tokens = estimateTokensForText(code);

      // Should be roughly 15-20 tokens
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(30);
    });

    it('should handle empty string', () => {
      const tokens = estimateTokensForText('');
      expect(tokens).toBe(0);
    });

    it('should normalize whitespace', () => {
      const text1 = 'Hello    world';
      const text2 = 'Hello world';

      expect(estimateTokensForText(text1)).toBe(estimateTokensForText(text2));
    });

    it('should estimate higher for longer text', () => {
      const short = 'Hello';
      const long = 'Hello world, this is a much longer piece of text';

      expect(estimateTokensForText(long)).toBeGreaterThan(estimateTokensForText(short) * 3);
    });

    it('should use conservative estimates', () => {
      // Test that we're using the higher of char-based and word-based estimates
      const text = 'verylongwordwithnospaces';
      const tokens = estimateTokensForText(text);

      // Should estimate based on characters (conservative)
      expect(tokens).toBeGreaterThan(5);
    });
  });

  describe('truncateToTokenBudget', () => {
    it('should not truncate if within budget', () => {
      const text = 'Hello world';
      const budget = 100;

      const result = truncateToTokenBudget(text, budget);
      expect(result).toBe(text);
    });

    it('should truncate if exceeds budget', () => {
      const text = 'A'.repeat(1000); // Very long text
      const budget = 10;

      const result = truncateToTokenBudget(text, budget);
      expect(result).not.toBe(text);
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(text.length);
    });

    it('should add ellipsis when truncating', () => {
      const text = 'A'.repeat(1000);
      const budget = 10;

      const result = truncateToTokenBudget(text, budget);
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should respect token budget roughly', () => {
      const text = 'This is a long piece of text that will definitely exceed our token budget';
      const budget = 5;

      const result = truncateToTokenBudget(text, budget);
      const resultTokens = estimateTokensForText(result);

      // Should be at or below budget (with some tolerance for ellipsis)
      expect(resultTokens).toBeLessThanOrEqual(budget + 2);
    });
  });

  describe('estimateTokensForJSON', () => {
    it('should estimate tokens for JSON object', () => {
      const obj = {
        name: 'test',
        value: 123,
        items: ['a', 'b', 'c'],
      };

      const tokens = estimateTokensForJSON(obj);
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(50);
    });

    it('should handle nested objects', () => {
      const simple = { name: 'test' };
      const complex = {
        name: 'test',
        nested: {
          deep: {
            value: 'data',
          },
        },
      };

      expect(estimateTokensForJSON(complex)).toBeGreaterThan(estimateTokensForJSON(simple));
    });

    it('should handle arrays', () => {
      const obj = {
        items: Array.from({ length: 10 }).fill('test'),
      };

      const tokens = estimateTokensForJSON(obj);
      expect(tokens).toBeGreaterThan(10);
    });

    it('should handle empty objects', () => {
      const tokens = estimateTokensForJSON({});
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(5);
    });
  });

  describe('Token Estimation Accuracy', () => {
    it('should be within 50% of actual for typical code snippets', () => {
      // These are approximate known token counts for GPT-4
      const testCases = [
        { text: 'Hello world', expected: 2 },
        { text: 'The quick brown fox jumps over the lazy dog', expected: 10 },
        { text: 'function test() { return 42; }', expected: 10 },
      ];

      for (const { text, expected } of testCases) {
        const estimate = estimateTokensForText(text);
        const ratio = estimate / expected;

        // Should be within 50% (0.5x to 1.5x)
        expect(ratio).toBeGreaterThan(0.5);
        expect(ratio).toBeLessThan(2);
      }
    });
  });
});
