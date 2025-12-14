// Core scanner types and interfaces

import type { Logger } from '@lytics/kero';

export type DocumentType =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'struct'
  | 'method'
  | 'documentation'
  | 'variable';

/**
 * Information about a function/method that calls this component
 */
export interface CallerInfo {
  /** Name of the calling function/method */
  name: string;
  /** File path where the call originates */
  file: string;
  /** Line number of the call site */
  line: number;
}

/**
 * Information about a function/method called by this component
 */
export interface CalleeInfo {
  /** Name of the called function/method */
  name: string;
  /** File path of the called function (if resolved) */
  file?: string;
  /** Line number of the call within this component */
  line: number;
}

export interface Document {
  id: string; // Unique identifier: file:name:line
  text: string; // Text to embed (for vector search)
  type: DocumentType; // Type of code element
  language: string; // typescript, go, python, rust, markdown

  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  file: string; // Relative path from repo root
  startLine: number; // 1-based line number
  endLine: number;
  name?: string; // Symbol name (function/class name)
  signature?: string; // Full signature
  exported: boolean; // Is it a public API?
  docstring?: string; // Documentation comment
  snippet?: string; // Actual code content (truncated if large)
  imports?: string[]; // File-level imports (module specifiers)

  // Relationship data (call graph)
  callees?: CalleeInfo[]; // Functions/methods this component calls
  // Note: callers are computed at query time via reverse lookup

  // Variable/function metadata
  isArrowFunction?: boolean; // True if variable initialized with arrow function
  isHook?: boolean; // True if name starts with 'use' (React convention)
  isAsync?: boolean; // True if async function/arrow function
  isConstant?: boolean; // True if exported constant (object/array/call expression)
  constantKind?: 'object' | 'array' | 'value'; // Kind of constant initializer

  // Extensible for future use
  custom?: Record<string, unknown>;
}

export interface ScannerCapabilities {
  syntax: boolean; // Basic structure extraction
  types?: boolean; // Type information
  references?: boolean; // Cross-file references
  documentation?: boolean; // Doc comment extraction
}

export interface Scanner {
  readonly language: string;
  readonly capabilities: ScannerCapabilities;

  /**
   * Scan files and extract documents
   * @param files - List of files to scan (relative paths)
   * @param repoRoot - Repository root path
   * @param logger - Optional logger for progress output
   * @param onProgress - Optional callback for progress updates
   */
  scan(
    files: string[],
    repoRoot: string,
    logger?: Logger,
    onProgress?: (filesProcessed: number, totalFiles: number) => void
  ): Promise<Document[]>;

  /**
   * Check if this scanner can handle a file
   */
  canHandle(filePath: string): boolean;
}

export interface ScanResult {
  documents: Document[];
  stats: ScanStats;
}

export interface ScanStats {
  filesScanned: number;
  documentsExtracted: number;
  duration: number; // milliseconds
  errors: ScanError[];
}

export interface ScanError {
  file: string;
  error: string;
  line?: number;
}

/**
 * Progress information during scanning
 */
export interface ScanProgress {
  /** Current scanning phase */
  phase: 'discovery' | 'scanning' | 'complete';
  /** Language being scanned (during 'scanning' phase) */
  language?: string;
  /** Total files to scan */
  filesTotal: number;
  /** Files scanned so far */
  filesScanned: number;
  /** Documents extracted so far */
  documentsExtracted: number;
  /** Current file being processed */
  currentFile?: string;
  /** Number of errors encountered */
  errors: number;
}

export interface ScanOptions {
  repoRoot: string;
  exclude?: string[]; // Glob patterns to exclude (default: see getDefaultExclusions() - deps, build, cache, IDE, etc.)
  include?: string[]; // Glob patterns to include (default: all supported extensions)
  languages?: string[]; // Limit to specific languages (default: all registered scanners)
  /** Logger instance for progress and debug output */
  logger?: Logger;
  /** Callback for progress updates during scanning */
  onProgress?: (progress: ScanProgress) => void;
}
