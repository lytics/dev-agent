import { beforeEach, describe, expect, it } from 'vitest';
import type { Document } from '../../scanner/types';
import { StatsAggregator } from '../stats-aggregator';

describe('StatsAggregator', () => {
  let aggregator: StatsAggregator;

  beforeEach(() => {
    aggregator = new StatsAggregator();
  });

  describe('Basic Aggregation', () => {
    it('should aggregate language stats', () => {
      const tsDoc: Document = {
        id: 'test.ts:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'test.ts',
          startLine: 1,
          endLine: 3,
          name: 'test',
          exported: true,
        },
      };

      const jsDoc: Document = {
        id: 'test.js:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'javascript',
        metadata: {
          file: 'test.js',
          startLine: 1,
          endLine: 3,
          name: 'test',
          exported: true,
        },
      };

      aggregator.addDocument(tsDoc);
      aggregator.addDocument(jsDoc);

      const stats = aggregator.getDetailedStats();

      expect(stats.byLanguage.typescript).toEqual({
        files: 1,
        components: 1,
        lines: 3,
      });

      expect(stats.byLanguage.javascript).toEqual({
        files: 1,
        components: 1,
        lines: 3,
      });
    });

    it('should aggregate component type stats', () => {
      const functionDoc: Document = {
        id: 'test.ts:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'test.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      const classDoc: Document = {
        id: 'test.ts:class:5',
        text: 'class Test {}',
        type: 'class',
        language: 'typescript',
        metadata: {
          file: 'test.ts',
          startLine: 5,
          endLine: 7,
          name: 'Test',
          exported: true,
        },
      };

      aggregator.addDocument(functionDoc);
      aggregator.addDocument(classDoc);

      const stats = aggregator.getDetailedStats();

      expect(stats.byComponentType).toEqual({
        function: 1,
        class: 1,
      });
    });

    it('should count multiple documents from same file correctly', () => {
      const doc1: Document = {
        id: 'test.ts:func1:1',
        text: 'function one() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'test.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      const doc2: Document = {
        id: 'test.ts:func2:5',
        text: 'function two() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'test.ts',
          startLine: 5,
          endLine: 7,
          exported: true,
        },
      };

      aggregator.addDocument(doc1);
      aggregator.addDocument(doc2);

      const stats = aggregator.getDetailedStats();

      expect(stats.byLanguage.typescript).toEqual({
        files: 1, // Same file
        components: 2, // Two components
        lines: 6, // 3 + 3 lines
      });
    });
  });

  describe('Package Aggregation', () => {
    it('should aggregate package stats', () => {
      aggregator.registerPackage('packages/core', '@lytics/dev-agent-core');

      const doc: Document = {
        id: 'packages/core/src/test.ts:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'packages/core/src/test.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      aggregator.addDocument(doc);

      const stats = aggregator.getDetailedStats();

      expect(stats.byPackage['packages/core']).toEqual({
        name: '@lytics/dev-agent-core',
        path: 'packages/core',
        files: 1,
        components: 1,
        languages: {
          typescript: 1,
        },
      });
    });

    it('should handle multiple packages', () => {
      aggregator.registerPackage('packages/core', '@lytics/dev-agent-core');
      aggregator.registerPackage('packages/cli', '@lytics/dev-agent-cli');

      const coreDoc: Document = {
        id: 'packages/core/src/test.ts:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'packages/core/src/test.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      const cliDoc: Document = {
        id: 'packages/cli/src/main.ts:func:1',
        text: 'function main() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'packages/cli/src/main.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      aggregator.addDocument(coreDoc);
      aggregator.addDocument(cliDoc);

      const stats = aggregator.getDetailedStats();

      expect(stats.byPackage['packages/core'].components).toBe(1);
      expect(stats.byPackage['packages/cli'].components).toBe(1);
    });

    it('should match most specific package for nested paths', () => {
      aggregator.registerPackage('packages', 'root-package');
      aggregator.registerPackage('packages/core', '@lytics/dev-agent-core');

      const doc: Document = {
        id: 'packages/core/src/test.ts:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'packages/core/src/test.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      aggregator.addDocument(doc);

      const stats = aggregator.getDetailedStats();

      // Should match the more specific package
      expect(stats.byPackage['packages/core'].components).toBe(1);
      expect(stats.byPackage.packages.components).toBe(0);
    });

    it('should handle mixed languages in a package', () => {
      aggregator.registerPackage('packages/core', '@lytics/dev-agent-core');

      const tsDoc: Document = {
        id: 'packages/core/src/test.ts:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'packages/core/src/test.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      const jsDoc: Document = {
        id: 'packages/core/src/util.js:func:1',
        text: 'function util() {}',
        type: 'function',
        language: 'javascript',
        metadata: {
          file: 'packages/core/src/util.js',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      aggregator.addDocument(tsDoc);
      aggregator.addDocument(jsDoc);

      const stats = aggregator.getDetailedStats();

      expect(stats.byPackage['packages/core'].languages).toEqual({
        typescript: 1,
        javascript: 1,
      });
    });
  });

  describe('Multiple Languages', () => {
    it('should handle all supported languages', () => {
      const docs: Document[] = [
        {
          id: 'test.ts:func:1',
          text: 'function test() {}',
          type: 'function',
          language: 'typescript',
          metadata: { file: 'test.ts', startLine: 1, endLine: 3, exported: true },
        },
        {
          id: 'test.js:func:1',
          text: 'function test() {}',
          type: 'function',
          language: 'javascript',
          metadata: { file: 'test.js', startLine: 1, endLine: 3, exported: true },
        },
        {
          id: 'test.go:func:1',
          text: 'func test() {}',
          type: 'function',
          language: 'go',
          metadata: { file: 'test.go', startLine: 1, endLine: 3, exported: true },
        },
        {
          id: 'README.md:doc:1',
          text: '# Documentation',
          type: 'documentation',
          language: 'markdown',
          metadata: { file: 'README.md', startLine: 1, endLine: 10, exported: false },
        },
      ];

      for (const doc of docs) {
        aggregator.addDocument(doc);
      }

      const stats = aggregator.getDetailedStats();

      expect(stats.byLanguage.typescript).toBeDefined();
      expect(stats.byLanguage.javascript).toBeDefined();
      expect(stats.byLanguage.go).toBeDefined();
      expect(stats.byLanguage.markdown).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of documents efficiently', () => {
      const start = Date.now();

      // Simulate 10,000 documents
      for (let i = 0; i < 10000; i++) {
        const doc: Document = {
          id: `file${i}.ts:func:${i}`,
          text: 'function test() {}',
          type: 'function',
          language: 'typescript',
          metadata: {
            file: `file${i}.ts`,
            startLine: 1,
            endLine: 3,
            exported: true,
          },
        };
        aggregator.addDocument(doc);
      }

      const duration = Date.now() - start;
      const stats = aggregator.getDetailedStats();

      // Should complete in reasonable time (<100ms for 10k docs)
      expect(duration).toBeLessThan(100);
      expect(stats.byLanguage.typescript).toBeDefined();
      expect(stats.byLanguage.typescript?.files).toBe(10000);
      expect(stats.byLanguage.typescript?.components).toBe(10000);
    });
  });

  describe('Utility Methods', () => {
    it('should reset all stats', () => {
      const doc: Document = {
        id: 'test.ts:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'test.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      aggregator.addDocument(doc);
      aggregator.reset();

      const stats = aggregator.getDetailedStats();
      const counts = aggregator.getCounts();

      expect(Object.keys(stats.byLanguage).length).toBe(0);
      expect(Object.keys(stats.byComponentType).length).toBe(0);
      expect(counts.files).toBe(0);
    });

    it('should provide accurate counts', () => {
      aggregator.registerPackage('packages/core', '@lytics/dev-agent-core');

      const docs: Document[] = [
        {
          id: 'test.ts:func:1',
          text: 'function test() {}',
          type: 'function',
          language: 'typescript',
          metadata: { file: 'test.ts', startLine: 1, endLine: 3, exported: true },
        },
        {
          id: 'test.ts:class:5',
          text: 'class Test {}',
          type: 'class',
          language: 'typescript',
          metadata: { file: 'test.ts', startLine: 5, endLine: 7, exported: true },
        },
      ];

      for (const doc of docs) {
        aggregator.addDocument(doc);
      }

      const counts = aggregator.getCounts();

      expect(counts.languages).toBe(1); // Only TypeScript
      expect(counts.componentTypes).toBe(2); // function and class
      expect(counts.packages).toBe(1); // One registered package
      expect(counts.files).toBe(1); // One unique file
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty aggregation', () => {
      const stats = aggregator.getDetailedStats();

      expect(stats.byLanguage).toEqual({});
      expect(stats.byComponentType).toEqual({});
      expect(stats.byPackage).toEqual({});
    });

    it('should handle documents without package', () => {
      const doc: Document = {
        id: 'src/test.ts:func:1',
        text: 'function test() {}',
        type: 'function',
        language: 'typescript',
        metadata: {
          file: 'src/test.ts',
          startLine: 1,
          endLine: 3,
          exported: true,
        },
      };

      // No packages registered
      aggregator.addDocument(doc);

      const stats = aggregator.getDetailedStats();

      expect(stats.byLanguage.typescript).toBeDefined();
      expect(stats.byLanguage.typescript?.files).toBe(1);
      expect(Object.keys(stats.byPackage).length).toBe(0);
    });

    it('should handle single-line components', () => {
      const doc: Document = {
        id: 'test.ts:var:1',
        text: 'export const x = 42;',
        type: 'variable',
        language: 'typescript',
        metadata: {
          file: 'test.ts',
          startLine: 1,
          endLine: 1,
          exported: true,
        },
      };

      aggregator.addDocument(doc);

      const stats = aggregator.getDetailedStats();

      expect(stats.byLanguage.typescript).toBeDefined();
      expect(stats.byLanguage.typescript?.lines).toBe(1);
    });
  });
});
