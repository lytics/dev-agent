/**
 * Context Assembler Types
 * Types for assembling context packages for LLM consumption
 *
 * Philosophy: Provide raw, structured context - let the LLM do the reasoning
 */

/**
 * GitHub issue with full context
 */
export interface IssueContext {
  /** Issue number */
  number: number;
  /** Issue title */
  title: string;
  /** Issue body (markdown) */
  body: string;
  /** Labels attached to the issue */
  labels: string[];
  /** Issue author username */
  author: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Issue state */
  state: 'open' | 'closed';
  /** Comments on the issue */
  comments: IssueComment[];
}

/**
 * A comment on an issue
 */
export interface IssueComment {
  /** Comment author */
  author: string;
  /** Comment body */
  body: string;
  /** ISO timestamp */
  createdAt: string;
}

/**
 * Relevant code found via semantic search
 */
export interface RelevantCodeContext {
  /** File path */
  file: string;
  /** Component name (function, class, etc.) */
  name: string;
  /** Component type */
  type: string;
  /** Code snippet */
  snippet: string;
  /** Semantic similarity score (0-1) */
  relevanceScore: number;
  /** Why this code is relevant */
  reason: string;
}

/**
 * Patterns detected in the codebase
 */
export interface CodebasePatterns {
  /** Test file naming pattern (e.g., "*.test.ts") */
  testPattern?: string;
  /** Test location pattern (e.g., "__tests__/") */
  testLocation?: string;
  /** Common import patterns */
  importPatterns?: string[];
  /** Detected naming conventions */
  namingConventions?: string;
}

/**
 * Related historical issue or PR
 */
export interface RelatedHistory {
  /** Issue or PR */
  type: 'issue' | 'pr';
  /** Number */
  number: number;
  /** Title */
  title: string;
  /** Current state */
  state: 'open' | 'closed' | 'merged';
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Brief summary if available */
  summary?: string;
}

/**
 * Complete context package for LLM consumption
 */
export interface ContextPackage {
  /** The GitHub issue with full details */
  issue: IssueContext;
  /** Relevant code from semantic search */
  relevantCode: RelevantCodeContext[];
  /** Detected codebase patterns */
  codebasePatterns: CodebasePatterns;
  /** Related closed issues/PRs */
  relatedHistory: RelatedHistory[];
  /** Metadata about the context assembly */
  metadata: ContextMetadata;
}

/**
 * Metadata about context assembly
 */
export interface ContextMetadata {
  /** When the context was assembled */
  generatedAt: string;
  /** Approximate token count */
  tokensUsed: number;
  /** Whether code search was used */
  codeSearchUsed: boolean;
  /** Whether history search was used */
  historySearchUsed: boolean;
  /** Repository path */
  repositoryPath: string;
}

/**
 * Options for context assembly
 */
export interface ContextAssemblyOptions {
  /** Include code snippets from search (default: true) */
  includeCode?: boolean;
  /** Include related issues/PRs (default: true) */
  includeHistory?: boolean;
  /** Include codebase patterns (default: true) */
  includePatterns?: boolean;
  /** Maximum code results (default: 10) */
  maxCodeResults?: number;
  /** Maximum history results (default: 5) */
  maxHistoryResults?: number;
  /** Token budget for output (default: 4000) */
  tokenBudget?: number;
}
