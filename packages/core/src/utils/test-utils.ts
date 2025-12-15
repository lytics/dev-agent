/**
 * Test utilities for file and pattern analysis
 *
 * Provides helpers for detecting and locating test files.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Check if a file path is a test file
 *
 * @param filePath - File path to check
 * @returns True if the file is a test file
 */
export function isTestFile(filePath: string): boolean {
  return filePath.includes('.test.') || filePath.includes('.spec.');
}

/**
 * Find test file for a source file
 *
 * Checks for common patterns: *.test.*, *.spec.*
 *
 * @param sourcePath - Source file path (relative to repository root)
 * @param repositoryPath - Absolute path to repository root
 * @returns Relative path to test file, or null if not found
 */
export async function findTestFile(
  sourcePath: string,
  repositoryPath: string
): Promise<string | null> {
  const ext = path.extname(sourcePath);
  const base = sourcePath.slice(0, -ext.length);

  const patterns = [`${base}.test${ext}`, `${base}.spec${ext}`];

  for (const testPath of patterns) {
    const fullPath = path.join(repositoryPath, testPath);
    try {
      await fs.access(fullPath);
      return testPath;
    } catch {
      // File doesn't exist, try next pattern
    }
  }

  return null;
}
