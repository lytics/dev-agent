/**
 * Stats Comparison Utilities
 *
 * Compare two stat snapshots to understand what changed between indexes.
 * Useful for trend analysis and displaying deltas to users.
 */

import type {
  DetailedIndexStats,
  LanguageStats,
  PackageStats,
  SupportedLanguage,
} from '../types.js';

/**
 * Difference between two numeric values
 */
export interface NumericDiff {
  before: number;
  after: number;
  absolute: number; // after - before (can be negative)
  percent: number; // (after - before) / before * 100
}

/**
 * High-level differences between two snapshots
 */
export interface StatsDiff {
  /** File count changes */
  files: NumericDiff;

  /** Document count changes */
  documents: NumericDiff;

  /** Vector count changes */
  vectors: NumericDiff;

  /** Total lines changes (across all languages) */
  totalLines: NumericDiff;

  /** Per-language changes */
  languages: Record<SupportedLanguage, LanguageDiff>;

  /** Per-component-type changes */
  componentTypes: Record<string, NumericDiff>;

  /** Per-package changes */
  packages: Record<string, PackageDiff>;

  /** Time between snapshots (ms) */
  timeDelta: number;

  /** Summary */
  summary: {
    languagesAdded: string[];
    languagesRemoved: string[];
    packagesAdded: string[];
    packagesRemoved: string[];
    overallTrend: 'growing' | 'shrinking' | 'stable';
  };
}

/**
 * Language-specific differences
 */
export interface LanguageDiff {
  files: NumericDiff;
  components: NumericDiff;
  lines: NumericDiff;
  avgCommitsPerFile?: NumericDiff;
}

/**
 * Package-specific differences
 */
export interface PackageDiff {
  files: NumericDiff;
  components: NumericDiff;
  totalCommits?: NumericDiff;
}

/**
 * Calculate numeric difference
 */
function calculateNumericDiff(before: number, after: number): NumericDiff {
  const absolute = after - before;
  const percent = before > 0 ? (absolute / before) * 100 : after > 0 ? 100 : 0;

  return {
    before,
    after,
    absolute,
    percent: Number.parseFloat(percent.toFixed(2)),
  };
}

/**
 * Calculate language stats difference
 */
function calculateLanguageDiff(
  before: LanguageStats | undefined,
  after: LanguageStats | undefined
): LanguageDiff {
  const beforeStats = before || { files: 0, components: 0, lines: 0 };
  const afterStats = after || { files: 0, components: 0, lines: 0 };

  const diff: LanguageDiff = {
    files: calculateNumericDiff(beforeStats.files, afterStats.files),
    components: calculateNumericDiff(beforeStats.components, afterStats.components),
    lines: calculateNumericDiff(beforeStats.lines, afterStats.lines),
  };

  // Include change frequency if available
  if (beforeStats.avgCommitsPerFile !== undefined || afterStats.avgCommitsPerFile !== undefined) {
    diff.avgCommitsPerFile = calculateNumericDiff(
      beforeStats.avgCommitsPerFile || 0,
      afterStats.avgCommitsPerFile || 0
    );
  }

  return diff;
}

/**
 * Calculate package stats difference
 */
function calculatePackageDiff(
  before: PackageStats | undefined,
  after: PackageStats | undefined
): PackageDiff {
  const beforeStats = before || { name: '', path: '', files: 0, components: 0, languages: {} };
  const afterStats = after || { name: '', path: '', files: 0, components: 0, languages: {} };

  const diff: PackageDiff = {
    files: calculateNumericDiff(beforeStats.files, afterStats.files),
    components: calculateNumericDiff(beforeStats.components, afterStats.components),
  };

  // Include commit count if available
  if (beforeStats.totalCommits !== undefined || afterStats.totalCommits !== undefined) {
    diff.totalCommits = calculateNumericDiff(
      beforeStats.totalCommits || 0,
      afterStats.totalCommits || 0
    );
  }

  return diff;
}

/**
 * Compare two stat snapshots
 *
 * @param before - Earlier snapshot
 * @param after - Later snapshot
 * @returns Comprehensive diff showing all changes
 */
