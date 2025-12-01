/**
 * Related Files Utility
 * Finds structurally related files (test files, type files, etc.)
 *
 * Design: Accepts patterns as parameters for future configurability.
 * Currently uses simple heuristics (*.test.*, *.spec.*) that match
 * common conventions across Jest, Vitest, Mocha, etc.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Related file information
 */
export interface RelatedFile {
  /** Path to the source file */
  sourcePath: string;
  /** Path to the related file */
  relatedPath: string;
  /** Type of relationship */
  type: 'test' | 'spec' | 'types' | 'index';
}

/**
 * Pattern function type for generating test file paths
 */
export type TestPatternFn = (base: string, ext: string, dir: string) => string;

/**
 * Default test file patterns (covers most JS/TS projects)
 * - foo.ts -> foo.test.ts
 * - foo.ts -> foo.spec.ts
 *
 * Note: Can be extended via config in future versions to support
 * project-specific patterns like __tests__/, tests/, etc.
 */
export const DEFAULT_TEST_PATTERNS: TestPatternFn[] = [
  // Same directory: foo.ts -> foo.test.ts, foo.spec.ts
  (base: string, ext: string) => `${base}.test${ext}`,
  (base: string, ext: string) => `${base}.spec${ext}`,
];

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path looks like a test file
 */
function isTestFile(filePath: string): boolean {
  return filePath.includes('.test.') || filePath.includes('.spec.');
}

/**
 * Find test file for a given source file
 *
 * @param sourcePath - Path to the source file (relative to repository)
 * @param repositoryPath - Root path of the repository
 * @param patterns - Test file patterns to check (defaults to DEFAULT_TEST_PATTERNS)
 * @returns Related test file if found, null otherwise
 */
export async function findTestFile(
  sourcePath: string,
  repositoryPath: string,
  patterns: TestPatternFn[] = DEFAULT_TEST_PATTERNS
): Promise<RelatedFile | null> {
  // Skip if already a test file
  if (isTestFile(sourcePath)) {
    return null;
  }

  const ext = path.extname(sourcePath);
  const base = sourcePath.slice(0, -ext.length);
  const dir = path.dirname(sourcePath);
  const fullDir = path.join(repositoryPath, dir);

  for (const pattern of patterns) {
    const testPath = pattern(base, ext, fullDir);
    const fullTestPath = testPath.startsWith(repositoryPath)
      ? testPath
      : path.join(repositoryPath, testPath);

    if (await fileExists(fullTestPath)) {
      // Return relative path
      const relatedPath = path.relative(repositoryPath, fullTestPath);
      const type = relatedPath.includes('.spec.') ? 'spec' : 'test';
      return {
        sourcePath,
        relatedPath,
        type,
      };
    }
  }

  return null;
}

/**
 * Find related test files for multiple source files
 *
 * @param sourcePaths - Array of source file paths (relative to repository)
 * @param repositoryPath - Root path of the repository
 * @param patterns - Test file patterns to check (defaults to DEFAULT_TEST_PATTERNS)
 * @returns Array of related files found
 */
export async function findRelatedTestFiles(
  sourcePaths: string[],
  repositoryPath: string,
  patterns: TestPatternFn[] = DEFAULT_TEST_PATTERNS
): Promise<RelatedFile[]> {
  // Deduplicate source paths
  const uniquePaths = [...new Set(sourcePaths)];

  const results = await Promise.all(
    uniquePaths.map((sourcePath) => findTestFile(sourcePath, repositoryPath, patterns))
  );

  // Filter out nulls and deduplicate by relatedPath
  const seen = new Set<string>();
  return results.filter((result): result is RelatedFile => {
    if (result === null) return false;
    if (seen.has(result.relatedPath)) return false;
    seen.add(result.relatedPath);
    return true;
  });
}

/**
 * Format related files as a string for output
 *
 * @param relatedFiles - Array of related files
 * @returns Formatted string
 */
export function formatRelatedFiles(relatedFiles: RelatedFile[]): string {
  if (relatedFiles.length === 0) {
    return '';
  }

  const lines = ['', '---', 'Related test files:'];
  for (const file of relatedFiles) {
    lines.push(`  • ${file.relatedPath}`);
  }

  return lines.join('\n');
}
