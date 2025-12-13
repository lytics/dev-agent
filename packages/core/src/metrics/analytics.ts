/**
 * Metrics Analytics
 *
 * Factual metrics about repository files.
 * No "risk scores" - just observable data for developers to interpret.
 */

import type { MetricsStore } from './store.js';
import type { CodeMetadata } from './types.js';

/**
 * File metrics with activity classification
 */
export interface FileMetrics {
  filePath: string;
  activity: 'very-high' | 'high' | 'medium' | 'low' | 'minimal';
  commitCount: number;
  size: 'very-large' | 'large' | 'medium' | 'small' | 'tiny';
  linesOfCode: number;
  ownership: 'single' | 'pair' | 'small-team' | 'shared';
  authorCount: number;
  lastModified?: Date;
  numFunctions: number;
  numImports: number;
}

/**
 * Classify activity level based on commit count
 */
function classifyActivity(commits: number): FileMetrics['activity'] {
  if (commits >= 100) return 'very-high';
  if (commits >= 50) return 'high';
  if (commits >= 20) return 'medium';
  if (commits >= 5) return 'low';
  return 'minimal';
}

/**
 * Classify size based on lines of code
 */
function classifySize(loc: number): FileMetrics['size'] {
  if (loc >= 2000) return 'very-large';
  if (loc >= 1000) return 'large';
  if (loc >= 500) return 'medium';
  if (loc >= 100) return 'small';
  return 'tiny';
}

/**
 * Classify ownership based on author count
 */
function classifyOwnership(authors: number): FileMetrics['ownership'] {
  if (authors === 1) return 'single';
  if (authors === 2) return 'pair';
  if (authors <= 5) return 'small-team';
  return 'shared';
}

/**
 * Get file metrics from a snapshot
 *
 * Returns factual metrics about files without judgment.
 * Developers can filter/sort based on what matters to them.
 *
 * @param store - MetricsStore instance
 * @param snapshotId - Snapshot ID to analyze
 * @param options - Query options
 * @returns Array of file metrics
 */
export function getFileMetrics(
  store: MetricsStore,
  snapshotId: string,
  options?: {
    sortBy?: 'activity' | 'size' | 'ownership';
    limit?: number;
  }
): FileMetrics[] {
  const sortBy = options?.sortBy || 'activity';
  const limit = options?.limit || 100;

  // Map sortBy to MetricsStore query format
  const sortMapping = {
    activity: 'commits_desc' as const,
    size: 'lines_desc' as const,
    ownership: 'risk_desc' as const, // Risk formula weights single authors
  };

  const metadata = store.getCodeMetadata({
    snapshotId,
    sortBy: sortMapping[sortBy],
    limit,
  });

  return metadata.map((m) => ({
    filePath: m.filePath,
    activity: classifyActivity(m.commitCount || 0),
    commitCount: m.commitCount || 0,
    size: classifySize(m.linesOfCode),
    linesOfCode: m.linesOfCode,
    ownership: classifyOwnership(m.authorCount || 1),
    authorCount: m.authorCount || 1,
    lastModified: m.lastModified,
    numFunctions: m.numFunctions,
    numImports: m.numImports,
  }));
}

/**
 * Get most active files (by commit count)
 */
export function getMostActive(store: MetricsStore, snapshotId: string, limit = 10): FileMetrics[] {
  return getFileMetrics(store, snapshotId, { sortBy: 'activity', limit });
}

/**
 * Get largest files (by LOC)
 */
export function getLargestFiles(
  store: MetricsStore,
  snapshotId: string,
  limit = 10
): FileMetrics[] {
  return getFileMetrics(store, snapshotId, { sortBy: 'size', limit });
}

/**
 * Get files with concentrated ownership (single/pair authors)
 */
export function getConcentratedOwnership(
  store: MetricsStore,
  snapshotId: string,
  limit = 10
): FileMetrics[] {
  const all = getFileMetrics(store, snapshotId, { sortBy: 'ownership', limit: 1000 });
  return all.filter((m) => m.ownership === 'single' || m.ownership === 'pair').slice(0, limit);
}

/**
 * Get trend for a specific file across snapshots
 *
 * Shows how a file's metrics have changed over time.
 *
 * @param store - MetricsStore instance
 * @param filePath - File path to analyze
 * @param limit - Number of snapshots to analyze (default: 10)
 * @returns Array of metadata ordered by time (newest first)
 */
export function getFileTrend(store: MetricsStore, filePath: string, limit = 10): CodeMetadata[] {
  return store.getCodeMetadataForFile(filePath, limit);
}

/**
 * Get summary statistics for a snapshot
 *
 * Provides aggregate metrics for all files in a snapshot.
 *
 * @param store - MetricsStore instance
 * @param snapshotId - Snapshot ID to analyze
 * @returns Summary statistics
 */
export function getSnapshotSummary(store: MetricsStore, snapshotId: string) {
  const metadata = store.getCodeMetadata({
    snapshotId,
    limit: 10000, // Get all files
  });

  if (metadata.length === 0) {
    return null;
  }

  const totalLOC = metadata.reduce((sum, m) => sum + m.linesOfCode, 0);
  const totalFunctions = metadata.reduce((sum, m) => sum + m.numFunctions, 0);
  const avgLOC = Math.round(totalLOC / metadata.length);

  // Activity distribution
  const veryActiveFiles = metadata.filter((m) => (m.commitCount || 0) >= 100).length;
  const highActivityFiles = metadata.filter((m) => (m.commitCount || 0) >= 50).length;

  // Size distribution
  const veryLargeFiles = metadata.filter((m) => m.linesOfCode >= 2000).length;
  const largeFiles = metadata.filter((m) => m.linesOfCode >= 1000).length;

  // Ownership distribution
  const singleAuthorFiles = metadata.filter((m) => (m.authorCount || 1) === 1).length;
  const pairAuthorFiles = metadata.filter((m) => (m.authorCount || 1) === 2).length;

  return {
    totalFiles: metadata.length,
    totalLOC,
    totalFunctions,
    avgLOC,

    // Activity metrics
    veryActiveFiles,
    highActivityFiles,
    veryActivePercent: Math.round((veryActiveFiles / metadata.length) * 100),

    // Size metrics
    veryLargeFiles,
    largeFiles,
    veryLargePercent: Math.round((veryLargeFiles / metadata.length) * 100),

    // Ownership metrics
    singleAuthorFiles,
    pairAuthorFiles,
    singleAuthorPercent: Math.round((singleAuthorFiles / metadata.length) * 100),
  };
}