export function compareStats(before: DetailedIndexStats, after: DetailedIndexStats): StatsDiff {
  // Calculate time delta
  const timeDelta = after.endTime.getTime() - before.endTime.getTime();

  // High-level diffs
  const files = calculateNumericDiff(before.filesScanned, after.filesScanned);
  const documents = calculateNumericDiff(before.documentsIndexed, after.documentsIndexed);
  const vectors = calculateNumericDiff(before.vectorsStored, after.vectorsStored);

  // Calculate total lines
  const beforeLines = Object.values(before.byLanguage || {}).reduce(
    (sum, lang) => sum + lang.lines,
    0
  );
  const afterLines = Object.values(after.byLanguage || {}).reduce(
    (sum, lang) => sum + lang.lines,
    0
  );
  const totalLines = calculateNumericDiff(beforeLines, afterLines);

  // Language diffs
  const allLanguages = new Set([
    ...Object.keys(before.byLanguage || {}),
    ...Object.keys(after.byLanguage || {}),
  ]);
  const languages: Record<string, LanguageDiff> = {};
  for (const lang of allLanguages) {
    languages[lang] = calculateLanguageDiff(
      before.byLanguage?.[lang as SupportedLanguage],
      after.byLanguage?.[lang as SupportedLanguage]
    );
  }

  // Component type diffs
  const allComponentTypes = new Set([
    ...Object.keys(before.byComponentType || {}),
    ...Object.keys(after.byComponentType || {}),
  ]);
  const componentTypes: Record<string, NumericDiff> = {};
  for (const type of allComponentTypes) {
    componentTypes[type] = calculateNumericDiff(
      before.byComponentType?.[type] || 0,
      after.byComponentType?.[type] || 0
    );
  }

  // Package diffs
  const allPackages = new Set([
    ...Object.keys(before.byPackage || {}),
    ...Object.keys(after.byPackage || {}),
  ]);
  const packages: Record<string, PackageDiff> = {};
  for (const pkg of allPackages) {
    packages[pkg] = calculatePackageDiff(before.byPackage?.[pkg], after.byPackage?.[pkg]);
  }

  // Summary
  const beforeLanguages = new Set(Object.keys(before.byLanguage || {}));
  const afterLanguages = new Set(Object.keys(after.byLanguage || {}));
  const beforePackages = new Set(Object.keys(before.byPackage || {}));
  const afterPackages = new Set(Object.keys(after.byPackage || {}));

  const languagesAdded = [...afterLanguages].filter((lang) => !beforeLanguages.has(lang));
  const languagesRemoved = [...beforeLanguages].filter((lang) => !afterLanguages.has(lang));
  const packagesAdded = [...afterPackages].filter((pkg) => !beforePackages.has(pkg));
  const packagesRemoved = [...beforePackages].filter((pkg) => !afterPackages.has(pkg));

  // Determine overall trend
  let overallTrend: 'growing' | 'shrinking' | 'stable';
  if (files.absolute > 10) {
    overallTrend = 'growing';
  } else if (files.absolute < -10) {
    overallTrend = 'shrinking';
  } else {
    overallTrend = 'stable';
  }

  return {
    files,
    documents,
    vectors,
    totalLines,
    languages,
    componentTypes,
    packages,
    timeDelta,
    summary: {
      languagesAdded,
      languagesRemoved,
      packagesAdded,
      packagesRemoved,
      overallTrend,
    },
  };
}

/**
 * Get a human-readable summary of the diff
 */
export function formatDiffSummary(diff: StatsDiff): string {
  const lines: string[] = [];

  // Files
  if (diff.files.absolute !== 0) {
    const direction = diff.files.absolute > 0 ? 'added' : 'removed';
    lines.push(
      `${direction} ${Math.abs(diff.files.absolute)} files (${diff.files.percent > 0 ? '+' : ''}${diff.files.percent}%)`
    );
  }

  // Lines
  if (diff.totalLines.absolute !== 0) {
    const direction = diff.totalLines.absolute > 0 ? 'added' : 'removed';
    lines.push(
      `${direction} ${Math.abs(diff.totalLines.absolute).toLocaleString()} lines (${diff.totalLines.percent > 0 ? '+' : ''}${diff.totalLines.percent}%)`
    );
  }

  // Languages added/removed
  if (diff.summary.languagesAdded.length > 0) {
    lines.push(`new languages: ${diff.summary.languagesAdded.join(', ')}`);
  }
  if (diff.summary.languagesRemoved.length > 0) {
    lines.push(`removed languages: ${diff.summary.languagesRemoved.join(', ')}`);
  }

  // Packages added/removed
  if (diff.summary.packagesAdded.length > 0) {
    lines.push(`new packages: ${diff.summary.packagesAdded.join(', ')}`);
  }
  if (diff.summary.packagesRemoved.length > 0) {
    lines.push(`removed packages: ${diff.summary.packagesRemoved.join(', ')}`);
  }

  // Overall trend
  lines.push(`trend: ${diff.summary.overallTrend}`);

  return lines.join('\n');
}
