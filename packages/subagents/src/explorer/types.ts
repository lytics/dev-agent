/**
 * Explorer Types
 * Pattern discovery and code exploration
 */

import type { SearchResult } from '@lytics/dev-agent-core';

/**
 * Exploration action types
 */
export type ExplorationAction =
  | 'pattern' // Search for patterns/concepts
  | 'similar' // Find similar code
  | 'relationships' // Find component relationships
  | 'insights'; // Get architectural insights

/**
 * Pattern search request
 */
export interface PatternSearchRequest {
  action: 'pattern';
  query: string; // e.g., "authentication logic"
  limit?: number;
  threshold?: number; // Similarity threshold (0-1)
  fileTypes?: string[]; // Filter by file extension
}

/**
 * Similar code request
 */
export interface SimilarCodeRequest {
  action: 'similar';
  filePath: string; // Reference file
  limit?: number;
  threshold?: number;
}

/**
 * Relationship request
 */
export interface RelationshipRequest {
  action: 'relationships';
  component: string; // Component/class/function name
  type?: 'imports' | 'exports' | 'dependencies' | 'usages' | 'all';
  limit?: number;
}

/**
 * Insights request
 */
export interface InsightsRequest {
  action: 'insights';
  type?: 'patterns' | 'complexity' | 'coverage' | 'all';
}

/**
 * Union of all exploration requests
 */
export type ExplorationRequest =
  | PatternSearchRequest
  | SimilarCodeRequest
  | RelationshipRequest
  | InsightsRequest;

/**
 * Pattern search result
 */
export interface PatternResult {
  action: 'pattern';
  query: string;
  results: SearchResult[];
  totalFound: number;
}

/**
 * Similar code result
 */
export interface SimilarCodeResult {
  action: 'similar';
  referenceFile: string;
  similar: SearchResult[];
  totalFound: number;
}

/**
 * Code relationship
 */
export interface CodeRelationship {
  from: string;
  to: string;
  type: 'imports' | 'exports' | 'uses' | 'extends' | 'implements';
  location: {
    file: string;
    line: number;
  };
}

/**
 * Relationship result
 */
export interface RelationshipResult {
  action: 'relationships';
  component: string;
  relationships: CodeRelationship[];
  totalFound: number;
}

/**
 * Pattern frequency
 */
export interface PatternFrequency {
  pattern: string;
  count: number;
  files: string[];
}

/**
 * Code insights
 */
export interface CodeInsights {
  topPatterns: PatternFrequency[];
  fileCount: number;
  componentCount: number;
  averageComplexity?: number;
  coverage?: {
    indexed: number;
    total: number;
    percentage: number;
  };
}

/**
 * Insights result
 */
export interface InsightsResult {
  action: 'insights';
  insights: CodeInsights;
}

/**
 * Union of all exploration results
 */
export type ExplorationResult =
  | PatternResult
  | SimilarCodeResult
  | RelationshipResult
  | InsightsResult;

/**
 * Exploration error
 */
export interface ExplorationError {
  action: ExplorationAction;
  error: string;
  details?: string;
}
