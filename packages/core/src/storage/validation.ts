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
  version: z.string(),
  repository: z.object({
    path: z.string(),
    remote: z.string().optional(),
    branch: z.string().optional(),
    lastCommit: z.string().optional(),
  }),
  indexed: z
    .object({
      timestamp: z.string(),
      files: z.number().int().nonnegative(),
      components: z.number().int().nonnegative(),
      size: z.number().int().nonnegative(),
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
      timestamp: z.string(),
      from: z.string(),
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
