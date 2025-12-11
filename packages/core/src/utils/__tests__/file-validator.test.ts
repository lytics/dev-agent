/**
 * Tests for file validation utilities
 */

import { describe, expect, it } from 'vitest';
import { type FileSystemValidator, validateFile, validateFiles } from '../file-validator';

// Mock filesystem validator for testing
class MockFileSystemValidator implements FileSystemValidator {
  constructor(
    private existingFiles: Set<string> = new Set(),
    private fileContents: Map<string, string> = new Map(),
    private directories: Set<string> = new Set()
  ) {}

  exists(path: string): boolean {
    return this.existingFiles.has(path) || this.directories.has(path);
  }

  isFile(path: string): boolean {
    return this.existingFiles.has(path);
  }

  readText(path: string): string {
    const content = this.fileContents.get(path);
    if (content === undefined) {
      throw new Error(`Cannot read file: ${path}`);
    }
    return content;
  }

  addFile(path: string, content: string): this {
    this.existingFiles.add(path);
    this.fileContents.set(path, content);
    return this;
  }

  addDirectory(path: string): this {
    this.directories.add(path);
    return this;
  }

  addExistingFile(path: string): this {
    this.existingFiles.add(path);
    return this;
  }
}

describe('validateFile', () => {
  it('should validate existing file with content', () => {
    const mockFs = new MockFileSystemValidator().addFile(
      '/path/to/file.go',
      'package main\n\nfunc main() {}'
    );

    const result = validateFile('file.go', '/path/to/file.go', mockFs);

    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should fail for non-existent file', () => {
    const mockFs = new MockFileSystemValidator();

    const result = validateFile('missing.go', '/path/to/missing.go', mockFs);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('File does not exist');
    expect(result.phase).toBe('fileValidation');
  });

  it('should fail for directory instead of file', () => {
    const mockFs = new MockFileSystemValidator().addDirectory('/path/to/dir');

    const result = validateFile('dir', '/path/to/dir', mockFs);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Not a file (directory or special file)');
    expect(result.phase).toBe('fileValidation');
  });

  it('should fail for empty file', () => {
    const mockFs = new MockFileSystemValidator().addFile('/path/to/empty.go', '');

    const result = validateFile('empty.go', '/path/to/empty.go', mockFs);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Empty file');
    expect(result.phase).toBe('fileValidation');
  });

  it('should fail for whitespace-only file', () => {
    const mockFs = new MockFileSystemValidator().addFile('/path/to/whitespace.go', '   \n\t  \n  ');

    const result = validateFile('whitespace.go', '/path/to/whitespace.go', mockFs);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Empty file');
    expect(result.phase).toBe('fileValidation');
  });

  it('should handle read errors', () => {
    const mockFs = new MockFileSystemValidator();
    // Add file to exists check but not to contents map
    mockFs.addExistingFile('/path/to/unreadable.go');

    const result = validateFile('unreadable.go', '/path/to/unreadable.go', mockFs);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Failed to read file');
    expect(result.phase).toBe('content');
  });
});

describe('validateFiles', () => {
  it('should validate multiple files', () => {
    const mockFs = new MockFileSystemValidator()
      .addFile('/path/good.go', 'package main')
      .addFile('/path/empty.go', '')
      .addDirectory('/path/dir');

    const files = [
      { filePath: 'good.go', absolutePath: '/path/good.go' },
      { filePath: 'empty.go', absolutePath: '/path/empty.go' },
      { filePath: 'dir', absolutePath: '/path/dir' },
      { filePath: 'missing.go', absolutePath: '/path/missing.go' },
    ];

    const results = validateFiles(files, mockFs);

    expect(results).toHaveLength(4);

    expect(results[0].filePath).toBe('good.go');
    expect(results[0].result.isValid).toBe(true);

    expect(results[1].filePath).toBe('empty.go');
    expect(results[1].result.isValid).toBe(false);
    expect(results[1].result.error).toBe('Empty file');

    expect(results[2].filePath).toBe('dir');
    expect(results[2].result.isValid).toBe(false);
    expect(results[2].result.error).toBe('Not a file (directory or special file)');

    expect(results[3].filePath).toBe('missing.go');
    expect(results[3].result.isValid).toBe(false);
    expect(results[3].result.error).toBe('File does not exist');
  });

  it('should handle empty file list', () => {
    const mockFs = new MockFileSystemValidator();

    const results = validateFiles([], mockFs);

    expect(results).toHaveLength(0);
  });
});
