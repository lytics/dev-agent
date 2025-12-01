/**
 * Tests for Related Files Utility
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TEST_PATTERNS,
  findRelatedTestFiles,
  findTestFile,
  formatRelatedFiles,
  type RelatedFile,
  type TestPatternFn,
} from '../related-files';

describe('Related Files Utility', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'related-files-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('findTestFile', () => {
    it('should find .test.ts sibling', async () => {
      // Create source and test files
      await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export const x = 1;');
      await fs.writeFile(path.join(tempDir, 'utils.test.ts'), 'test("x", () => {});');

      const result = await findTestFile('utils.ts', tempDir);

      expect(result).not.toBeNull();
      expect(result?.relatedPath).toBe('utils.test.ts');
      expect(result?.type).toBe('test');
    });

    it('should find .spec.ts sibling', async () => {
      await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export const x = 1;');
      await fs.writeFile(path.join(tempDir, 'utils.spec.ts'), 'test("x", () => {});');

      const result = await findTestFile('utils.ts', tempDir);

      expect(result).not.toBeNull();
      expect(result?.relatedPath).toBe('utils.spec.ts');
      expect(result?.type).toBe('spec');
    });

    it('should return null for files without tests', async () => {
      await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export const x = 1;');

      const result = await findTestFile('utils.ts', tempDir);

      expect(result).toBeNull();
    });

    it('should return null for test files (skip self)', async () => {
      await fs.writeFile(path.join(tempDir, 'utils.test.ts'), 'test("x", () => {});');

      const result = await findTestFile('utils.test.ts', tempDir);

      expect(result).toBeNull();
    });

    it('should return null for spec files (skip self)', async () => {
      await fs.writeFile(path.join(tempDir, 'utils.spec.ts'), 'test("x", () => {});');

      const result = await findTestFile('utils.spec.ts', tempDir);

      expect(result).toBeNull();
    });

    it('should handle nested directories', async () => {
      await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helper.ts'), 'export const x = 1;');
      await fs.writeFile(
        path.join(tempDir, 'src', 'utils', 'helper.test.ts'),
        'test("x", () => {});'
      );

      const result = await findTestFile('src/utils/helper.ts', tempDir);

      expect(result).not.toBeNull();
      expect(result?.relatedPath).toBe('src/utils/helper.test.ts');
    });
  });

  describe('findRelatedTestFiles', () => {
    it('should find test files for multiple sources', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'export const a = 1;');
      await fs.writeFile(path.join(tempDir, 'a.test.ts'), 'test("a", () => {});');
      await fs.writeFile(path.join(tempDir, 'b.ts'), 'export const b = 1;');
      await fs.writeFile(path.join(tempDir, 'b.test.ts'), 'test("b", () => {});');
      await fs.writeFile(path.join(tempDir, 'c.ts'), 'export const c = 1;');
      // No test for c.ts

      const results = await findRelatedTestFiles(['a.ts', 'b.ts', 'c.ts'], tempDir);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.relatedPath).sort()).toEqual(['a.test.ts', 'b.test.ts']);
    });

    it('should deduplicate source paths', async () => {
      await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export const x = 1;');
      await fs.writeFile(path.join(tempDir, 'utils.test.ts'), 'test("x", () => {});');

      const results = await findRelatedTestFiles(['utils.ts', 'utils.ts', 'utils.ts'], tempDir);

      expect(results).toHaveLength(1);
    });

    it('should return empty array when no tests found', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'export const a = 1;');
      await fs.writeFile(path.join(tempDir, 'b.ts'), 'export const b = 1;');

      const results = await findRelatedTestFiles(['a.ts', 'b.ts'], tempDir);

      expect(results).toEqual([]);
    });

    it('should return empty array for empty input', async () => {
      const results = await findRelatedTestFiles([], tempDir);

      expect(results).toEqual([]);
    });
  });

  describe('formatRelatedFiles', () => {
    it('should format related files as string', () => {
      const files: RelatedFile[] = [
        { sourcePath: 'utils.ts', relatedPath: 'utils.test.ts', type: 'test' },
        { sourcePath: 'helper.ts', relatedPath: 'helper.spec.ts', type: 'spec' },
      ];

      const result = formatRelatedFiles(files);

      expect(result).toContain('Related test files:');
      expect(result).toContain('utils.test.ts');
      expect(result).toContain('helper.spec.ts');
    });

    it('should return empty string for empty array', () => {
      const result = formatRelatedFiles([]);

      expect(result).toBe('');
    });

    it('should include separator line', () => {
      const files: RelatedFile[] = [
        { sourcePath: 'utils.ts', relatedPath: 'utils.test.ts', type: 'test' },
      ];

      const result = formatRelatedFiles(files);

      expect(result).toContain('---');
    });
  });

  describe('custom patterns', () => {
    it('should support custom test patterns', async () => {
      // Create a custom pattern for __tests__ directory
      const customPatterns: TestPatternFn[] = [
        ...DEFAULT_TEST_PATTERNS,
        (base, ext, dir) => path.join(dir, '__tests__', `${path.basename(base)}${ext}`),
      ];

      await fs.mkdir(path.join(tempDir, '__tests__'));
      await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export const x = 1;');
      await fs.writeFile(path.join(tempDir, '__tests__', 'utils.ts'), 'test("x", () => {});');

      const result = await findTestFile('utils.ts', tempDir, customPatterns);

      expect(result).not.toBeNull();
      expect(result?.relatedPath).toBe('__tests__/utils.ts');
    });

    it('should use default patterns when none provided', async () => {
      await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export const x = 1;');
      await fs.writeFile(path.join(tempDir, 'utils.test.ts'), 'test("x", () => {});');

      // Call without patterns parameter - should use defaults
      const result = await findTestFile('utils.ts', tempDir);

      expect(result).not.toBeNull();
      expect(result?.relatedPath).toBe('utils.test.ts');
    });
  });
});
