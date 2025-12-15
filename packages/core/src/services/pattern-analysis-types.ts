/**
 * Pattern Analysis Types
 *
 * Defines types for analyzing code patterns in files.
 */

/**
 * File size metrics
 */
export interface FileSizePattern {
  lines: number;
  bytes: number;
}

/**
 * Test coverage pattern
 */
export interface TestingPattern {
  hasTest: boolean;
  testPath?: string;
}

/**
 * Import style pattern
 */
export interface ImportStylePattern {
  style: 'esm' | 'cjs' | 'mixed' | 'unknown';
  importCount: number;
}

/**
 * Error handling style pattern
 */
export interface ErrorHandlingPattern {
  style: 'throw' | 'result' | 'error-return' | 'mixed' | 'unknown';
  examples: string[];
}

/**
 * Type annotation coverage pattern
 */
export interface TypeAnnotationPattern {
  coverage: 'full' | 'partial' | 'minimal' | 'none';
  annotatedCount: number;
  totalCount: number;
}

/**
 * Complete pattern analysis for a file
 */
export interface FilePatterns {
  fileSize: FileSizePattern;
  testing: TestingPattern;
  importStyle: ImportStylePattern;
  errorHandling: ErrorHandlingPattern;
  typeAnnotations: TypeAnnotationPattern;
}

/**
 * File size comparison
 */
export interface FileSizeComparison {
  yourFile: number;
  average: number;
  median: number;
  range: [number, number];
  deviation: 'larger' | 'smaller' | 'similar';
}

/**
 * Testing comparison
 */
export interface TestingComparison {
  yourFile: boolean;
  percentage: number;
  count: { withTest: number; total: number };
}

/**
 * Import style comparison
 */
export interface ImportStyleComparison {
  yourFile: string;
  common: string;
  percentage: number;
  distribution: Record<string, number>;
}

/**
 * Error handling comparison
 */
export interface ErrorHandlingComparison {
  yourFile: string;
  common: string;
  percentage: number;
  distribution: Record<string, number>;
}

/**
 * Type annotation comparison
 */
export interface TypeAnnotationComparison {
  yourFile: string;
  common: string;
  percentage: number;
  distribution: Record<string, number>;
}

/**
 * Complete pattern comparison between target file and similar files
 */
export interface PatternComparison {
  fileSize: FileSizeComparison;
  testing: TestingComparison;
  importStyle: ImportStyleComparison;
  errorHandling: ErrorHandlingComparison;
  typeAnnotations: TypeAnnotationComparison;
}

/**
 * Configuration for pattern analysis service
 */
export interface PatternAnalysisConfig {
  repositoryPath: string;
}
