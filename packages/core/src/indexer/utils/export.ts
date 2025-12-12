/**
 * Stats Export Utilities
 *
 * Export stats in various formats for external analysis, dashboards, or reporting.
 */

import type { DetailedIndexStats, LanguageStats, PackageStats } from '../types.js';

/**
 * Export options
 */
export interface ExportOptions {
  /** Pretty print JSON (default: true) */
  pretty?: boolean;

  /** Include metadata (default: true) */
  includeMetadata?: boolean;

  /** Include detailed breakdowns (default: true) */
  includeDetails?: boolean;
}

/**
 * Export stats as JSON
 */
export function exportStatsAsJson(stats: DetailedIndexStats, options: ExportOptions = {}): string {
  const { pretty = true, includeMetadata = true, includeDetails = true } = options;

  const data: Record<string, unknown> = {
    filesScanned: stats.filesScanned,
    documentsIndexed: stats.documentsIndexed,
    vectorsStored: stats.vectorsStored,
    duration: stats.duration,
    repositoryPath: stats.repositoryPath,
  };

  if (includeMetadata && stats.statsMetadata) {
    data.metadata = {
      isIncremental: stats.statsMetadata.isIncremental,
      lastFullIndex: stats.statsMetadata.lastFullIndex.toISOString(),
      lastUpdate: stats.statsMetadata.lastUpdate.toISOString(),
      incrementalUpdatesSince: stats.statsMetadata.incrementalUpdatesSince,
      warning: stats.statsMetadata.warning,
    };
  }

  if (includeDetails) {
    if (stats.byLanguage) {
      data.byLanguage = stats.byLanguage;
    }
    if (stats.byComponentType) {
      data.byComponentType = stats.byComponentType;
    }
    if (stats.byPackage) {
      data.byPackage = stats.byPackage;
    }
  }

  return JSON.stringify(data, null, pretty ? 2 : undefined);
}

/**
 * Export stats as CSV
 * Flattens hierarchical data into rows for spreadsheet analysis
 */
export function exportStatsAsCsv(stats: DetailedIndexStats): string {
  const rows: string[] = [];

  // Header
  rows.push('category,subcategory,metric,value');

  // Overview
  rows.push(`overview,files,total,${stats.filesScanned}`);
  rows.push(`overview,documents,total,${stats.documentsIndexed}`);
  rows.push(`overview,vectors,total,${stats.vectorsStored}`);
  rows.push(`overview,duration,milliseconds,${stats.duration}`);

  // By language
  if (stats.byLanguage) {
    for (const [lang, langStats] of Object.entries(stats.byLanguage)) {
      rows.push(`language,${lang},files,${langStats.files}`);
      rows.push(`language,${lang},components,${langStats.components}`);
      rows.push(`language,${lang},lines,${langStats.lines}`);
      if (langStats.avgCommitsPerFile !== undefined) {
        rows.push(`language,${lang},avg_commits_per_file,${langStats.avgCommitsPerFile}`);
      }
      if (langStats.lastModified) {
        rows.push(`language,${lang},last_modified,${langStats.lastModified.toISOString()}`);
      }
    }
  }

  // By component type
  if (stats.byComponentType) {
    for (const [type, count] of Object.entries(stats.byComponentType)) {
      rows.push(`component,${type},count,${count}`);
    }
  }

  // By package
  if (stats.byPackage) {
    for (const [_pkgPath, pkgStats] of Object.entries(stats.byPackage)) {
      const pkgName = pkgStats.name.replace(/,/g, ';'); // Escape commas
      rows.push(`package,${pkgName},files,${pkgStats.files}`);
      rows.push(`package,${pkgName},components,${pkgStats.components}`);
      if (pkgStats.totalCommits !== undefined) {
        rows.push(`package,${pkgName},total_commits,${pkgStats.totalCommits}`);
      }
      if (pkgStats.lastModified) {
        rows.push(`package,${pkgName},last_modified,${pkgStats.lastModified.toISOString()}`);
      }
    }
  }

  return rows.join('\n');
}

/**
 * Export language stats as markdown table
 */
export function exportLanguageStatsAsMarkdown(
  byLanguage: Partial<Record<string, LanguageStats>>
): string {
  const lines: string[] = [];

  // Header
  lines.push('| Language | Files | Components | Lines | Avg Commits/File |');
  lines.push('|----------|-------|------------|-------|------------------|');

  // Rows
  for (const [lang, stats] of Object.entries(byLanguage)) {
    if (!stats) continue;
    const avgCommits = stats.avgCommitsPerFile?.toFixed(1) ?? 'N/A';
    lines.push(
      `| ${lang} | ${stats.files} | ${stats.components} | ${stats.lines.toLocaleString()} | ${avgCommits} |`
    );
  }

  return lines.join('\n');
}

/**
 * Export package stats as markdown table
 */
export function exportPackageStatsAsMarkdown(byPackage: Record<string, PackageStats>): string {
  const lines: string[] = [];

  // Header
  lines.push('| Package | Files | Components | Total Commits |');
  lines.push('|---------|-------|------------|---------------|');

  // Rows
  for (const [, stats] of Object.entries(byPackage)) {
    const commits = stats.totalCommits ?? 'N/A';
    lines.push(`| ${stats.name} | ${stats.files} | ${stats.components} | ${commits} |`);
  }

  return lines.join('\n');
}
