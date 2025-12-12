/**
 * Clean output utilities for user-facing CLI output
 * Separates user output from debug logging
 */

import type { DetailedIndexStats, LanguageStats, SupportedLanguage } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getTimeSince } from './date-utils.js';
import { capitalizeLanguage, formatNumber } from './formatters.js';

/**
 * Output interface for clean, logger-free output
 */
export const output = {
  /**
   * Print a line to stdout (no logger prefix)
   */
  log(message: string = ''): void {
    console.log(message);
  },

  /**
   * Print an error to stderr
   */
  error(message: string): void {
    console.error(chalk.red(`✗ ${message}`));
  },

  /**
   * Print a success message
   */
  success(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  },

  /**
   * Print a warning message
   */
  warn(message: string): void {
    console.log(chalk.yellow(`⚠ ${message}`));
  },

  /**
   * Print an info message
   */
  info(message: string): void {
    console.log(chalk.blue(`ℹ ${message}`));
  },
};

/**
 * Format a compact one-line summary
 */
export function formatCompactSummary(stats: DetailedIndexStats, repoName: string): string {
  const health = getHealthStatus(stats);
  const timeSince = stats.startTime ? getTimeSince(new Date(stats.startTime)) : 'unknown';

  return `📊 ${chalk.bold(repoName)} • ${formatNumber(stats.filesScanned)} files • ${formatNumber(stats.documentsIndexed)} components • Indexed ${timeSince} • ${health}`;
}

/**
 * Get health status indicator
 */
function getHealthStatus(stats: DetailedIndexStats): string {
  const { filesScanned, documentsIndexed, vectorsStored, errors } = stats;

  const hasFiles = filesScanned > 0;
  const hasDocuments = documentsIndexed > 0;
  const hasVectors = vectorsStored > 0;
  const hasErrors = errors && errors.length > 0;
  const errorRate = hasErrors && documentsIndexed > 0 ? errors.length / documentsIndexed : 0;

  if (!hasFiles) {
    return `${chalk.red('✗')} No files`;
  }

  if (!hasDocuments || !hasVectors) {
    return `${chalk.yellow('⚠')} Incomplete`;
  }

  if (hasErrors && errorRate > 0.1) {
    return `${chalk.yellow('⚠')} ${(errorRate * 100).toFixed(0)}% errors`;
  }

  return `${chalk.green('✓')} Healthy`;
}

/**
 * Format language breakdown in compact table
 */
export function formatLanguageBreakdown(
  byLanguage: Partial<Record<SupportedLanguage, LanguageStats>>,
  options: { verbose?: boolean } = {}
): string {
  const entries = Object.entries(byLanguage).sort(([, a], [, b]) => b.components - a.components);

  const lines: string[] = [];

  for (const [language, stats] of entries) {
    const name = capitalizeLanguage(language).padEnd(12);
    const files = formatNumber(stats.files).padStart(5);
    const components = formatNumber(stats.components).padStart(6);
    const loc = options.verbose ? formatNumber(stats.lines).padStart(10) : '';

    if (options.verbose) {
      lines.push(
        `${name} ${chalk.gray(files)} files    ${chalk.gray(components)} components    ${chalk.gray(loc)} LOC`
      );
    } else {
      lines.push(`${name} ${chalk.gray(files)} files    ${chalk.gray(components)} components`);
    }
  }

  return lines.join('\n');
}

/**
 * Format component types breakdown
 */
export function formatComponentTypes(byComponentType: Partial<Record<string, number>>): string {
  const entries = Object.entries(byComponentType)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3); // Top 3 only

  const parts = entries.map(([type, count]) => {
    const name = type.charAt(0).toUpperCase() + type.slice(1);
    return `${name} (${formatNumber(count)})`;
  });

  return `🔧 ${chalk.gray('Top Components:')} ${parts.join(' • ')}`;
}

/**
 * Format GitHub stats in compact form
 */
