/**
 * Tests for Codebase Map Generation
 */

import { describe, expect, it, vi } from 'vitest';
import type { RepositoryIndexer } from '../../indexer';
import type { SearchResult } from '../../vector/types';
import { formatCodebaseMap, generateCodebaseMap } from '../index';

describe('Codebase Map', () => {
  // Mock search results representing indexed documents
  const mockSearchResults: SearchResult[] = [
    {
      id: 'packages/core/src/scanner/typescript.ts:TypeScriptScanner:19',
      score: 0.9,
      metadata: {
        path: 'packages/core/src/scanner/typescript.ts',
        type: 'class',
        name: 'TypeScriptScanner',
        startLine: 19,
        endLine: 100,
        language: 'typescript',
        exported: true,
      },
    },
    {
      id: 'packages/core/src/scanner/typescript.ts:scan:45',
      score: 0.85,
      metadata: {
        path: 'packages/core/src/scanner/typescript.ts',
        type: 'method',
        name: 'scan',
        startLine: 45,
        endLine: 70,
        language: 'typescript',
        exported: true,
      },
    },
    {
      id: 'packages/core/src/indexer/index.ts:RepositoryIndexer:10',
      score: 0.8,
      metadata: {
        path: 'packages/core/src/indexer/index.ts',
        type: 'class',
        name: 'RepositoryIndexer',
        startLine: 10,
        endLine: 200,
        language: 'typescript',
        exported: true,
      },
    },
    {
      id: 'packages/mcp-server/src/adapters/search-adapter.ts:SearchAdapter:35',
      score: 0.75,
      metadata: {
        path: 'packages/mcp-server/src/adapters/search-adapter.ts',
        type: 'class',
        name: 'SearchAdapter',
        startLine: 35,
        endLine: 150,
        language: 'typescript',
        exported: true,
      },
    },
    {
      id: 'packages/cli/src/cli.ts:main:5',
      score: 0.7,
      metadata: {
        path: 'packages/cli/src/cli.ts',
        type: 'function',
        name: 'main',
        signature: 'function main(args: string[]): Promise<void>',
        startLine: 5,
        endLine: 50,
        language: 'typescript',
        exported: true,
      },
    },
    {
      id: 'packages/core/src/utils/helpers.ts:privateHelper:10',
      score: 0.65,
      metadata: {
        path: 'packages/core/src/utils/helpers.ts',
        type: 'function',
        name: 'privateHelper',
        startLine: 10,
        endLine: 20,
        language: 'typescript',
        exported: false, // Not exported
      },
    },
  ];

  // Create mock indexer
  function createMockIndexer(results: SearchResult[] = mockSearchResults): RepositoryIndexer {
    return {
      search: vi.fn().mockResolvedValue(results),
    } as unknown as RepositoryIndexer;
  }

  describe('generateCodebaseMap', () => {
    it('should generate a map with correct structure', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer);

      expect(map.root).toBeDefined();
      expect(map.root.name).toBe('root');
      expect(map.totalComponents).toBeGreaterThan(0);
      expect(map.totalDirectories).toBeGreaterThan(0);
      expect(map.generatedAt).toBeDefined();
    });

    it('should count components correctly', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer);

      // Should have all mock results counted (root includes all children)
      expect(map.totalComponents).toBeGreaterThanOrEqual(6);
    });

    it('should build directory hierarchy', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 3 });

      // Should have packages as a child of root
      const packagesNode = map.root.children.find((c) => c.name === 'packages');
      expect(packagesNode).toBeDefined();
      expect(packagesNode?.children.length).toBeGreaterThan(0);
    });

    it('should respect depth limit', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 1 });

      // At depth 1, should only have immediate children
      const packagesNode = map.root.children.find((c) => c.name === 'packages');
      expect(packagesNode?.children.length).toBe(0); // Pruned at depth 1
    });

    it('should filter by focus directory', async () => {
      const indexer = createMockIndexer();
      const fullMap = await generateCodebaseMap(indexer);
      const focusedMap = await generateCodebaseMap(indexer, { focus: 'packages/core' });

      // Focused map should have fewer components than full map
      expect(focusedMap.totalComponents).toBeLessThan(fullMap.totalComponents);

      // Root should contain core-related content
      expect(focusedMap.totalComponents).toBeGreaterThan(0);
    });

    it('should extract exports when includeExports is true', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 5, includeExports: true });

      // Find a node with exports
      const findNodeWithExports = (node: typeof map.root): typeof map.root | null => {
        if (node.exports && node.exports.length > 0) return node;
        for (const child of node.children) {
          const found = findNodeWithExports(child);
          if (found) return found;
        }
        return null;
      };

      const nodeWithExports = findNodeWithExports(map.root);
      expect(nodeWithExports).not.toBeNull();
      expect(nodeWithExports?.exports?.[0].name).toBeDefined();
    });

    it('should include signatures in exports when available', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 5, includeExports: true });

      // Find any node with an export that has a signature
      const findExportWithSignature = (
        node: typeof map.root
      ): { name: string; signature?: string } | null => {
        if (node.exports) {
          const withSig = node.exports.find((e) => e.signature);
          if (withSig) return withSig;
        }
        for (const child of node.children) {
          const found = findExportWithSignature(child);
          if (found) return found;
        }
        return null;
      };

      const exportWithSig = findExportWithSignature(map.root);
      expect(exportWithSig).not.toBeNull();
      expect(exportWithSig?.signature).toBe('function main(args: string[]): Promise<void>');
    });

    it('should not include exports when includeExports is false', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 5, includeExports: false });

      // Check that no node has exports
      const hasExports = (node: typeof map.root): boolean => {
        if (node.exports && node.exports.length > 0) return true;
        return node.children.some(hasExports);
      };

      expect(hasExports(map.root)).toBe(false);
    });

    it('should limit exports per directory', async () => {
      // Create results with many exports in one directory
      const manyExports: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        id: `packages/core/src/index.ts:export${i}:${i * 10}`,
        score: 0.9 - i * 0.01,
        metadata: {
          path: 'packages/core/src/index.ts',
          type: 'function',
          name: `export${i}`,
          startLine: i * 10,
          endLine: i * 10 + 5,
          language: 'typescript',
          exported: true,
        },
      }));

      const indexer = createMockIndexer(manyExports);
      const map = await generateCodebaseMap(indexer, {
        depth: 5,
        includeExports: true,
        maxExportsPerDir: 5,
      });

      // Find the src node
      const findNode = (node: typeof map.root, name: string): typeof map.root | null => {
        if (node.name === name) return node;
        for (const child of node.children) {
          const found = findNode(child, name);
          if (found) return found;
        }
        return null;
      };

      const srcNode = findNode(map.root, 'src');
      expect(srcNode?.exports?.length).toBeLessThanOrEqual(5);
    });

    it('should sort children alphabetically', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 3 });

      const packagesNode = map.root.children.find((c) => c.name === 'packages');
      if (packagesNode && packagesNode.children.length > 1) {
        const names = packagesNode.children.map((c) => c.name);
        const sorted = [...names].sort();
        expect(names).toEqual(sorted);
      }
    });
  });

  describe('formatCodebaseMap', () => {
    it('should format map as readable text', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer);
      const output = formatCodebaseMap(map);

      expect(output).toContain('# Codebase Map');
      expect(output).toContain('components');
      expect(output).toContain('directories');
    });

    it('should include tree structure with connectors', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 2 });
      const output = formatCodebaseMap(map);

      // Should have tree connectors
      expect(output).toMatch(/[├└]/);
      expect(output).toMatch(/──/);
    });

    it('should show exports when includeExports is true', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 5, includeExports: true });
      const output = formatCodebaseMap(map, { includeExports: true });

      expect(output).toContain('exports:');
    });

    it('should show signatures in exports when available', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer, { depth: 5, includeExports: true });
      const output = formatCodebaseMap(map, { includeExports: true });

      // The main function has a signature, should appear in output
      expect(output).toContain('function main(args: string[]): Promise<void>');
    });

    it('should truncate long signatures', async () => {
      const longSigResults: SearchResult[] = [
        {
          id: 'src/index.ts:longFunction:1',
          score: 0.9,
          metadata: {
            path: 'src/index.ts',
            type: 'function',
            name: 'longFunction',
            signature:
              'function longFunction(param1: string, param2: number, param3: boolean, param4: object): Promise<ComplexReturnType>',
            exported: true,
          },
        },
      ];

      const indexer = createMockIndexer(longSigResults);
      const map = await generateCodebaseMap(indexer, { depth: 5, includeExports: true });
      const output = formatCodebaseMap(map, { includeExports: true });

      // Should be truncated with ...
      expect(output).toContain('...');
      // Should not contain the full signature
      expect(output).not.toContain('ComplexReturnType');
    });

    it('should show component counts', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer);
      const output = formatCodebaseMap(map);

      expect(output).toMatch(/\d+ components/);
    });

    it('should show total summary', async () => {
      const indexer = createMockIndexer();
      const map = await generateCodebaseMap(indexer);
      const output = formatCodebaseMap(map);

      expect(output).toContain('**Total:**');
      expect(output).toContain('indexed components');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results', async () => {
      const indexer = createMockIndexer([]);
      const map = await generateCodebaseMap(indexer);

      expect(map.totalComponents).toBe(0);
      expect(map.root.children.length).toBe(0);
    });

    it('should handle results with missing path', async () => {
      const resultsWithMissingPath: SearchResult[] = [
        {
          id: 'test:1',
          score: 0.9,
          metadata: {
            type: 'function',
            name: 'test',
            // No path field
          },
        },
      ];

      const indexer = createMockIndexer(resultsWithMissingPath);
      const map = await generateCodebaseMap(indexer);

      // Should not crash, just skip the result
      expect(map.totalComponents).toBe(0);
    });

    it('should handle deeply nested directories', async () => {
      const deepResults: SearchResult[] = [
        {
          id: 'a/b/c/d/e/f/g/file.ts:fn:1',
          score: 0.9,
          metadata: {
            path: 'a/b/c/d/e/f/g/file.ts',
            type: 'function',
            name: 'fn',
            exported: true,
          },
        },
      ];

      const indexer = createMockIndexer(deepResults);
      const map = await generateCodebaseMap(indexer, { depth: 10 });

      expect(map.totalComponents).toBe(1);
    });
  });
});
