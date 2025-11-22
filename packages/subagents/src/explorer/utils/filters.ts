/**
 * Result Filtering Utilities
 * Functions for filtering and matching search results
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import { extractMetadata } from './metadata';

/**
 * Check if a search result matches a specific file type
 *
 * @param result - Search result to check
 * @param fileTypes - Array of file extensions (e.g., ['.ts', '.tsx'])
 * @returns True if result matches any of the file types
 *
 * @example
 * ```typescript
 * const isTypeScript = matchesFileType(result, ['.ts', '.tsx']);
 * ```
 */
export function matchesFileType(result: SearchResult, fileTypes: string[]): boolean {
  const metadata = extractMetadata(result);
  return fileTypes.some((ext) => metadata.path.endsWith(ext));
}

/**
 * Check if a search result is not the reference file
 *
 * @param result - Search result to check
 * @param referencePath - Reference file path to exclude
 * @returns True if result is not the reference file
 *
 * @example
 * ```typescript
 * const similar = results.filter(r => isNotReferenceFile(r, 'auth.ts'));
 * ```
 */
export function isNotReferenceFile(result: SearchResult, referencePath: string): boolean {
  const metadata = extractMetadata(result);
  return metadata.path !== referencePath;
}
