/**
 * Adapter Framework Types
 */

import type { SubagentCoordinator } from '@lytics/dev-agent-subagents';

// Adapter Metadata
export interface AdapterMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
}

// Adapter Context (provided during initialization)
export interface AdapterContext {
  logger: Logger;
  config: Config;
  /** Optional coordinator for routing through subagents */
  coordinator?: SubagentCoordinator;
}

// Tool Execution Context (provided during tool execution)
export interface ToolExecutionContext extends AdapterContext {
  userId?: string; // For multi-user scenarios
}

// Logger Interface
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string | Error, meta?: Record<string, unknown>): void;
}

// Config Interface
export interface Config {
  repositoryPath: string;
  [key: string]: unknown;
}

/**
 * Structured metadata for MCP tool responses
 * Follows industry best practices (GitHub, Stripe, GraphQL)
 */
export interface MCPMetadata {
  // Cost tracking
  /** Approximate token count (for context window management) */
  tokens: number;

  // Performance
  /** Response time in milliseconds */
  duration_ms: number;
  /** ISO 8601 timestamp of response */
  timestamp: string;

  // Data freshness
  /** Whether response came from cache */
  cached: boolean;

  // Data quality (optional)
  /** Total matches found before limiting */
  results_total?: number;
  /** Number of results in this response */
  results_returned?: number;
  /** Whether results were truncated due to limits */
  results_truncated?: boolean;

  // Related files (optional)
  /** Number of related test files found */
  related_files_count?: number;
}

// Tool Result
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: AdapterError;
  /** Structured metadata about the response */
  metadata?: MCPMetadata;
}

// Adapter Error
export interface AdapterError {
  code: string;
  message: string;
  details?: unknown;
  recoverable?: boolean;
  suggestion?: string;
}

// Validation Result
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: unknown;
}

// Re-export tool definition for convenience
export type { JSONSchema, ToolDefinition } from '../server/protocol/types';
