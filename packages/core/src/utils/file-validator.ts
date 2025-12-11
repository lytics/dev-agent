/**
 * File validation utilities
 * Separated for testability and consistency across scanners
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  phase?: 'fileValidation' | 'content';
}

export interface FileSystemValidator {
  exists(path: string): boolean;
  isFile(path: string): boolean;
  readText(path: string): string;
}

/**
 * Default filesystem validator using Node.js APIs
 */
export class NodeFileSystemValidator implements FileSystemValidator {
  private fs = require('node:fs');

  exists(path: string): boolean {
    return this.fs.existsSync(path);
  }

  isFile(path: string): boolean {
    try {
      const stats = this.fs.statSync(path);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  readText(path: string): string {
    return this.fs.readFileSync(path, 'utf-8');
  }
}

/**
 * Validate a single file for processing
 */
export function validateFile(
  _filePath: string,
  absolutePath: string,
  validator: FileSystemValidator
): FileValidationResult {
  // Check if file exists
  if (!validator.exists(absolutePath)) {
    return {
      isValid: false,
      error: 'File does not exist',
      phase: 'fileValidation',
    };
  }

  // Check if it's a file (not a directory)
  if (!validator.isFile(absolutePath)) {
    return {
      isValid: false,
      error: 'Not a file (directory or special file)',
      phase: 'fileValidation',
    };
  }

  // Check file content
  let content: string;
  try {
    content = validator.readText(absolutePath);
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to read file: ${error}`,
      phase: 'content',
    };
  }

  // Check if file is empty
  if (!content || content.trim().length === 0) {
    return {
      isValid: false,
      error: 'Empty file',
      phase: 'fileValidation',
    };
  }

  return { isValid: true };
}

/**
 * Batch validate multiple files
 */
export function validateFiles(
  files: Array<{ filePath: string; absolutePath: string }>,
  validator: FileSystemValidator
): Array<{ filePath: string; result: FileValidationResult }> {
  return files.map(({ filePath, absolutePath }) => ({
    filePath,
    result: validateFile(filePath, absolutePath, validator),
  }));
}
