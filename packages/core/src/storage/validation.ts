/**
 * State File Validation Utilities
 *
 * Following TypeScript Standards Rule #2: No Type Assertions Without Validation
 * State files (JSON) must be validated at runtime to handle corruption/format changes
 *
 * Note: IndexerState validation has been moved to packages/core/src/indexer/schemas/
 * This file now only contains RepositoryMetadata validation
 */

import { z } from 'zod';

/**
 * Repository metadata schema
 */
export const RepositoryMetadataSchema = z.object({
  version: z.string().min(1),
  repository: z.object({
    path: z.string().min(1),
    remote: z.string().optional(), // Can be URL or git remote name
    branch: z.string().optional(),
    lastCommit: z.string().optional(),
    totalCommits: z.number().int().nonnegative().optional(),
  }),
  indexed: z
    .object({
      timestamp: z.union([z.string(), z.coerce.date()]), // Support both string and Date
      files: z.number().int().nonnegative(),
      components: z.number().int().nonnegative(),
      size: z.number().int().nonnegative(),
      languages: z.array(z.string()).optional(),
    })
    .optional(),
  config: z
    .object({
      languages: z.array(z.string()).optional(),
      excludePatterns: z.array(z.string()).optional(),
    })
    .optional(),
  migrated: z
    .object({
      timestamp: z.union([z.string(), z.coerce.date()]), // Support both string and Date
      from: z.string().min(1),
    })
    .optional(),
});

export type RepositoryMetadataData = z.infer<typeof RepositoryMetadataSchema>;

/**
 * Validate repository metadata from JSON
 * Returns null if validation fails (for backward compatibility with current error handling)
 */
export function validateRepositoryMetadata(data: unknown): RepositoryMetadataData | null {
  const result = RepositoryMetadataSchema.safeParse(data);
  return result.success ? result.data : null;
}
