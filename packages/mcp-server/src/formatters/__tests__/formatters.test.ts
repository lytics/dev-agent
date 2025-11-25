/**
 * Tests for CompactFormatter and VerboseFormatter
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import { describe, expect, it } from 'vitest';
import { CompactFormatter, VerboseFormatter } from '../index';

describe('Formatters', () => {
  const mockResults: SearchResult[] = [
    {
      id: 'src/auth/middleware.ts:AuthMiddleware:15',
      score: 0.89,
      metadata: {
        path: 'src/auth/middleware.ts',
        type: 'class',
        language: 'typescript',
        name: 'AuthMiddleware',
        startLine: 15,
        endLine: 42,
        exported: true,
        signature: 'export class AuthMiddleware implements Middleware {...}',
      },
    },
    {
      id: 'src/auth/jwt.ts:verifyToken:5',
      score: 0.84,
      metadata: {
        path: 'src/auth/jwt.ts',
        type: 'function',
        language: 'typescript',
        name: 'verifyToken',
        startLine: 5,
        endLine: 12,
        exported: true,
      },
    },
    {
      id: 'src/db/connection.ts:connectDB:20',
      score: 0.72,
      metadata: {
        path: 'src/db/connection.ts',
        type: 'function',
        language: 'typescript',
        name: 'connectDB',
        startLine: 20,
        endLine: 35,
        exported: false,
      },
    },
  ];

  describe('CompactFormatter', () => {
    it('should format single result compactly', () => {
      const formatter = new CompactFormatter();
      const formatted = formatter.formatResult(mockResults[0]);

      expect(formatted).toContain('[89%]');
      expect(formatted).toContain('class:');
      expect(formatted).toContain('AuthMiddleware');
      expect(formatted).toContain('src/auth/middleware.ts');
      expect(formatted).toContain(':15'); // Line number
    });

    it('should format multiple results', () => {
      const formatter = new CompactFormatter();
      const result = formatter.formatResults(mockResults);

      expect(result.content).toContain('1. [89%]');
      expect(result.content).toContain('2. [84%]');
      expect(result.content).toContain('3. [72%]');
      expect(result.tokenEstimate).toBeGreaterThan(0);
      // Should include token footer
      expect(result.content).toMatch(/🪙 ~\d+ tokens$/);
    });

    it('should respect maxResults option', () => {
      const formatter = new CompactFormatter({ maxResults: 2 });
      const result = formatter.formatResults(mockResults);

      // Count actual result lines (numbered lines)
      const resultLines = result.content.split('\n').filter((l) => /^\d+\./.test(l));
      expect(resultLines).toHaveLength(2); // Only 2 results
    });

    it('should exclude signatures by default', () => {
      const formatter = new CompactFormatter();
      const formatted = formatter.formatResult(mockResults[0]);

      expect(formatted).not.toContain('export class');
      expect(formatted).not.toContain('implements Middleware');
    });

    it('should handle missing metadata gracefully', () => {
      const minimalResult: SearchResult = {
        id: 'test',
        score: 0.5,
        metadata: {},
      };

      const formatter = new CompactFormatter();
      const formatted = formatter.formatResult(minimalResult);

      expect(formatted).toContain('[50%]');
      expect(formatted).not.toContain('undefined');
    });

    it('should estimate tokens reasonably', () => {
      const formatter = new CompactFormatter();
      const tokens = formatter.estimateTokens(mockResults[0]);

      // Should be roughly 20-50 tokens for compact format
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(100);
    });
  });

  describe('VerboseFormatter', () => {
    it('should format single result verbosely', () => {
      const formatter = new VerboseFormatter();
      const formatted = formatter.formatResult(mockResults[0]);

      expect(formatted).toContain('[Score: 89.0%]');
      expect(formatted).toContain('class:');
      expect(formatted).toContain('AuthMiddleware');
      expect(formatted).toContain('Location: src/auth/middleware.ts:15');
      expect(formatted).toContain('Signature:');
      expect(formatted).toContain('export class AuthMiddleware');
      expect(formatted).toContain('Metadata:');
      expect(formatted).toContain('language: typescript');
      expect(formatted).toContain('exported: true');
      expect(formatted).toContain('lines: 28'); // endLine - startLine + 1
    });

    it('should format multiple results with separators', () => {
      const formatter = new VerboseFormatter();
      const result = formatter.formatResults(mockResults);

      expect(result.content).toContain('1. [Score: 89.0%]');
      expect(result.content).toContain('2. [Score: 84.0%]');
      expect(result.content).toContain('3. [Score: 72.0%]');

      // Should have double newlines between results
      expect(result.content).toContain('\n\n');

      // Should include token footer
      expect(result.content).toMatch(/🪙 ~\d+ tokens$/);
    });

    it('should include signatures by default', () => {
      const formatter = new VerboseFormatter();
      const formatted = formatter.formatResult(mockResults[0]);

      expect(formatted).toContain('Signature:');
      expect(formatted).toContain('export class AuthMiddleware');
    });

    it('should handle missing signature gracefully', () => {
      const formatter = new VerboseFormatter();
      const formatted = formatter.formatResult(mockResults[1]);

      // Should not have Signature line if signature is missing
      expect(formatted).not.toContain('Signature:');
    });

    it('should respect maxResults option', () => {
      const formatter = new VerboseFormatter({ maxResults: 2 });
      const result = formatter.formatResults(mockResults);

      expect(result.content).toContain('1.');
      expect(result.content).toContain('2.');
      expect(result.content).not.toContain('3.');
    });

    it('should estimate more tokens than compact', () => {
      const compactFormatter = new CompactFormatter();
      const verboseFormatter = new VerboseFormatter();

      const compactTokens = compactFormatter.estimateTokens(mockResults[0]);
      const verboseTokens = verboseFormatter.estimateTokens(mockResults[0]);

      expect(verboseTokens).toBeGreaterThan(compactTokens);
    });

    it('should handle missing metadata gracefully', () => {
      const minimalResult: SearchResult = {
        id: 'test',
        score: 0.5,
        metadata: {
          name: 'TestFunc',
        },
      };

      const formatter = new VerboseFormatter();
      const formatted = formatter.formatResult(minimalResult);

      expect(formatted).toContain('[Score: 50.0%]');
      expect(formatted).toContain('TestFunc');
      expect(formatted).not.toContain('undefined');
    });
  });

  describe('Token Estimation Comparison', () => {
    it('compact should use ~5x fewer tokens than verbose', () => {
      const compactFormatter = new CompactFormatter();
      const verboseFormatter = new VerboseFormatter();

      const compactResult = compactFormatter.formatResults(mockResults);
      const verboseResult = verboseFormatter.formatResults(mockResults);

      // Verbose should be significantly larger
      expect(verboseResult.tokenEstimate).toBeGreaterThan(compactResult.tokenEstimate * 2);
    });

    it('token estimates should scale with result count', () => {
      const formatter = new CompactFormatter();

      const oneResult = formatter.formatResults([mockResults[0]]);
      const threeResults = formatter.formatResults(mockResults);

      expect(threeResults.tokenEstimate).toBeGreaterThan(oneResult.tokenEstimate * 2);
    });
  });

  describe('Token Footer', () => {
    it('compact formatter should include coin emoji footer', () => {
      const formatter = new CompactFormatter();
      const result = formatter.formatResults(mockResults);

      expect(result.content).toContain('🪙');
      expect(result.content).toMatch(/~\d+ tokens$/);
    });

    it('verbose formatter should include coin emoji footer', () => {
      const formatter = new VerboseFormatter();
      const result = formatter.formatResults(mockResults);

      expect(result.content).toContain('🪙');
      expect(result.content).toMatch(/~\d+ tokens$/);
    });

    it('token footer should match tokenEstimate property', () => {
      const formatter = new CompactFormatter();
      const result = formatter.formatResults(mockResults);

      // Extract token count from footer
      const footerMatch = result.content.match(/🪙 ~(\d+) tokens$/);
      expect(footerMatch).toBeTruthy();

      const footerTokens = Number.parseInt(footerMatch![1], 10);
      expect(footerTokens).toBe(result.tokenEstimate);
    });
  });
});
