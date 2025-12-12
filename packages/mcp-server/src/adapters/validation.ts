/**
 * Validation utilities for MCP adapters
 *
 * Following TypeScript Standards:
 * - Rule #2: No Type Assertions Without Validation
 * - Result types for explicit error handling
 */

import type { z } from 'zod';
import type { ToolResult } from './types';

/**
 * Convert Zod validation error to ToolResult format
 *
 * Provides detailed error messages with field paths
 */
export function handleValidationError(error: z.ZodError): ToolResult {
  const firstError = error.issues[0];
  const path = firstError.path.length > 0 ? `${firstError.path.join('.')}: ` : '';

  return {
    success: false,
    error: {
      code: 'INVALID_PARAMS',
      message: `${path}${firstError.message}`,
      details: error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
      recoverable: true,
      suggestion: 'Check the tool input schema and try again',
    },
  };
}

/**
 * Type-safe validation wrapper
 *
 * Returns either validated data or a ToolResult error
 *
 * @example
 * ```typescript
 * const validation = validateArgs(ExploreArgsSchema, args);
 * if (!validation.success) {
 *   return validation.error;
 * }
 * // validation.data is now fully typed!
 * const { action, query } = validation.data;
 * ```
 */
export function validateArgs<T extends z.ZodType>(
  schema: T,
  args: unknown
): { success: true; data: z.infer<T> } | { success: false; error: ToolResult } {
  const result = schema.safeParse(args);

  if (!result.success) {
    return {
      success: false,
      error: handleValidationError(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
