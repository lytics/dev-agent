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
      expect(result.tokens).toBeGreaterThan(0);
      // Token footer moved to metadata, no longer in content
      expect(result.content).not.toContain('🪙');
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

      // Token footer moved to metadata, no longer in content
      expect(result.content).not.toContain('🪙');
      expect(result.tokens).toBeGreaterThan(0);
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

    it('should estimate more tokens than compact when snippets disabled', () => {
      // When snippets are disabled, verbose still has more metadata
      const compactFormatter = new CompactFormatter();
      const verboseFormatter = new VerboseFormatter({
        includeSnippets: false,
        includeImports: false,
      });

      // Use formatResult which includes all the metadata lines
      const compactOutput = compactFormatter.formatResult(mockResults[0]);
      const verboseOutput = verboseFormatter.formatResult(mockResults[0]);

      // Verbose output should be longer (has Location, Signature, Metadata lines)
      expect(verboseOutput.length).toBeGreaterThan(compactOutput.length);
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
      expect(verboseResult.tokens).toBeGreaterThan(compactResult.tokens * 2);
    });

    it('token estimates should scale with result count', () => {
      const formatter = new CompactFormatter();

      const oneResult = formatter.formatResults([mockResults[0]]);
      const threeResults = formatter.formatResults(mockResults);

      expect(threeResults.tokens).toBeGreaterThan(oneResult.tokens * 2);
    });
  });

  describe('Structured Metadata', () => {
    it('compact formatter should return tokens in result object', () => {
      const formatter = new CompactFormatter();
      const result = formatter.formatResults(mockResults);

      // Token info is now in the result object, not the content
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.content).not.toContain('🪙');
    });

    it('verbose formatter should return tokens in result object', () => {
      const formatter = new VerboseFormatter();
      const result = formatter.formatResults(mockResults);

      // Token info is now in the result object, not the content
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.content).not.toContain('🪙');
    });

    it('tokens property should be a positive number', () => {
      const formatter = new CompactFormatter();
      const result = formatter.formatResults(mockResults);

      expect(typeof result.tokens).toBe('number');
      expect(result.tokens).toBeGreaterThan(0);
    });
  });

  describe('Snippet and Import Formatting', () => {
    const resultWithSnippet: SearchResult = {
      id: 'src/auth/handler.ts:handleAuth:45',
      score: 0.85,
      metadata: {
        path: 'src/auth/handler.ts',
        type: 'function',
        language: 'typescript',
        name: 'handleAuth',
        startLine: 45,
        endLine: 67,
        exported: true,
        snippet:
          'export async function handleAuth(req: Request): Promise<Response> {\n  const token = extractToken(req);\n  return validateToken(token);\n}',
        imports: ['./service', '../utils/jwt', 'express'],
      },
    };

    const resultWithManyImports: SearchResult = {
      id: 'src/index.ts:main:1',
      score: 0.75,
      metadata: {
        path: 'src/index.ts',
        type: 'function',
        name: 'main',
        startLine: 1,
        endLine: 10,
        imports: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      },
    };

    describe('CompactFormatter with snippets', () => {
      it('should not include snippet by default', () => {
        const formatter = new CompactFormatter();
        const formatted = formatter.formatResult(resultWithSnippet);

        expect(formatted).not.toContain('export async function');
        expect(formatted).not.toContain('Imports:');
      });

      it('should include snippet when enabled', () => {
        const formatter = new CompactFormatter({ includeSnippets: true });
        const formatted = formatter.formatResult(resultWithSnippet);

        expect(formatted).toContain('export async function handleAuth');
        expect(formatted).toContain('extractToken');
      });

      it('should include imports when enabled', () => {
        const formatter = new CompactFormatter({ includeImports: true });
        const formatted = formatter.formatResult(resultWithSnippet);

        expect(formatted).toContain('Imports:');
        expect(formatted).toContain('./service');
        expect(formatted).toContain('express');
      });

      it('should truncate long import lists', () => {
        const formatter = new CompactFormatter({ includeImports: true });
        const formatted = formatter.formatResult(resultWithManyImports);

        expect(formatted).toContain('Imports:');
        expect(formatted).toContain('a, b, c, d, e');
        expect(formatted).toContain('...');
        expect(formatted).not.toContain('f, g');
      });

      it('should truncate long snippets', () => {
        const longSnippet = Array(20).fill('const x = 1;').join('\n');
        const result: SearchResult = {
          id: 'test',
          score: 0.8,
          metadata: {
            path: 'test.ts',
            type: 'function',
            name: 'test',
            snippet: longSnippet,
          },
        };

        const formatter = new CompactFormatter({ includeSnippets: true, maxSnippetLines: 5 });
        const formatted = formatter.formatResult(result);

        expect(formatted).toContain('// ... 15 more lines');
      });

      it('should increase token estimate with snippets', () => {
        const formatterWithout = new CompactFormatter();
        const formatterWith = new CompactFormatter({ includeSnippets: true, includeImports: true });

        const tokensWithout = formatterWithout.estimateTokens(resultWithSnippet);
        const tokensWith = formatterWith.estimateTokens(resultWithSnippet);

        expect(tokensWith).toBeGreaterThan(tokensWithout);
      });
    });

    describe('VerboseFormatter with snippets', () => {
      it('should include snippet by default', () => {
        const formatter = new VerboseFormatter();
        const formatted = formatter.formatResult(resultWithSnippet);

        expect(formatted).toContain('Code:');
        expect(formatted).toContain('export async function handleAuth');
      });

      it('should include imports by default', () => {
        const formatter = new VerboseFormatter();
        const formatted = formatter.formatResult(resultWithSnippet);

        expect(formatted).toContain('Imports: ./service, ../utils/jwt, express');
      });

      it('should show location with line range', () => {
        const formatter = new VerboseFormatter();
        const formatted = formatter.formatResult(resultWithSnippet);

        expect(formatted).toContain('Location: src/auth/handler.ts:45-67');
      });

      it('should not truncate imports in verbose mode', () => {
        const formatter = new VerboseFormatter();
        const formatted = formatter.formatResult(resultWithManyImports);

        expect(formatted).toContain('Imports: a, b, c, d, e, f, g');
        expect(formatted).not.toContain('...');
      });

      it('should respect maxSnippetLines option', () => {
        const longSnippet = Array(30).fill('const x = 1;').join('\n');
        const result: SearchResult = {
          id: 'test',
          score: 0.8,
          metadata: {
            path: 'test.ts',
            type: 'function',
            name: 'test',
            snippet: longSnippet,
          },
        };

        const formatter = new VerboseFormatter({ maxSnippetLines: 10 });
        const formatted = formatter.formatResult(result);

        expect(formatted).toContain('// ... 20 more lines');
      });

      it('should be able to disable snippets', () => {
        const formatter = new VerboseFormatter({ includeSnippets: false });
        const formatted = formatter.formatResult(resultWithSnippet);

        expect(formatted).not.toContain('Code:');
        expect(formatted).not.toContain('export async function');
      });

      it('should be able to disable imports', () => {
        const formatter = new VerboseFormatter({ includeImports: false });
        const formatted = formatter.formatResult(resultWithSnippet);

        expect(formatted).not.toContain('Imports:');
      });

      it('should increase token estimate with snippets', () => {
        const formatterWithout = new VerboseFormatter({
          includeSnippets: false,
          includeImports: false,
        });
        const formatterWith = new VerboseFormatter();

        const tokensWithout = formatterWithout.estimateTokens(resultWithSnippet);
        const tokensWith = formatterWith.estimateTokens(resultWithSnippet);

        expect(tokensWith).toBeGreaterThan(tokensWithout);
      });
    });

    describe('Empty snippets and imports', () => {
      it('should handle missing snippet gracefully', () => {
        const formatter = new VerboseFormatter();
        const formatted = formatter.formatResult(mockResults[0]);

        expect(formatted).not.toContain('Code:');
      });

      it('should handle missing imports gracefully', () => {
        const formatter = new VerboseFormatter();
        const formatted = formatter.formatResult(mockResults[0]);

        expect(formatted).not.toContain('Imports:');
      });

      it('should handle empty imports array', () => {
        const result: SearchResult = {
          id: 'test',
          score: 0.8,
          metadata: {
            path: 'test.ts',
            type: 'function',
            name: 'test',
            imports: [],
          },
        };

        const formatter = new VerboseFormatter();
        const formatted = formatter.formatResult(result);

        expect(formatted).not.toContain('Imports:');
      });
    });
  });
});
