/**
 * Zod schemas for subagent message validation
 *
 * Following TypeScript Standards Rule #2: No Type Assertions Without Validation
 * Inter-agent message payloads must be validated at runtime
 */

import { z } from 'zod';

/**
 * Planning request schema
 */
export const PlanningRequestSchema = z.object({
  action: z.literal('plan'),
  issueNumber: z.number().int().positive('Issue number must be positive'),
  useExplorer: z.boolean().optional(),
  detailLevel: z.enum(['simple', 'detailed']).optional(),
  strategy: z.enum(['sequential', 'parallel']).optional(),
});

export type PlanningRequestData = z.infer<typeof PlanningRequestSchema>;

/**
 * Exploration request schema (discriminated union)
 */
const PatternSearchRequestSchema = z.object({
  action: z.literal('pattern'),
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  threshold: z.number().min(0).max(1).optional(),
  fileTypes: z.array(z.string()).optional(),
});

const SimilarCodeRequestSchema = z.object({
  action: z.literal('similar'),
  filePath: z.string().min(1),
  limit: z.number().int().positive().optional(),
  threshold: z.number().min(0).max(1).optional(),
});

const RelationshipRequestSchema = z.object({
  action: z.literal('relationships'),
  component: z.string().min(1),
  type: z.enum(['imports', 'exports', 'dependencies', 'usages', 'all']).optional(),
  limit: z.number().int().positive().optional(),
});

const InsightsRequestSchema = z.object({
  action: z.literal('insights'),
  type: z.enum(['patterns', 'complexity', 'coverage', 'all']).optional(),
});

export const ExplorationRequestSchema = z.discriminatedUnion('action', [
  PatternSearchRequestSchema,
  SimilarCodeRequestSchema,
  RelationshipRequestSchema,
  InsightsRequestSchema,
]);

export type ExplorationRequestData = z.infer<typeof ExplorationRequestSchema>;

/**
 * GitHub context request schema
 */
export const GitHubContextRequestSchema = z.object({
  action: z.enum(['index', 'search', 'context', 'related']),
  // For index action
  indexOptions: z.any().optional(),
  // For search action
  query: z.string().optional(),
  searchOptions: z.any().optional(),
  // For context/related actions
  issueNumber: z.number().int().positive().optional(),
  prNumber: z.number().int().positive().optional(),
  // Include code context from Explorer
  includeCodeContext: z.boolean().optional(),
});

export type GitHubContextRequestData = z.infer<typeof GitHubContextRequestSchema>;

/**
 * Validate a subagent message payload
 * Returns validated data or throws descriptive error
 */
export function validatePlanningRequest(payload: unknown): PlanningRequestData {
  const result = PlanningRequestSchema.safeParse(payload);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const path = firstError.path.length > 0 ? `${firstError.path.join('.')}: ` : '';
    throw new Error(`Invalid planning request: ${path}${firstError.message}`);
  }
  return result.data;
}

export function validateExplorationRequest(payload: unknown): ExplorationRequestData {
  const result = ExplorationRequestSchema.safeParse(payload);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const path = firstError.path.length > 0 ? `${firstError.path.join('.')}: ` : '';
    throw new Error(`Invalid exploration request: ${path}${firstError.message}`);
  }
  return result.data;
}

export function validateGitHubContextRequest(payload: unknown): GitHubContextRequestData {
  const result = GitHubContextRequestSchema.safeParse(payload);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const path = firstError.path.length > 0 ? `${firstError.path.join('.')}: ` : '';
    throw new Error(`Invalid GitHub context request: ${path}${firstError.message}`);
  }
  return result.data;
}
