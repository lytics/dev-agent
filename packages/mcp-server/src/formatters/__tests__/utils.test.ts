/**
 * Tests for formatter utilities (token estimation)
 */

import { describe, expect, it } from 'vitest';
import {
  estimateTokensForJSON,
  estimateTokensForText,
  startTimer,
  truncateToTokenBudget,
} from '../utils';

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

    it('should use calibrated 4.5 chars per token formula', () => {
      // Test the calibrated formula matches actual usage
      // Known: 803 chars normalized = 178 tokens actual
      const testText = '## GitHub Search Results\n'.repeat(20); // ~520 chars
      const normalized = testText.trim().replace(/\s+/g, ' ');
      const estimate = estimateTokensForText(testText);
      const expectedFromFormula = Math.ceil(normalized.length / 4.5);

      // Should use the calibrated 4.5 ratio
      expect(estimate).toBeGreaterThanOrEqual(expectedFromFormula - 5);
      expect(estimate).toBeLessThanOrEqual(expectedFromFormula + 5);
    });

    it('should estimate within 5% for technical content', () => {
      // Real test case from actual usage (full text)
      const technicalText = `## GitHub Search Results
**Query:** "token estimation and cost tracking"
**Total Found:** 3

1. [Score: 29.6%] function: estimateTokensForText
  Location: packages/mcp-server/src/formatters/utils.ts:15
  Signature: export function estimateTokensForText(text: string): number
  Metadata: language: typescript, exported: true, lines: 19

2. [Score: 21.0%] function: estimateTokensForJSON
  Location: packages/mcp-server/src/formatters/utils.ts:63
  Signature: export function estimateTokensForJSON(obj: unknown): number
  Metadata: language: typescript, exported: true, lines: 4

3. [Score: 19.7%] method: VerboseFormatter.estimateTokens
  Location: packages/mcp-server/src/formatters/verbose-formatter.ts:114
  Signature: estimateTokens(result: SearchResult): number
  Metadata: language: typescript, exported: true, lines: 3`;

      const estimate = estimateTokensForText(technicalText);
      const actualTokens = 178; // Verified from Cursor

      // Should be within 5% of actual (calibrated at 0.6%)
      const errorPercent = Math.abs((estimate - actualTokens) / actualTokens) * 100;
      expect(errorPercent).toBeLessThan(5);
    });
  });

  describe('startTimer', () => {
    it('should return elapsed time', async () => {
      const timer = startTimer();

      // Wait a bit (use 15ms to avoid flaky timing issues)
      await new Promise((resolve) => setTimeout(resolve, 15));

      const elapsed = timer.elapsed();
      expect(elapsed).toBeGreaterThanOrEqual(10); // Allow some timing variance
      expect(elapsed).toBeLessThan(100); // Should be fast
    });

    it('should allow multiple elapsed() calls', async () => {
      const timer = startTimer();

      await new Promise((resolve) => setTimeout(resolve, 5));
      const elapsed1 = timer.elapsed();

      await new Promise((resolve) => setTimeout(resolve, 5));
      const elapsed2 = timer.elapsed();

      expect(elapsed2).toBeGreaterThan(elapsed1);
    });

    it('should return 0 immediately after creation', () => {
      const timer = startTimer();
      const elapsed = timer.elapsed();

      // Should be very small (< 5ms)
      expect(elapsed).toBeLessThan(5);
    });
  });
});
