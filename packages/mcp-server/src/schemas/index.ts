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

/**
 * Status output schema
 */
export const StatusOutputSchema = z.object({
  content: z.string(),
  section: z.string(),
  format: z.string(),
  length: z.number(),
});

export type StatusOutput = z.infer<typeof StatusOutputSchema>;

// ============================================================================
// Health Adapter
// ============================================================================

export const HealthArgsSchema = z
  .object({
    verbose: z.boolean().default(false),
  })
  .strict();

export type HealthArgs = z.infer<typeof HealthArgsSchema>;

// ============================================================================
// Output Schemas (Runtime validation for adapter responses)
// ============================================================================

/**
 * Search output schema
 */
export const SearchOutputSchema = z.object({
  query: z.string(),
  format: z.string(),
  content: z.string(),
});

export type SearchOutput = z.infer<typeof SearchOutputSchema>;

/**
 * GitHub output schema
 */
export const GitHubOutputSchema = z.object({
  action: z.string(),
  format: z.string(),
  content: z.string(),
  resultsTotal: z.number().optional(),
  resultsReturned: z.number().optional(),
});

export type GitHubOutput = z.infer<typeof GitHubOutputSchema>;

/**
 * Health check result schema
 */
export const HealthCheckResultSchema = z.object({
  status: z.enum(['pass', 'warn', 'fail']),
  message: z.string(),
  details: z.any().optional(), // Allow any type for details
});

export const HealthOutputSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number(),
  timestamp: z.string(),
  checks: z.object({
    vectorStorage: HealthCheckResultSchema,
    repository: HealthCheckResultSchema,
    githubIndex: HealthCheckResultSchema.optional(),
  }),
  formattedReport: z.string(),
});

export type HealthOutput = z.infer<typeof HealthOutputSchema>;

/**
 * Map output schema
 */
export const MapOutputSchema = z.object({
  content: z.string(),
  totalComponents: z.number(),
  totalDirectories: z.number(),
  depth: z.number(),
  focus: z.string().nullable(),
  truncated: z.boolean(),
});

export type MapOutput = z.infer<typeof MapOutputSchema>;

/**
 * Plan output schema
 */
export const PlanOutputSchema = z.object({
  issue: z.number(),
  format: z.string(),
  content: z.string(),
  context: z.any().optional(), // Complex nested structure, can refine later
});

export type PlanOutput = z.infer<typeof PlanOutputSchema>;

/**
 * History commit summary schema
 */
export const HistoryCommitSummarySchema = z.object({
  hash: z.string(),
  subject: z.string(),
  author: z.string(),
  date: z.string(),
  filesChanged: z.number(),
});

export const HistoryOutputSchema = z.object({
  searchType: z.enum(['semantic', 'file']),
  query: z.string().optional(),
  file: z.string().optional(),
  commits: z.array(HistoryCommitSummarySchema),
  content: z.string(),
});

export type HistoryOutput = z.infer<typeof HistoryOutputSchema>;

/**
 * Refs result schema (some fields may be undefined in practice)
 */
export const RefResultSchema = z.object({
  name: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  type: z.string().optional(),
});

export const RefsOutputSchema = z.object({
  name: z.string(),
  direction: z.string(),
  content: z.string(),
  target: z.object({
    name: z.string(),
    file: z.string(),
    line: z.number(),
    type: z.string(),
  }),
  callees: z.array(RefResultSchema).optional(),
  callers: z.array(RefResultSchema).optional(),
});

export type RefsOutput = z.infer<typeof RefsOutputSchema>;

/**
 * Explore output schema
 */
export const ExploreOutputSchema = z.object({
  action: z.string(),
  query: z.string(),
  format: z.string(),
  content: z.string(),
});

export type ExploreOutput = z.infer<typeof ExploreOutputSchema>;
