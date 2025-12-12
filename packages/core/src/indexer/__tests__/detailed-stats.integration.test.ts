import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RepositoryIndexer } from '../index';
import type { DetailedIndexStats } from '../types';

describe('Detailed Stats Integration', () => {
  let testDir: string;
  let vectorStorePath: string;

  beforeEach(async () => {
    // Create temp directory
    testDir = path.join(os.tmpdir(), `test-detailed-stats-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    vectorStorePath = path.join(testDir, 'vectors.lance');
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should collect detailed language stats', async () => {
    // Create test files with different languages
    const srcDir = path.join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    await fs.writeFile(
      path.join(srcDir, 'test.ts'),
      `
      export function hello(): string {
        return "Hello from TypeScript";
      }

      export class Greeter {
        greet(): string {
          return "Hello";
        }
      }
    `
    );

    await fs.writeFile(
      path.join(srcDir, 'test.js'),
      `
      function goodbye() {
        return "Goodbye from JavaScript";
      }

      module.exports = { goodbye };
    `
    );

    // Index the repository
    const indexer = new RepositoryIndexer({
      repositoryPath: testDir,
      vectorStorePath,
    });

    await indexer.initialize();
    const stats = (await indexer.index()) as DetailedIndexStats;
    await indexer.close();

    // Verify language stats
    expect(stats.byLanguage).toBeDefined();
    expect(stats.byLanguage?.typescript).toBeDefined();
    expect(stats.byLanguage?.javascript).toBeDefined();

    // TypeScript should have 2 components (function + class)
    expect(stats.byLanguage?.typescript.files).toBe(1);
    expect(stats.byLanguage?.typescript.components).toBeGreaterThanOrEqual(2);

    // JavaScript should have 1 component (function)
    expect(stats.byLanguage?.javascript.files).toBe(1);
    expect(stats.byLanguage?.javascript.components).toBeGreaterThanOrEqual(1);
  });

  it('should collect component type stats', async () => {
    const srcDir = path.join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    await fs.writeFile(
      path.join(srcDir, 'components.ts'),
      `
      export function myFunction(): void {}
      export class MyClass {}
      export interface MyInterface {
        prop: string;
      }
      export type MyType = string | number;
      export const useCustomHook = () => {
        return { value: 42 };
      };
    `
    );

    const indexer = new RepositoryIndexer({
      repositoryPath: testDir,
      vectorStorePath,
    });

    await indexer.initialize();
    const stats = (await indexer.index()) as DetailedIndexStats;
    await indexer.close();

    // Verify component type stats
    expect(stats.byComponentType).toBeDefined();
    expect(stats.byComponentType?.function).toBeGreaterThanOrEqual(1);
    expect(stats.byComponentType?.class).toBeGreaterThanOrEqual(1);
    expect(stats.byComponentType?.interface).toBeGreaterThanOrEqual(1);
    expect(stats.byComponentType?.type).toBeGreaterThanOrEqual(1);
    // Variable type might be present if arrow function is detected
    if (stats.byComponentType?.variable) {
      expect(stats.byComponentType?.variable).toBeGreaterThanOrEqual(1);
    }
  });

  it('should collect stats for mixed language repository', async () => {
    const srcDir = path.join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    // TypeScript file
    await fs.writeFile(
      path.join(srcDir, 'utils.ts'),
      `
      export function add(a: number, b: number): number {
        return a + b;
      }
    `
    );

    // JavaScript file
    await fs.writeFile(
      path.join(srcDir, 'legacy.js'),
      `
      function multiply(a, b) {
        return a * b;
      }
    `
    );

    // Markdown file
    await fs.writeFile(
      path.join(testDir, 'README.md'),
      `
# Test Project

This is a test project.
    `
    );

    const indexer = new RepositoryIndexer({
      repositoryPath: testDir,
      vectorStorePath,
    });

    await indexer.initialize();
    const stats = (await indexer.index()) as DetailedIndexStats;
    await indexer.close();

    // Should have stats for all three languages
    expect(stats.byLanguage).toBeDefined();
    if (stats.byLanguage) {
      expect(Object.keys(stats.byLanguage).length).toBeGreaterThanOrEqual(3);
    }

    // Verify each language has file count
    expect(stats.byLanguage?.typescript?.files).toBeGreaterThanOrEqual(1);
    expect(stats.byLanguage?.javascript?.files).toBeGreaterThanOrEqual(1);
    expect(stats.byLanguage?.markdown?.files).toBeGreaterThanOrEqual(1);
  });

  it('should handle incremental updates with stats', async () => {
    const srcDir = path.join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    // Initial file
    await fs.writeFile(
      path.join(srcDir, 'initial.ts'),
      `
      export function initial(): string {
        return "initial";
      }
    `
    );

    const indexer = new RepositoryIndexer({
      repositoryPath: testDir,
      vectorStorePath,
    });

    await indexer.initialize();
    const _initialStats = (await indexer.index()) as DetailedIndexStats;

    // Add new file
    await fs.writeFile(
      path.join(srcDir, 'added.js'),
      `
      function added() {
        return "added";
      }
    `
    );

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update index
    const updateStats = (await indexer.update({
      since: new Date(Date.now() - 1000),
    })) as DetailedIndexStats;

    await indexer.close();

    // Verify update stats show the new JavaScript file
    expect(updateStats.byLanguage).toBeDefined();
    expect(updateStats.byLanguage?.javascript).toBeDefined();
    expect(updateStats.byLanguage?.javascript.files).toBeGreaterThanOrEqual(1);
  });

  it('should calculate line counts correctly', async () => {
    const srcDir = path.join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    await fs.writeFile(
      path.join(srcDir, 'multiline.ts'),
      `
      export function longFunction(): void {
        // Line 1
        // Line 2
        // Line 3
        // Line 4
        // Line 5
        console.log("This is a long function");
      }
    `
    );

    const indexer = new RepositoryIndexer({
      repositoryPath: testDir,
      vectorStorePath,
    });

    await indexer.initialize();
    const stats = (await indexer.index()) as DetailedIndexStats;
    await indexer.close();

    // Verify line count is captured
    expect(stats.byLanguage?.typescript.lines).toBeGreaterThan(0);
  });

  it('should handle empty repository gracefully', async () => {
    // Empty directory - no source files
    const indexer = new RepositoryIndexer({
      repositoryPath: testDir,
      vectorStorePath,
    });

    await indexer.initialize();
    const stats = (await indexer.index()) as DetailedIndexStats;
    await indexer.close();

    // Should have empty stats
    expect(stats.byLanguage).toBeDefined();
    if (stats.byLanguage) {
      expect(Object.keys(stats.byLanguage).length).toBe(0);
    }
    expect(stats.byComponentType).toBeDefined();
    if (stats.byComponentType) {
      expect(Object.keys(stats.byComponentType).length).toBe(0);
    }
  });
});
