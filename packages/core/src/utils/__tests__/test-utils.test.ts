import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findTestFile, isTestFile } from '../test-utils';

describe('test-utils', () => {
  describe('isTestFile', () => {
    it('should identify .test. files', () => {
      expect(isTestFile('src/utils/helper.test.ts')).toBe(true);
      expect(isTestFile('src/components/Button.test.tsx')).toBe(true);
      expect(isTestFile('lib/parser.test.js')).toBe(true);
    });

    it('should identify .spec. files', () => {
      expect(isTestFile('src/utils/helper.spec.ts')).toBe(true);
      expect(isTestFile('src/components/Button.spec.tsx')).toBe(true);
      expect(isTestFile('lib/parser.spec.js')).toBe(true);
    });

    it('should return false for non-test files', () => {
      expect(isTestFile('src/utils/helper.ts')).toBe(false);
      expect(isTestFile('src/components/Button.tsx')).toBe(false);
      expect(isTestFile('lib/parser.js')).toBe(false);
      expect(isTestFile('README.md')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isTestFile('')).toBe(false);
      expect(isTestFile('test.ts')).toBe(false); // Needs .test. or .spec.
      expect(isTestFile('spec.ts')).toBe(false);
    });
  });

  describe('findTestFile', () => {
    const testDir = path.join(__dirname, '__temp_test_utils__');

    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should find .test. file', async () => {
      // Create source and test file
      const sourceFile = 'helper.ts';
      const testFile = 'helper.test.ts';
      await fs.writeFile(path.join(testDir, sourceFile), '// source');
      await fs.writeFile(path.join(testDir, testFile), '// test');

      const result = await findTestFile(sourceFile, testDir);
      expect(result).toBe(testFile);
    });

    it('should find .spec. file', async () => {
      // Create source and spec file
      const sourceFile = 'parser.ts';
      const specFile = 'parser.spec.ts';
      await fs.writeFile(path.join(testDir, sourceFile), '// source');
      await fs.writeFile(path.join(testDir, specFile), '// spec');

      const result = await findTestFile(sourceFile, testDir);
      expect(result).toBe(specFile);
    });

    it('should prefer .test. over .spec.', async () => {
      // Create source and both test files
      const sourceFile = 'utils.ts';
      const testFile = 'utils.test.ts';
      const specFile = 'utils.spec.ts';
      await fs.writeFile(path.join(testDir, sourceFile), '// source');
      await fs.writeFile(path.join(testDir, testFile), '// test');
      await fs.writeFile(path.join(testDir, specFile), '// spec');

      const result = await findTestFile(sourceFile, testDir);
      expect(result).toBe(testFile); // .test. is checked first
    });

    it('should return null if no test file exists', async () => {
      // Create only source file
      const sourceFile = 'lonely.ts';
      await fs.writeFile(path.join(testDir, sourceFile), '// source');

      const result = await findTestFile(sourceFile, testDir);
      expect(result).toBeNull();
    });

    it('should handle different extensions', async () => {
      // Test with .tsx
      const sourceFile = 'Component.tsx';
      const testFile = 'Component.test.tsx';
      await fs.writeFile(path.join(testDir, sourceFile), '// component');
      await fs.writeFile(path.join(testDir, testFile), '// test');

      const result = await findTestFile(sourceFile, testDir);
      expect(result).toBe(testFile);
    });

    it('should handle nested paths', async () => {
      // Create nested directory structure
      const nestedDir = path.join(testDir, 'src', 'utils');
      await fs.mkdir(nestedDir, { recursive: true });

      const sourceFile = 'src/utils/helper.ts';
      const testFile = 'src/utils/helper.test.ts';
      await fs.writeFile(path.join(testDir, sourceFile), '// source');
      await fs.writeFile(path.join(testDir, testFile), '// test');

      const result = await findTestFile(sourceFile, testDir);
      expect(result).toBe(testFile);
    });
  });
});