export function formatGitHubSummary(githubStats: {
  repository: string;
  totalDocuments: number;
  byType: { issue?: number; pull_request?: number };
  byState: { open?: number; closed?: number; merged?: number };
  lastIndexed: string;
}): string {
  const issues = githubStats.byType.issue || 0;
  const prs = githubStats.byType.pull_request || 0;
  const open = githubStats.byState.open || 0;
  const merged = githubStats.byState.merged || 0;

  const timeSince = getTimeSince(new Date(githubStats.lastIndexed));

  return [
    `🔗 ${chalk.bold(githubStats.repository)} • ${formatNumber(githubStats.totalDocuments)} documents`,
    `   ${chalk.gray(issues.toString())} issues • ${chalk.gray(prs.toString())} PRs • ${chalk.gray(open.toString())} open • ${chalk.gray(merged.toString())} merged • Synced ${timeSince}`,
  ].join('\n');
}

/**
 * Format detailed stats with tables (for verbose mode)
 */
export function formatDetailedLanguageTable(
  byLanguage: Partial<Record<SupportedLanguage, LanguageStats>>
): string {
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

  return table.toString();
}

/**
 * Format index success summary (compact)
 */
export function formatIndexSummary(stats: {
  code: { files: number; documents: number; vectors: number; duration: number; size: string };
  git?: { commits: number; duration: number };
  github?: { documents: number; duration: number };
  total: { duration: number; storage: string };
}): string {
  const lines: string[] = [];

  // One-line summary
  const parts: string[] = [];
  parts.push(`${formatNumber(stats.code.files)} files`);
  parts.push(`${formatNumber(stats.code.documents)} components`);
  if (stats.git) parts.push(`${formatNumber(stats.git.commits)} commits`);
  if (stats.github) parts.push(`${formatNumber(stats.github.documents)} GitHub docs`);

  lines.push(`📊 ${chalk.bold('Indexed:')} ${parts.join(' • ')}`);

  // Timing and storage
  lines.push(
    `   ${chalk.gray('Duration:')} ${stats.total.duration}s • ${chalk.gray('Storage:')} ${stats.code.size}`
  );

  // Next step
  lines.push('');
  lines.push(`   ${chalk.gray('Search with:')} ${chalk.cyan('dev search "<query>"')}`);

  return lines.join('\n');
}

/**
 * Format update summary
 */
export function formatUpdateSummary(stats: {
  filesUpdated: number;
  documentsReindexed: number;
  duration: number;
}): string {
  if (stats.filesUpdated === 0) {
    return `${chalk.green('✓')} Index is up to date`;
  }

  return [
    `${chalk.green('✓')} Updated ${formatNumber(stats.filesUpdated)} files • ${formatNumber(stats.documentsReindexed)} components • ${stats.duration}s`,
  ].join('\n');
}

/**
 * Format search results (compact)
 */
export function formatSearchResults(
  results: Array<{
    score: number;
    metadata: {
      name?: string;
      type?: string;
      path?: string;
      file?: string;
      startLine?: number;
      endLine?: number;
      signature?: string;
      docstring?: string;
    };
  }>,
  repoPath: string,
  options: { verbose?: boolean } = {}
): string {
  if (results.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const metadata = result.metadata;
    const score = (result.score * 100).toFixed(1);

    const name = metadata.name || metadata.type || 'Unknown';
    const filePath = (metadata.path || metadata.file) as string;
    const relativePath = filePath ? filePath.replace(`${repoPath}/`, '') : 'unknown';
    const location = `${relativePath}:${metadata.startLine}-${metadata.endLine}`;

    if (options.verbose) {
      // Verbose: Multi-line with details
      lines.push(chalk.bold(`${i + 1}. ${chalk.cyan(name)} ${chalk.gray(`(${score}% match)`)}`));
      lines.push(`   ${chalk.gray('File:')} ${location}`);

      if (metadata.signature) {
        lines.push(`   ${chalk.gray('Signature:')} ${chalk.yellow(metadata.signature)}`);
      }

      if (metadata.docstring) {
        const doc = String(metadata.docstring);
        const truncated = doc.length > 80 ? `${doc.substring(0, 77)}...` : doc;
        lines.push(`   ${chalk.gray('Doc:')} ${truncated}`);
      }
      lines.push('');
    } else {
      // Compact: One line per result
      const scoreColor =
        result.score > 0.8 ? chalk.green : result.score > 0.6 ? chalk.yellow : chalk.gray;
      lines.push(
        `${chalk.gray((i + 1).toString().padStart(2))}  ${chalk.cyan(name.padEnd(30).substring(0, 30))}  ${scoreColor(`${score}%`)}  ${chalk.gray(location)}`
      );
    }
  }

  return lines.join('\n');
}
