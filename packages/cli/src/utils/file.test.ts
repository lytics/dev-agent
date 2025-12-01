/**
 * Unit tests for file utilities
 * Target: 100% coverage for pure utility functions
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatBytes,
  getDirectorySize,
  normalizeFilePath,
  prepareFileForSearch,
  readFileContent,
  resolveFilePath,
} from './file';

describe('File Utilities', () => {
  describe('resolveFilePath', () => {
    it('should resolve relative path to absolute', () => {
      const repoPath = '/home/user/project';
      const filePath = 'src/index.ts';

      const result = resolveFilePath(repoPath, filePath);

      expect(result).toBe('/home/user/project/src/index.ts');
    });

    it('should handle already absolute paths', () => {
      const repoPath = '/home/user/project';
      const filePath = '/home/user/project/src/index.ts';

      const result = resolveFilePath(repoPath, filePath);

      expect(result).toBe('/home/user/project/src/index.ts');
    });

    it('should handle paths with ../', () => {
      const repoPath = '/home/user/project';
      const filePath = 'src/../lib/utils.ts';

      const result = resolveFilePath(repoPath, filePath);

      expect(result).toBe('/home/user/project/lib/utils.ts');
    });

    it('should handle current directory', () => {
      const repoPath = '/home/user/project';
      const filePath = './src/index.ts';

      const result = resolveFilePath(repoPath, filePath);

      expect(result).toBe('/home/user/project/src/index.ts');
    });
  });

  describe('normalizeFilePath', () => {
    it('should create relative path from absolute', () => {
      const repoPath = '/home/user/project';
      const absolutePath = '/home/user/project/src/index.ts';

      const result = normalizeFilePath(repoPath, absolutePath);

      expect(result).toBe('src/index.ts');
    });

    it('should handle paths in subdirectories', () => {
      const repoPath = '/home/user/project';
      const absolutePath = '/home/user/project/packages/core/src/index.ts';

      const result = normalizeFilePath(repoPath, absolutePath);

      expect(result).toBe('packages/core/src/index.ts');
    });

    it('should handle same path', () => {
      const repoPath = '/home/user/project';
      const absolutePath = '/home/user/project';

      const result = normalizeFilePath(repoPath, absolutePath);

      expect(result).toBe('');
    });

    it('should handle paths outside repository', () => {
      const repoPath = '/home/user/project';
      const absolutePath = '/home/user/other/file.ts';

      const result = normalizeFilePath(repoPath, absolutePath);

      expect(result).toContain('..');
    });
  });

  describe('readFileContent', () => {
    let tempDir: string;
    let testFile: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-test-'));
      testFile = path.join(tempDir, 'test.txt');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should read file content', async () => {
      const content = 'Hello, World!';
      await fs.writeFile(testFile, content);

      const result = await readFileContent(testFile);

      expect(result).toBe(content);
    });

    it('should read multiline content', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      await fs.writeFile(testFile, content);

      const result = await readFileContent(testFile);

      expect(result).toBe(content);
    });

    it('should throw error for non-existent file', async () => {
      const nonExistent = path.join(tempDir, 'does-not-exist.txt');

      await expect(readFileContent(nonExistent)).rejects.toThrow('File not found');
    });

    it('should throw error for empty file', async () => {
      await fs.writeFile(testFile, '');

      await expect(readFileContent(testFile)).rejects.toThrow('File is empty');
    });

    it('should throw error for whitespace-only file', async () => {
      await fs.writeFile(testFile, '   \n  \t  \n   ');

      await expect(readFileContent(testFile)).rejects.toThrow('File is empty');
    });

    it('should handle files with leading/trailing whitespace', async () => {
      const content = '  \n  Content  \n  ';
      await fs.writeFile(testFile, content);

      const result = await readFileContent(testFile);

      expect(result).toBe(content);
      expect(result.trim()).toBe('Content');
    });

    it('should handle large files', async () => {
      const content = 'x'.repeat(10000);
      await fs.writeFile(testFile, content);

      const result = await readFileContent(testFile);

      expect(result.length).toBe(10000);
    });

    it('should handle files with special characters', async () => {
      const content = 'Hello 🚀 World\n中文\nΨ';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await readFileContent(testFile);

      expect(result).toBe(content);
    });
  });

  describe('prepareFileForSearch', () => {
    let tempDir: string;
    let testFile: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-test-'));
      testFile = path.join(tempDir, 'test.txt');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should prepare file for search', async () => {
      const content = 'Test content';
      await fs.writeFile(testFile, content);

      const result = await prepareFileForSearch(tempDir, 'test.txt');

      expect(result.content).toBe(content);
      expect(result.absolutePath).toBe(testFile);
      expect(result.relativePath).toBe('test.txt');
    });

    it('should handle nested directories', async () => {
      const subDir = path.join(tempDir, 'src', 'utils');
      await fs.mkdir(subDir, { recursive: true });
      const nestedFile = path.join(subDir, 'helper.ts');
      await fs.writeFile(nestedFile, 'export function helper() {}');

      const result = await prepareFileForSearch(tempDir, 'src/utils/helper.ts');

      expect(result.content).toContain('helper');
      expect(result.relativePath).toBe('src/utils/helper.ts');
    });

    it('should return correct FileContentResult structure', async () => {
      await fs.writeFile(testFile, 'content');

      const result = await prepareFileForSearch(tempDir, 'test.txt');

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('absolutePath');
      expect(result).toHaveProperty('relativePath');
      expect(typeof result.content).toBe('string');
      expect(typeof result.absolutePath).toBe('string');
      expect(typeof result.relativePath).toBe('string');
    });

    it('should throw error for non-existent file', async () => {
      await expect(prepareFileForSearch(tempDir, 'nonexistent.txt')).rejects.toThrow(
        'File not found'
      );
    });

    it('should throw error for empty file', async () => {
      await fs.writeFile(testFile, '');

      await expect(prepareFileForSearch(tempDir, 'test.txt')).rejects.toThrow('File is empty');
    });

    it('should handle absolute path input', async () => {
      await fs.writeFile(testFile, 'content');

      const result = await prepareFileForSearch(tempDir, testFile);

      expect(result.content).toBe('content');
      expect(result.relativePath).toBe('test.txt');
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should round to one decimal place', () => {
      expect(formatBytes(1234567)).toBe('1.2 MB');
    });
  });

  describe('getDirectorySize', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dirsize-test-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should return 0 for empty directory', async () => {
      const size = await getDirectorySize(tempDir);
      expect(size).toBe(0);
    });

    it('should calculate size of single file', async () => {
      const content = 'Hello, World!'; // 13 bytes
      await fs.writeFile(path.join(tempDir, 'test.txt'), content);

      const size = await getDirectorySize(tempDir);
      expect(size).toBe(13);
    });

    it('should calculate size of multiple files', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'aaaa'); // 4 bytes
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'bbbbbb'); // 6 bytes

      const size = await getDirectorySize(tempDir);
      expect(size).toBe(10);
    });

    it('should calculate size recursively', async () => {
      const subDir = path.join(tempDir, 'subdir');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(tempDir, 'root.txt'), '12345'); // 5 bytes
      await fs.writeFile(path.join(subDir, 'nested.txt'), '67890'); // 5 bytes

      const size = await getDirectorySize(tempDir);
      expect(size).toBe(10);
    });

    it('should handle deeply nested directories', async () => {
      const deepDir = path.join(tempDir, 'a', 'b', 'c');
      await fs.mkdir(deepDir, { recursive: true });
      await fs.writeFile(path.join(deepDir, 'deep.txt'), 'content'); // 7 bytes

      const size = await getDirectorySize(tempDir);
      expect(size).toBe(7);
    });

    it('should return 0 for non-existent directory', async () => {
      const size = await getDirectorySize('/nonexistent/path');
      expect(size).toBe(0);
    });

    it('should handle single file path', async () => {
      const filePath = path.join(tempDir, 'single.txt');
      await fs.writeFile(filePath, '12345678'); // 8 bytes

      const size = await getDirectorySize(filePath);
      expect(size).toBe(8);
    });
  });
});
