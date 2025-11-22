/**
 * Relationship Building Utilities
 * Functions for creating and managing code relationships
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import type { CodeRelationship } from '../types';
import { extractMetadata } from './metadata';

/**
 * Create a code relationship from a search result
 *
 * @param result - Search result from indexer
 * @param component - Target component name
 * @param type - Relationship type
 * @returns Code relationship object
 *
 * @example
 * ```typescript
 * const rel = createRelationship(result, 'UserService', 'imports');
 * // { from: '/src/auth.ts', to: 'UserService', type: 'imports', ... }
 * ```
 */
export function createRelationship(
  result: SearchResult,
  component: string,
  type: CodeRelationship['type']
): CodeRelationship {
  const metadata = extractMetadata(result);
  return {
    from: metadata.path,
    to: component,
    type,
    location: {
      file: metadata.path,
      line: metadata.startLine || 0,
    },
  };
}

/**
 * Check if a relationship already exists in the array
 *
 * @param relationships - Array of existing relationships
 * @param filePath - File path to check
 * @param line - Line number to check
 * @returns True if relationship exists
 *
 * @example
 * ```typescript
 * if (!isDuplicateRelationship(rels, '/src/file.ts', 42)) {
 *   relationships.push(newRelationship);
 * }
 * ```
 */
export function isDuplicateRelationship(
  relationships: CodeRelationship[],
  filePath: string,
  line: number
): boolean {
  return relationships.some((r) => r.location.file === filePath && r.location.line === line);
}
