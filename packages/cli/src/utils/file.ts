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

/**
 * Calculate directory size recursively
 * Returns total size in bytes
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return stats.size;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let size = 0;

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        size += stat.size;
      }
    }

    return size;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
