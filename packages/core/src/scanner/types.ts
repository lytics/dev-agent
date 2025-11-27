// Core scanner types and interfaces

export type DocumentType =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'struct'
  | 'method'
  | 'documentation';

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
   */
  scan(files: string[], repoRoot: string): Promise<Document[]>;

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

export interface ScanOptions {
  repoRoot: string;
  exclude?: string[]; // Glob patterns to exclude (default: see getDefaultExclusions() - deps, build, cache, IDE, etc.)
  include?: string[]; // Glob patterns to include (default: all supported extensions)
  languages?: string[]; // Limit to specific languages (default: all registered scanners)
}
