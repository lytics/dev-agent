/**
 * Code Analysis Utilities
 * Functions for pattern analysis and coverage calculation
 */

/**
 * Get list of common code patterns to analyze
 *
 * @returns Array of common pattern strings
 *
 * @example
 * ```typescript
 * const patterns = getCommonPatterns();
 * // ['class', 'function', 'interface', ...]
 * ```
 */
export function getCommonPatterns(): string[] {
  return ['class', 'function', 'interface', 'type', 'async', 'export', 'import', 'const'];
}

/**
 * Sort patterns by frequency (descending) and limit to top N
 *
 * @param patterns - Array of pattern frequency objects
 * @param limit - Maximum number of patterns to return
 * @returns Sorted and limited array
 *
 * @example
 * ```typescript
 * const top = sortAndLimitPatterns(allPatterns, 10);
 * // Returns top 10 most frequent patterns
 * ```
 */
export function sortAndLimitPatterns(
  patterns: Array<{ pattern: string; count: number; files: string[] }>,
  limit: number
): Array<{ pattern: string; count: number; files: string[] }> {
  return patterns.sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * Calculate coverage percentage
 *
 * @param indexed - Number of items indexed
 * @param total - Total number of items
 * @returns Coverage object with percentage
 *
 * @example
 * ```typescript
 * const coverage = calculateCoverage(850, 1000);
 * // { indexed: 850, total: 1000, percentage: 85.0 }
 * ```
 */
export function calculateCoverage(
  indexed: number,
  total: number
): { indexed: number; total: number; percentage: number } {
  return {
    indexed,
    total,
    percentage: total > 0 ? (indexed / total) * 100 : 0,
  };
}
