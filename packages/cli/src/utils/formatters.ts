/**
 * Formatting utilities for enhanced CLI output
 */

import type { DetailedIndexStats, LanguageStats, SupportedLanguage } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import Table from 'cli-table3';
import terminalSize from 'terminal-size';

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get terminal width with fallback
 */
export function getTerminalWidth(): number {
  try {
    const size = terminalSize();
    return size.columns;
  } catch {
    return 80; // Fallback to 80 columns
  }
}

/**
 * Create a language stats table
 */
export function createLanguageTable(
  byLanguage: Partial<Record<SupportedLanguage, LanguageStats>>
): Table.Table {
  const table = new Table({
    head: [
      chalk.cyan('Language'),
      chalk.cyan('Files'),
      chalk.cyan('Components'),
      chalk.cyan('Lines of Code'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    colAligns: ['left', 'right', 'right', 'right'],
  });

  // Sort by component count (descending)
  const entries = Object.entries(byLanguage).sort(([, a], [, b]) => b.components - a.components);

  for (const [language, stats] of entries) {
    table.push([
      capitalizeLanguage(language),
      formatNumber(stats.files),
      formatNumber(stats.components),
      formatNumber(stats.lines),
    ]);
  }

  // Add totals row
  const totals = entries.reduce(
    (acc, [, stats]) => ({
      files: acc.files + stats.files,
      components: acc.components + stats.components,
      lines: acc.lines + stats.lines,
    }),
    { files: 0, components: 0, lines: 0 }
  );

  table.push([
    chalk.bold('Total'),
    chalk.bold(formatNumber(totals.files)),
    chalk.bold(formatNumber(totals.components)),
    chalk.bold(formatNumber(totals.lines)),
  ]);

  return table;
}

/**
 * Create a component types table
 */
export function createComponentTypesTable(
  byComponentType: Partial<Record<string, number>>
): Table.Table {
  const table = new Table({
    head: [chalk.cyan('Component Type'), chalk.cyan('Count'), chalk.cyan('Percentage')],
    style: {
      head: [],
      border: ['gray'],
    },
    colAligns: ['left', 'right', 'right'],
  });

  // Calculate total for percentages
  const total = Object.values(byComponentType).reduce((sum: number, count) => {
    return sum + (count || 0);
  }, 0);

  // Sort by count (descending), filtering out undefined
  const entries = Object.entries(byComponentType)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .sort(([, a], [, b]) => b - a);

  for (const [type, count] of entries) {
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    table.push([capitalizeType(type), formatNumber(count), `${percentage}%`]);
  }

  return table;
}

/**
 * Create health status indicator
 */
export function createHealthIndicator(stats: DetailedIndexStats): string {
  const { filesScanned, documentsIndexed, vectorsStored, errors } = stats;

  // Health checks
  const hasFiles = filesScanned > 0;
  const hasDocuments = documentsIndexed > 0;
  const hasVectors = vectorsStored > 0;
  const hasErrors = errors && errors.length > 0;
  const errorRate = hasErrors && documentsIndexed > 0 ? errors.length / documentsIndexed : 0;

  if (!hasFiles) {
    return `${chalk.red('●')} ${chalk.red('No files indexed')}`;
  }

  if (!hasDocuments || !hasVectors) {
    return `${chalk.yellow('●')} ${chalk.yellow('Incomplete index')}`;
  }

  if (hasErrors && errorRate > 0.1) {
    return `${chalk.yellow('●')} ${chalk.yellow(`High error rate (${(errorRate * 100).toFixed(1)}%)`)}`;
  }

  if (hasErrors) {
    return `${chalk.green('●')} ${chalk.green('Healthy')} ${chalk.gray(`(${errors.length} errors)`)}`;
  }

  return `${chalk.green('●')} ${chalk.green('Healthy')}`;
}

/**
 * Capitalize language name
 */
function capitalizeLanguage(lang: string): string {
  const map: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    go: 'Go',
    markdown: 'Markdown',
  };
  return map[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

/**
 * Capitalize component type
 */
function capitalizeType(type: string): string {
  const map: Record<string, string> = {
    function: 'Function',
    class: 'Class',
    interface: 'Interface',
    type: 'Type',
    method: 'Method',
    variable: 'Variable',
    documentation: 'Documentation',
    struct: 'Struct',
  };
  return map[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Create a compact overview section
 */
export function createOverviewSection(stats: DetailedIndexStats, repoPath: string): string[] {
  const lines: string[] = [];

  lines.push(chalk.bold.cyan('📊 Repository Overview'));
  lines.push('');
  lines.push(`${chalk.cyan('Repository:')}         ${repoPath}`);
  lines.push(`${chalk.cyan('Files Indexed:')}      ${formatNumber(stats.filesScanned)}`);
  lines.push(`${chalk.cyan('Components:')}         ${formatNumber(stats.documentsIndexed)}`);
  lines.push(`${chalk.cyan('Vectors Stored:')}     ${formatNumber(stats.vectorsStored)}`);

  if (stats.startTime) {
    const date = new Date(stats.startTime);
    lines.push(`${chalk.cyan('Last Indexed:')}       ${date.toLocaleString()}`);
  }

  if (stats.duration) {
    const seconds = (stats.duration / 1000).toFixed(2);
    lines.push(`${chalk.cyan('Duration:')}           ${seconds}s`);
  }

  lines.push(`${chalk.cyan('Health:')}             ${createHealthIndicator(stats)}`);

  return lines;
}

/**
 * Format detailed stats output
 */
export function formatDetailedStats(
  stats: DetailedIndexStats,
  repoPath: string,
  options: { showPackages?: boolean } = {}
): string {
  const sections: string[] = [];

  // Overview section
  sections.push(createOverviewSection(stats, repoPath).join('\n'));

  // Language breakdown
  if (stats.byLanguage && Object.keys(stats.byLanguage).length > 0) {
    sections.push('');
    sections.push(chalk.bold.cyan('📝 Language Breakdown'));
    sections.push('');
    sections.push(createLanguageTable(stats.byLanguage).toString());
  }

  // Component types
  if (stats.byComponentType && Object.keys(stats.byComponentType).length > 0) {
    sections.push('');
    sections.push(chalk.bold.cyan('🔧 Component Types'));
    sections.push('');
    sections.push(createComponentTypesTable(stats.byComponentType).toString());
  }

  // Package stats (if requested and available)
  if (options.showPackages && stats.byPackage && Object.keys(stats.byPackage).length > 0) {
    sections.push('');
    sections.push(chalk.bold.cyan('📦 Packages'));
    sections.push('');
    const packageTable = createPackageTable(stats.byPackage);
    sections.push(packageTable.toString());
  }

  return sections.join('\n');
}

/**
 * Create a package stats table
 */
function createPackageTable(
  byPackage: Record<string, { name: string; files: number; components: number }>
): Table.Table {
  const table = new Table({
    head: [chalk.cyan('Package'), chalk.cyan('Files'), chalk.cyan('Components')],
    style: {
      head: [],
      border: ['gray'],
    },
    colAligns: ['left', 'right', 'right'],
  });

  // Sort by component count (descending)
  const entries = Object.entries(byPackage).sort(([, a], [, b]) => b.components - a.components);

  for (const [, pkg] of entries) {
    table.push([pkg.name, formatNumber(pkg.files), formatNumber(pkg.components)]);
  }

  return table;
}
