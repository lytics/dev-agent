/**
 * File utility functions for CLI commands
 * Pure functions for file operations and validation
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Resolve a file path relative to the repository root
 */
export function resolveFilePath(repositoryPath: string, filePath: string): string {
  return path.resolve(repositoryPath, filePath);
}

/**
 * Normalize a file path to be relative to repository root
 */
export function normalizeFilePath(repositoryPath: string, absolutePath: string): string {
  return path.relative(repositoryPath, absolutePath);
}

/**
 * Read and validate file content
 * @throws Error if file doesn't exist or is empty
 */
export async function readFileContent(filePath: string): Promise<string> {
  // Check if file exists
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read file content
  const content = await fs.readFile(filePath, 'utf-8');

  // Validate content
  if (content.trim().length === 0) {
    throw new Error(`File is empty: ${filePath}`);
  }

  return content;
}

/**
 * Result of reading file for similarity search
 */
export interface FileContentResult {
  content: string;
  absolutePath: string;
  relativePath: string;
}

/**
 * Prepare a file for similarity search
 * Resolves path, reads content, and normalizes paths
 */
export async function prepareFileForSearch(
  repositoryPath: string,
  filePath: string
): Promise<FileContentResult> {
  const absolutePath = resolveFilePath(repositoryPath, filePath);
  const content = await readFileContent(absolutePath);
  const relativePath = normalizeFilePath(repositoryPath, absolutePath);

  return {
    content,
    absolutePath,
    relativePath,
  };
}
