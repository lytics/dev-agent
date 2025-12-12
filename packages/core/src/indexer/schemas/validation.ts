/**
 * Validation utilities for indexer statistics
 * Provides safe, type-checked validation with helpful error messages
 */

import type { ZodError } from 'zod';
import type {
  DetailedIndexStats,
  FileMetadata,
  IndexerState,
  IndexStats,
  LanguageStats,
  PackageStats,
  StatsMetadata,
} from './stats.js';
import {
  DetailedIndexStatsSchema,
  FileMetadataSchema,
  IndexerStateSchema,
  IndexStatsSchema,
  LanguageStatsSchema,
  PackageStatsSchema,
  StatsMetadataSchema,
} from './stats.js';

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details: ZodError };

/**
 * Validate LanguageStats
 */
export function validateLanguageStats(data: unknown): ValidationResult<LanguageStats> {
  const result = LanguageStatsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: `Invalid language stats: ${result.error.message}`,
    details: result.error,
  };
}

/**
 * Validate PackageStats
 */
export function validatePackageStats(data: unknown): ValidationResult<PackageStats> {
  const result = PackageStatsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: `Invalid package stats: ${result.error.message}`,
    details: result.error,
  };
}

/**
 * Validate StatsMetadata
 */
export function validateStatsMetadata(data: unknown): ValidationResult<StatsMetadata> {
  const result = StatsMetadataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: `Invalid stats metadata: ${result.error.message}`,
    details: result.error,
  };
}

/**
 * Validate IndexStats
 */
export function validateIndexStats(data: unknown): ValidationResult<IndexStats> {
  const result = IndexStatsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: `Invalid index stats: ${result.error.message}`,
    details: result.error,
  };
}

/**
 * Validate DetailedIndexStats
 */
export function validateDetailedIndexStats(data: unknown): ValidationResult<DetailedIndexStats> {
  const result = DetailedIndexStatsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: `Invalid detailed index stats: ${result.error.message}`,
    details: result.error,
  };
}

/**
 * Validate FileMetadata
 */
export function validateFileMetadata(data: unknown): ValidationResult<FileMetadata> {
  const result = FileMetadataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: `Invalid file metadata: ${result.error.message}`,
    details: result.error,
  };
}

/**
 * Validate IndexerState
 */
export function validateIndexerState(data: unknown): ValidationResult<IndexerState> {
  const result = IndexerStateSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: `Invalid indexer state: ${result.error.message}`,
    details: result.error,
  };
}

/**
 * Validate and coerce unknown data to DetailedIndexStats
 * Throws on validation failure (for use in trusted contexts)
 */
export function assertDetailedIndexStats(data: unknown): DetailedIndexStats {
  const result = validateDetailedIndexStats(data);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Validate and coerce unknown data to IndexerState
 * Throws on validation failure (for use in trusted contexts)
 */
export function assertIndexerState(data: unknown): IndexerState {
  const result = validateIndexerState(data);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}
