/**
 * Metadata Extraction Utilities
 * Functions for extracting and typing search result metadata
 */

import type { SearchResult } from '@lytics/dev-agent-core';

/**
 * Search result metadata structure
 */
export interface ResultMetadata {
  path: string;
  type: string;
  language: string;
  name: string;
  startLine?: number;
  endLine?: number;
}

/**
 * Extract typed metadata from search result
 *
 * @param result - Raw search result from indexer
 * @returns Typed metadata object
 *
 * @example
 * ```typescript
 * const result = await indexer.search('MyClass');
 * const metadata = extractMetadata(result[0]);
 * console.log(metadata.path); // '/src/MyClass.ts'
 * ```
 */
export function extractMetadata(result: SearchResult): ResultMetadata {
  return result.metadata as unknown as ResultMetadata;
}

/**
 * Extract file path from search result
 *
 * @param result - Search result
 * @returns File path string
 *
 * @example
 * ```typescript
 * const results = await indexer.search('component');
 * const paths = results.map(extractFilePath);
 * // ['/src/Button.tsx', '/src/Input.tsx', ...]
 * ```
 */
export function extractFilePath(result: SearchResult): string {
  const metadata = extractMetadata(result);
  return metadata.path;
}
