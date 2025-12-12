/**
 * Pure functions for merging incremental stats into existing repository stats
 * Extracted for testability and reusability
 */

import type { StatsAggregator } from './stats-aggregator';
import type { FileMetadata, LanguageStats, PackageStats, SupportedLanguage } from './types';

/**
 * Stats that can be merged
 */
export interface MergeableStats {
  byLanguage?: Partial<Record<SupportedLanguage, LanguageStats>>;
  byComponentType?: Partial<Record<string, number>>;
  byPackage?: Record<string, PackageStats>;
}

/**
 * Input for stat merging operation
 */
export interface StatMergeInput {
  currentStats: MergeableStats;
  deletedFiles: Array<{ path: string; metadata: FileMetadata }>;
  changedFiles: Array<{ path: string; metadata: FileMetadata }>;
  incrementalStats: ReturnType<StatsAggregator['getDetailedStats']> | null;
}

/**
 * Merge incremental stats into existing repository stats
 * Pure function that returns new stats without mutations
 */
export function mergeStats(input: StatMergeInput): MergeableStats {
  const { currentStats, deletedFiles, changedFiles, incrementalStats } = input;

  // Deep clone to avoid mutations
  const merged: MergeableStats = {
    byLanguage: currentStats.byLanguage ? { ...currentStats.byLanguage } : {},
    byComponentType: currentStats.byComponentType ? { ...currentStats.byComponentType } : {},
    byPackage: currentStats.byPackage ? { ...currentStats.byPackage } : {},
  };

  // Ensure language stats are cloned deeply
  if (merged.byLanguage) {
    for (const [lang, stats] of Object.entries(merged.byLanguage)) {
      if (stats) {
        merged.byLanguage[lang as SupportedLanguage] = { ...stats };
      }
    }
  }

  // Process deletions
  merged.byLanguage = subtractDeletedFiles(merged.byLanguage || {}, deletedFiles);

  // Process changes (remove old contribution)
  merged.byLanguage = subtractChangedFiles(merged.byLanguage || {}, changedFiles);

  // Add new/changed file contributions
  if (incrementalStats) {
    merged.byLanguage = addIncrementalLanguageStats(
      merged.byLanguage || {},
      incrementalStats.byLanguage || {}
    );

    merged.byComponentType = addIncrementalComponentStats(
      merged.byComponentType || {},
      incrementalStats.byComponentType || {}
    );

    merged.byPackage = addIncrementalPackageStats(
      merged.byPackage || {},
      incrementalStats.byPackage || {}
    );
  }

  return merged;
}

/**
 * Subtract deleted files from language stats
 * Pure function
 */
export function subtractDeletedFiles(
  stats: Partial<Record<SupportedLanguage, LanguageStats>>,
  deletedFiles: Array<{ path: string; metadata: FileMetadata }>
): Partial<Record<SupportedLanguage, LanguageStats>> {
  const result = { ...stats };

  for (const { metadata } of deletedFiles) {
    const lang = metadata.language as SupportedLanguage;
    const langStats = result[lang];

    if (langStats) {
      const updated = { ...langStats };
      updated.files = Math.max(0, updated.files - 1);

      if (updated.files === 0) {
        // Remove language if no files left
        delete result[lang];
      } else {
        result[lang] = updated;
      }
    }
  }

  return result;
}

/**
 * Subtract changed files from language stats (they'll be re-added with new stats)
 * Pure function
 */
export function subtractChangedFiles(
  stats: Partial<Record<SupportedLanguage, LanguageStats>>,
  changedFiles: Array<{ path: string; metadata: FileMetadata }>
): Partial<Record<SupportedLanguage, LanguageStats>> {
  // Same logic as deletions - we subtract the old contribution
  return subtractDeletedFiles(stats, changedFiles);
}

/**
 * Add incremental language stats
 * Pure function
 */
export function addIncrementalLanguageStats(
  currentStats: Partial<Record<SupportedLanguage, LanguageStats>>,
  incrementalStats: Partial<Record<SupportedLanguage, LanguageStats>>
): Partial<Record<SupportedLanguage, LanguageStats>> {
  const result = { ...currentStats };

  for (const [lang, stats] of Object.entries(incrementalStats)) {
    const langKey = lang as SupportedLanguage;
    const current = result[langKey];

    if (!current) {
      // New language, just add it
      result[langKey] = { ...stats };
    } else {
      // Merge with existing
      result[langKey] = {
        files: current.files + stats.files,
        components: current.components + stats.components,
        lines: current.lines + stats.lines,
      };
    }
  }

  return result;
}

/**
 * Add incremental component type stats
 * Pure function
 */
export function addIncrementalComponentStats(
  currentStats: Partial<Record<string, number>>,
  incrementalStats: Partial<Record<string, number>>
): Partial<Record<string, number>> {
  const result = { ...currentStats };

  for (const [type, count] of Object.entries(incrementalStats)) {
    if (typeof count === 'number') {
      result[type] = (result[type] || 0) + count;
    }
  }

  return result;
}

/**
 * Add incremental package stats
 * Pure function
 */
export function addIncrementalPackageStats(
  currentStats: Record<string, PackageStats>,
  incrementalStats: Record<string, PackageStats>
): Record<string, PackageStats> {
  const result = { ...currentStats };

  for (const [pkgPath, pkgStats] of Object.entries(incrementalStats)) {
    const current = result[pkgPath];

    if (!current) {
      // New package
      result[pkgPath] = {
        name: pkgStats.name,
        path: pkgStats.path,
        files: pkgStats.files,
        components: pkgStats.components,
        languages: { ...pkgStats.languages },
      };
    } else {
      // Merge with existing
      const languages = { ...current.languages };
      for (const [lang, count] of Object.entries(pkgStats.languages)) {
        if (typeof count === 'number') {
          languages[lang as SupportedLanguage] =
            ((languages[lang as SupportedLanguage] as number) || 0) + count;
        }
      }

      result[pkgPath] = {
        name: current.name,
        path: current.path,
        files: current.files + pkgStats.files,
        components: current.components + pkgStats.components,
        languages,
      };
    }
  }

  return result;
}
