/**
 * Zod schemas for MCP adapter validation
 *
 * Following TypeScript Standards Rule #2: No Type Assertions Without Validation
 * See: docs/TYPESCRIPT_STANDARDS.md
 */

import { z } from 'zod';

// ============================================================================
// Shared Base Schemas
// ============================================================================

/**
 * Common format option for output
 */
export const FormatSchema = z.enum(['compact', 'verbose']);

/**
 * Base schema for queries with pagination and formatting
 */
export const BaseQuerySchema = z.object({
  format: FormatSchema.default('compact'),
  limit: z.number().int().min(1).max(50).default(10),
});

// ============================================================================
// Explore Adapter
// ============================================================================

export const ExploreArgsSchema = z
  .object({
    action: z.enum(['pattern', 'similar', 'relationships']),
    query: z.string().min(1, 'Query must be a non-empty string'),
    limit: z.number().int().min(1).max(100).default(10),
    threshold: z.number().min(0).max(1).default(0.7),
    fileTypes: z.array(z.string()).optional(),
    format: FormatSchema.default('compact'),
  })
  .strict(); // Reject unknown properties

export type ExploreArgs = z.infer<typeof ExploreArgsSchema>;

// ============================================================================
// Search Adapter
// ============================================================================

export const SearchArgsSchema = z
  .object({
    query: z.string().min(1, 'Query must be a non-empty string'),
    format: FormatSchema.default('compact'),
    limit: z.number().int().min(1).max(50).default(10),
    scoreThreshold: z.number().min(0).max(1).default(0),
    tokenBudget: z.number().int().min(500).max(10000).optional(),
  })
  .strict();

export type SearchArgs = z.infer<typeof SearchArgsSchema>;

// ============================================================================
// Refs Adapter
// ============================================================================

export const RefsArgsSchema = z
  .object({
    name: z.string().min(1, 'Name must be a non-empty string'),
    direction: z.enum(['callees', 'callers', 'both']).default('both'),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export type RefsArgs = z.infer<typeof RefsArgsSchema>;

// ============================================================================
// Map Adapter
// ============================================================================

export const MapArgsSchema = z
  .object({
    depth: z.number().int().min(1).max(5).default(2),
    focus: z.string().optional(),
    includeExports: z.boolean().default(true),
    includeChangeFrequency: z.boolean().default(false),
    tokenBudget: z.number().int().min(500).max(10000).default(2000),
  })
  .strict();

export type MapArgs = z.infer<typeof MapArgsSchema>;

// ============================================================================
// History Adapter
// ============================================================================

export const HistoryArgsSchema = z
  .object({
    query: z.string().min(1).optional(),
    file: z.string().optional(),
    author: z.string().optional(),
    since: z.string().optional(), // ISO date or relative like "2 weeks ago"
    limit: z.number().int().min(1).max(50).default(10),
    tokenBudget: z.number().int().min(100).max(10000).default(2000),
  })
  .refine((data) => data.query || data.file, {
    message: 'Either query or file must be provided',
  })
  .strict();

export type HistoryArgs = z.infer<typeof HistoryArgsSchema>;

// ============================================================================
// Plan Adapter
// ============================================================================

export const PlanArgsSchema = z
  .object({
    issue: z.number().int().positive({ message: 'Issue number must be a positive integer' }),
    includeCode: z.boolean().default(true),
    includeGitHistory: z.boolean().default(true),
    includePatterns: z.boolean().default(true),
    tokenBudget: z.number().int().min(1000).max(10000).default(4000),
    format: FormatSchema.default('compact'),
  })
  .strict();

export type PlanArgs = z.infer<typeof PlanArgsSchema>;

// ============================================================================
// GitHub Adapter
// ============================================================================

export const GitHubArgsSchema = z
  .object({
    action: z.enum(['search', 'context', 'related']),
    query: z.string().min(1).optional(),
    number: z.number().int().positive().optional(),
    type: z.enum(['issue', 'pull_request']).optional(),
    state: z.enum(['open', 'closed', 'merged']).optional(),
    author: z.string().optional(),
    labels: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(50).default(10),
    format: FormatSchema.default('compact'),
  })
  .refine(
    (data) => {
      // search requires query
      if (data.action === 'search' && !data.query) {
        return false;
      }
      // context/related require number
      if ((data.action === 'context' || data.action === 'related') && !data.number) {
        return false;
      }
      return true;
    },
    {
      message: 'Invalid combination: search requires "query", context/related require "number"',
    }
  )
  .strict();

export type GitHubArgs = z.infer<typeof GitHubArgsSchema>;

// ============================================================================
// Status Adapter
// ============================================================================

export const StatusArgsSchema = z
  .object({
    format: FormatSchema.default('compact'),
    section: z.enum(['summary', 'repo', 'indexes', 'github', 'health']).default('summary'),
  })
  .strict();

export type StatusArgs = z.infer<typeof StatusArgsSchema>;

// ============================================================================
// Health Adapter
// ============================================================================

export const HealthArgsSchema = z
  .object({
    verbose: z.boolean().default(false),
  })
  .strict();

export type HealthArgs = z.infer<typeof HealthArgsSchema>;
