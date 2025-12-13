/**
 * Clean output utilities for user-facing CLI output
 * Separates user output from debug logging
 */

import * as path from 'node:path';
import type { DetailedIndexStats, LanguageStats, SupportedLanguage } from '@lytics/dev-agent-core';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getTimeSince } from './date-utils.js';
import { formatBytes } from './file.js';
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
 * Print GitHub search results in table format
 */
export function printGitHubSearchResults(
  results: Array<{
    document: {
      type: string;
      number: number;
      title: string;
      state: string;
      labels: string[];
      url: string;
    };
    score: number;
  }>,
  query: string
): void {
  if (results.length === 0) {
    output.log();
    output.warn('No results found');
    output.log('Try different keywords or check your filters');
    output.log();
    return;
  }

  output.log();
  output.log(
    `🔍 Found ${chalk.yellow(results.length)} issue${results.length === 1 ? '' : 's'}/PR${results.length === 1 ? '' : 's'} for ${chalk.cyan(`"${query}"`)}`
  );
  output.log();

  const table = new Table({
    head: [
      chalk.cyan('Type'),
      chalk.cyan('#'),
      chalk.cyan('Title'),
      chalk.cyan('State'),
      chalk.cyan('Score'),
      chalk.cyan('Labels'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    colAligns: ['left', 'right', 'left', 'left', 'right', 'left'],
    colWidths: [7, 6, 45, 8, 7, 20],
  });

  for (const result of results) {
    const doc = result.document;
    const type = doc.type === 'issue' ? 'Issue' : 'PR';
    const score = `${(result.score * 100).toFixed(0)}%`;

    // Color-code state
    let stateFormatted = doc.state;
    if (doc.state === 'open') {
      stateFormatted = chalk.green(doc.state);
    } else if (doc.state === 'merged') {
      stateFormatted = chalk.magenta(doc.state);
    } else if (doc.state === 'closed') {
      stateFormatted = chalk.gray(doc.state);
    }

    // Truncate title if too long
    let title = doc.title;
    if (title.length > 42) {
      title = `${title.substring(0, 39)}...`;
    }

    // Format labels
    const labels = doc.labels.length > 0 ? doc.labels.slice(0, 2).join(', ') : '-';

    table.push([type, doc.number.toString(), title, stateFormatted, score, chalk.gray(labels)]);
  }

  output.log(table.toString());
  output.log();
}

/**
 * Print GitHub issue/PR context (gh-inspired format)
 */
export function printGitHubContext(doc: {
  type: string;
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  url: string;
  comments?: number;
  relatedIssues?: Array<{ number: number; title: string; state: string }>;
  relatedPRs?: Array<{ number: number; title: string; state: string }>;
  linkedFiles?: Array<{ path: string; score: number }>;
}): void {
  output.log();

  // Title line (bold)
  output.log(chalk.bold(`${doc.title} #${doc.number}`));

  // Metadata line (state • author • time)
  const stateColor =
    doc.state === 'open' ? chalk.green : doc.state === 'merged' ? chalk.magenta : chalk.gray;

  const createdAgo = getTimeSince(new Date(doc.createdAt));
  const updatedAgo = getTimeSince(new Date(doc.updatedAt));

  const metadata = [
    stateColor(doc.state.charAt(0).toUpperCase() + doc.state.slice(1)),
    `${doc.author} opened ${createdAgo}`,
    `Updated ${updatedAgo}`,
  ];

  if (doc.comments) {
    metadata.push(`${doc.comments} comment${doc.comments === 1 ? '' : 's'}`);
  }

  output.log(chalk.gray(metadata.join(' • ')));
  output.log();

  // Body (indented)
  const bodyLines = doc.body.split('\n').slice(0, 15); // First 15 lines
  for (const line of bodyLines) {
    output.log(`  ${line}`);
  }
  if (doc.body.split('\n').length > 15) {
    output.log(chalk.gray('  ...'));
  }
  output.log();

  // Labels
  if (doc.labels.length > 0) {
    output.log(`${chalk.bold('Labels:')} ${doc.labels.map((l) => chalk.cyan(l)).join(', ')}`);
  }

  // Related issues
  if (doc.relatedIssues && doc.relatedIssues.length > 0) {
    output.log();
    output.log(chalk.bold('Related Issues:'));
    for (const related of doc.relatedIssues) {
      const stateIndicator = related.state === 'open' ? chalk.green('●') : chalk.gray('●');
      output.log(`  ${stateIndicator} #${related.number} ${related.title}`);
    }
  }

  // Related PRs
  if (doc.relatedPRs && doc.relatedPRs.length > 0) {
    output.log();
    output.log(chalk.bold('Related PRs:'));
    for (const related of doc.relatedPRs) {
      const stateIndicator =
        related.state === 'merged'
          ? chalk.magenta('●')
          : related.state === 'open'
            ? chalk.green('●')
            : chalk.gray('●');
      output.log(`  ${stateIndicator} #${related.number} ${related.title}`);
    }
  }

  // Linked code files (dev-agent specific)
  if (doc.linkedFiles && doc.linkedFiles.length > 0) {
    output.log();
    output.log(chalk.bold('Linked Files:'));
    for (const file of doc.linkedFiles.slice(0, 5)) {
      const score = (file.score * 100).toFixed(0);
      output.log(`  ${chalk.blue(file.path)} ${chalk.gray(`(${score}% match)`)}`);
    }
  }

  output.log();
  output.log(chalk.gray(`View on GitHub: ${doc.url}`));
  output.log();
}

/**
 * Create a visual progress bar
 */
function createBar(percentage: number, width: number = 8): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Print complete repository statistics (enhanced format)
 */
export function printRepositoryStats(data: {
  repoName: string;
  stats: {
    totalFiles: number;
    totalDocuments: number;
    byLanguage?: Partial<Record<string, { files: number; components: number; lines: number }>>;
    byComponentType?: Partial<Record<string, number>>;
  };
  metadata?: {
    timestamp: string;
    storageSize: number;
    repository: {
      remote?: string;
      branch?: string;
      lastCommit?: string;
    };
  };
  githubStats?: {
    repository: string;
    totalDocuments: number;
    byType: { issue?: number; pull_request?: number };
    byState: { open?: number; closed?: number; merged?: number };
    lastIndexed: string;
  } | null;
}): void {
  const { repoName, stats, metadata, githubStats } = data;

  // Calculate time since last index
  const timeSince = metadata?.timestamp ? getTimeSince(new Date(metadata.timestamp)) : 'unknown';
  const storageFormatted = metadata?.storageSize ? formatBytes(metadata.storageSize) : '0 B';

  output.log();

  // Summary line
  output.log(
    `${chalk.bold(repoName)} • ${formatNumber(stats.totalFiles)} files • ${formatNumber(stats.totalDocuments)} components • ${chalk.cyan(storageFormatted)} • Indexed ${timeSince}`
  );

  // Git context (if available)
  if (metadata?.repository?.branch || metadata?.repository?.remote) {
    const parts: string[] = [];
    if (metadata.repository.branch) {
      parts.push(`Branch: ${chalk.cyan(metadata.repository.branch)}`);
    }
    if (metadata.repository.lastCommit) {
      parts.push(chalk.gray(`(${metadata.repository.lastCommit.substring(0, 7)})`));
    }
    if (metadata.repository.remote) {
      parts.push(`Remote: ${chalk.gray(metadata.repository.remote)}`);
    }
    if (parts.length > 0) {
      output.log(parts.join(' • '));
    }
  }

  output.log();

  // Language breakdown table with visual bars
  if (stats.byLanguage && Object.keys(stats.byLanguage).length > 0) {
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
      colAligns: ['left', 'right', 'left', 'right'],
      colWidths: [14, 8, 28, 16],
    });

    const totalComponents = Object.values(stats.byLanguage).reduce(
      (sum, lang) => sum + (lang?.components || 0),
      0
    );

    const entries = Object.entries(stats.byLanguage).sort(
      ([, a], [, b]) => (b?.components || 0) - (a?.components || 0)
    );

    for (const [language, langStats] of entries) {
      if (!langStats) continue;
      const percentage = totalComponents > 0 ? (langStats.components / totalComponents) * 100 : 0;
      const bar = createBar(percentage);
      const componentsDisplay = `${formatNumber(langStats.components).padStart(6)}  ${chalk.gray(bar)}  ${chalk.gray(`${percentage.toFixed(0)}%`)}`;

      table.push([
        capitalizeLanguage(language),
        formatNumber(langStats.files),
        componentsDisplay,
        formatNumber(langStats.lines),
      ]);
    }

    output.log(table.toString());
    output.log();
  }

  // Top components
  if (stats.byComponentType) {
    const topComponents = Object.entries(stats.byComponentType)
      .sort(([, a], [, b]) => (b || 0) - (a || 0))
      .slice(0, 3)
      .map(([type, count]) => {
        const name = type.charAt(0).toUpperCase() + type.slice(1);
        return `${name} (${formatNumber(count || 0)})`;
      });

    if (topComponents.length > 0) {
      output.log(`Top Components: ${topComponents.join(' • ')}`);
      output.log();
    }
  }

  // GitHub stats (if available)
  if (githubStats && githubStats.totalDocuments > 0) {
    output.log(chalk.bold(`GitHub: ${githubStats.repository}`));

    const issues = githubStats.byType.issue || 0;
    const prs = githubStats.byType.pull_request || 0;

    if (issues > 0) {
      const openIssues = githubStats.byState.open || 0;
      const closedIssues = githubStats.byState.closed || 0;
      output.log(
        `  Issues: ${chalk.bold(issues.toString())} total (${chalk.green(`${openIssues} open`)}, ${chalk.gray(`${closedIssues} closed`)})`
      );
    }

    if (prs > 0) {
      const openPRs = githubStats.byState.open || 0;
      const mergedPRs = githubStats.byState.merged || 0;
      output.log(
        `  Pull Requests: ${chalk.bold(prs.toString())} total (${chalk.green(`${openPRs} open`)}, ${chalk.magenta(`${mergedPRs} merged`)})`
      );
    }

    const ghTimeSince = getTimeSince(new Date(githubStats.lastIndexed));
    output.log(`  Last synced: ${chalk.gray(ghTimeSince)}`);
    output.log();
  }

  // Health check and next steps
  if (metadata?.timestamp) {
    const now = Date.now();
    const indexTime = new Date(metadata.timestamp).getTime();
    const hoursSince = (now - indexTime) / (1000 * 60 * 60);

    if (hoursSince > 24) {
      output.log(chalk.yellow(`⚠ Index is stale (${timeSince})`));
      output.log(chalk.gray("→ Run 'dev update' to refresh"));
    } else {
      output.log(chalk.green('✓ Index is up to date'));
      if (!githubStats) {
        output.log(chalk.gray("→ Run 'dev gh index' to index GitHub issues & PRs"));
      }
    }
  }

  output.log();
}

/**
 * Print storage information
 */
export function printStorageInfo(data: {
  storagePath: string;
  status: 'active' | 'not-initialized';
  totalSize: number;
  files: Array<{
    name: string;
    path: string;
    size: number | null;
    exists: boolean;
  }>;
  metadata?: {
    repository?: {
      remote?: string;
      branch?: string;
      lastCommit?: string;
    };
    indexed?: {
      timestamp: string;
      files: number;
      components: number;
    };
  };
}): void {
  const { storagePath, status, totalSize, files, metadata } = data;

  // Summary line
  const statusText = status === 'active' ? chalk.green('Active') : chalk.gray('Not initialized');
  const timeSince = metadata?.indexed?.timestamp
    ? getTimeSince(new Date(metadata.indexed.timestamp))
    : 'never';

  output.log();
  output.log(
    `${chalk.bold('dev-agent')} • ${statusText} • ${formatBytes(totalSize)} • Indexed ${timeSince}`
  );
  output.log(chalk.gray(storagePath));
  output.log();

  // Repository info
  if (metadata?.repository?.remote) {
    const parts: string[] = [];
    parts.push(`Repository:  ${chalk.cyan(metadata.repository.remote)}`);
    if (metadata.repository.branch) {
      parts.push(chalk.gray(`(${metadata.repository.branch})`));
    }
    output.log(parts.join(' '));
  }
  if (metadata?.repository?.lastCommit) {
    output.log(`Commit:      ${chalk.gray(metadata.repository.lastCommit)}`);
  }
  if (metadata?.indexed) {
    output.log(
      `Stats:       ${formatNumber(metadata.indexed.files)} files, ${formatNumber(metadata.indexed.components)} components`
    );
  }
  output.log();

  // Index files table
  if (files.length > 0) {
    const table = new Table({
      head: [chalk.cyan('Index File'), chalk.cyan('Size'), chalk.cyan('Status')],
      style: {
        head: [],
        border: ['gray'],
      },
      colAligns: ['left', 'right', 'center'],
    });

    for (const file of files) {
      const fileName = path.basename(file.path);
      const size = file.size !== null ? formatBytes(file.size) : chalk.gray('—');
      const statusIcon = file.exists ? chalk.green('✓') : chalk.red('✗');
      table.push([fileName, size, statusIcon]);
    }

    output.log(table.toString());
    output.log();
  }

  // Status message
  const allPresent = files.every((f) => f.exists);
  if (allPresent && files.length > 0) {
    output.log(chalk.green('✓ All index files present and ready'));
  } else if (files.some((f) => !f.exists)) {
    output.log(chalk.yellow('⚠ Some index files are missing'));
    output.log(chalk.gray("→ Run 'dev index' to create missing files"));
  } else if (status === 'not-initialized') {
    output.log(chalk.gray("→ Run 'dev index' to initialize storage"));
  }

  output.log();
}

/**
 * Print MCP servers list (docker ps inspired)
 */
export function printMcpServers(data: {
  ide: 'Cursor' | 'Claude Code';
  servers: Array<{
    name: string;
    command: string;
    repository?: string;
    status?: 'active' | 'inactive' | 'unknown';
  }>;
}): void {
  const { ide, servers } = data;

  if (servers.length === 0) {
    output.log();
    output.log(chalk.yellow(`No MCP servers configured in ${ide}`));
    output.log();
    output.log(
      `Run ${chalk.cyan(`dev mcp install${ide === 'Cursor' ? ' --cursor' : ''}`)} to add one`
    );
    output.log();
    return;
  }

  output.log();
  output.log(chalk.bold(`MCP Servers (${ide})`));
  output.log();

  // Find max widths for alignment
  const maxNameLen = Math.max(...servers.map((s) => s.name.length), 12);
  const maxStatusLen = 12;

  // Header
  output.log(
    `${chalk.cyan('NAME'.padEnd(maxNameLen))}  ${chalk.cyan('STATUS'.padEnd(maxStatusLen))}  ${chalk.cyan('COMMAND')}`
  );

  // Servers
  for (const server of servers) {
    const name = server.name.padEnd(maxNameLen);
    const status =
      server.status === 'active'
        ? chalk.green('✓ Active')
        : server.status === 'inactive'
          ? chalk.gray('○ Inactive')
          : chalk.gray('  Unknown');
    const statusPadded = status.padEnd(maxStatusLen + 10); // +10 for ANSI codes
    const command = chalk.gray(server.command);

    output.log(`${name}  ${statusPadded}  ${command}`);

    // Repository on next line if present
    if (server.repository) {
      output.log(`${' '.repeat(maxNameLen + 2)}${chalk.gray(`→ ${server.repository}`)}`);
    }
  }

  output.log();
  output.log(`Total: ${chalk.bold(servers.length)} server(s) configured`);
  output.log();
}

/**
 * Print MCP installation success
 */
export function printMcpInstallSuccess(data: {
  ide: 'Cursor' | 'Claude Code';
  serverName: string;
  configPath: string;
  repository?: string;
}): void {
  const { ide, serverName, configPath, repository } = data;

  output.log();
  output.log(chalk.green(`✓ ${serverName} installed in ${ide}`));
  output.log();
  output.log(`Configuration: ${chalk.gray(configPath)}`);
  if (repository) {
    output.log(`Repository:    ${chalk.gray(repository)}`);
  }
  output.log();
  output.log(chalk.bold('Next steps:'));
  output.log(`  ${chalk.cyan('•')} Restart ${ide} to activate the integration`);
  output.log(`  ${chalk.cyan('•')} Open a workspace to start using dev-agent tools`);
  output.log();
}

/**
 * Print MCP uninstallation success
 */
export function printMcpUninstallSuccess(data: {
  ide: 'Cursor' | 'Claude Code';
  serverName: string;
}): void {
  const { ide, serverName } = data;

  output.log();
  output.log(chalk.green(`✓ ${serverName} removed from ${ide}`));
  output.log();
  output.log(chalk.yellow(`⚠️  Restart ${ide} to apply changes`));
  output.log();
}

/**
 * Print compact/optimization results
 */
export function printCompactResults(data: {
  duration: number;
  before: {
    vectors: number;
    size?: number;
    fragments?: number;
  };
  after: {
    vectors: number;
    size?: number;
    fragments?: number;
  };
}): void {
  const { duration, before, after } = data;

  output.log();
  output.log(chalk.bold('Optimization Complete'));
  output.log();

  // Create comparison table
  const table = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Before'), chalk.cyan('After'), chalk.cyan('Change')],
    style: {
      head: [],
      border: ['gray'],
    },
    colAligns: ['left', 'right', 'right', 'right'],
  });

  // Vectors row (should be unchanged)
  const vectorChange = after.vectors - before.vectors;
  const vectorChangeStr =
    vectorChange === 0
      ? chalk.gray('—')
      : vectorChange > 0
        ? chalk.green(`+${vectorChange}`)
        : chalk.red(`${vectorChange}`);
  table.push([
    'Vectors',
    formatNumber(before.vectors),
    formatNumber(after.vectors),
    vectorChangeStr,
  ]);

  // Storage size row (if available)
  if (before.size && after.size) {
    const sizeChange = after.size - before.size;
    const sizeChangePercent = before.size > 0 ? (sizeChange / before.size) * 100 : 0;
    const sizeChangeStr =
      sizeChange < 0
        ? chalk.green(`${(sizeChangePercent).toFixed(1)}%`)
        : sizeChange > 0
          ? chalk.red(`+${sizeChangePercent.toFixed(1)}%`)
          : chalk.gray('—');

    table.push(['Storage Size', formatBytes(before.size), formatBytes(after.size), sizeChangeStr]);
  }

  // Fragments row (if available)
  if (before.fragments !== undefined && after.fragments !== undefined) {
    const fragmentChange = after.fragments - before.fragments;
    const fragmentChangePercent =
      before.fragments > 0 ? (fragmentChange / before.fragments) * 100 : 0;
    const fragmentChangeStr =
      fragmentChange < 0
        ? chalk.green(`${fragmentChangePercent.toFixed(1)}%`)
        : fragmentChange > 0
          ? chalk.red(`+${fragmentChangePercent.toFixed(1)}%`)
          : chalk.gray('—');

    table.push([
      'Fragments',
      formatNumber(before.fragments),
      formatNumber(after.fragments),
      fragmentChangeStr,
    ]);
  }

  output.log(table.toString());
  output.log();
  output.log(`✓ Completed in ${duration.toFixed(2)}s`);

  // Show savings if any
  if (before.size && after.size && after.size < before.size) {
    const saved = before.size - after.size;
    output.log(`💾 Saved ${chalk.green(formatBytes(saved))}`);
  }

  output.log();
  output.log(
    chalk.gray(
      'Optimization merged small data fragments and updated indices for better query performance.'
    )
  );
  output.log();
}

/**
 * Print clean summary
 */
export function printCleanSummary(data: {
  files: Array<{
    name: string;
    path: string;
    size: number | null;
  }>;
  totalSize: number;
  force: boolean;
}): void {
  const { files, totalSize, force } = data;

  output.log();
  output.log(chalk.bold('This will remove:'));
  output.log();

  for (const file of files) {
    const size = file.size !== null ? chalk.gray(`(${formatBytes(file.size)})`) : '';
    output.log(`  ${chalk.cyan('•')} ${file.name} ${size}`);
  }

  output.log();
  output.log(`Total to remove: ${chalk.bold(formatBytes(totalSize))}`);
  output.log();

  if (!force) {
    output.warn('This action cannot be undone!');
    output.log(`Run with ${chalk.yellow('--force')} to skip this prompt.`);
    output.log();
  }
}

/**
 * Print clean success
 */
export function printCleanSuccess(data: { totalSize: number }): void {
  const { totalSize } = data;

  output.log();
  output.log(chalk.green('✓ All indexed data removed'));
  output.log();
  output.log(`Freed ${chalk.bold(formatBytes(totalSize))}`);
  output.log();
  output.log(`Run ${chalk.cyan('dev index')} to re-index your repository`);
  output.log();
}

/**
 * Print GitHub indexing statistics (gh CLI inspired)
 */
export function printGitHubStats(githubStats: {
  repository: string;
  totalDocuments: number;
  byType: { issue?: number; pull_request?: number; discussion?: number };
  byState: { open?: number; closed?: number; merged?: number };
  lastIndexed: string;
  indexDuration?: number;
}): void {
  const issues = githubStats.byType.issue || 0;
  const prs = githubStats.byType.pull_request || 0;
  const discussions = githubStats.byType.discussion || 0;

  const openCount = githubStats.byState.open || 0;
  const closedCount = githubStats.byState.closed || 0;
  const mergedCount = githubStats.byState.merged || 0;

  const timeSince = getTimeSince(new Date(githubStats.lastIndexed));

  output.log();

  // Repository name and document count (gh style)
  output.log(chalk.bold(githubStats.repository));
  output.log(`${formatNumber(githubStats.totalDocuments)} issues and pull requests`);
  output.log();

  // Issues breakdown
  if (issues > 0) {
    const issueStates: string[] = [];
    // Calculate issue-specific counts (open + closed, no merged for issues)
    const issueOpen = openCount > 0 ? openCount : 0;
    const issueClosed = closedCount > 0 ? closedCount : 0;

    if (issueOpen > 0) {
      issueStates.push(`${chalk.green('●')} ${issueOpen} open`);
    }
    if (issueClosed > 0) {
      issueStates.push(`${chalk.gray('●')} ${issueClosed} closed`);
    }

    output.log(`Issues: ${chalk.bold(issues.toString())} total`);
    if (issueStates.length > 0) {
      output.log(`  ${issueStates.join('  ')}`);
    }
    output.log();
  }

  // Pull requests breakdown
  if (prs > 0) {
    const prStates: string[] = [];
    // For PRs, we show open and merged
    const prOpen = openCount > 0 ? openCount : 0;
    const prMerged = mergedCount > 0 ? mergedCount : 0;

    if (prOpen > 0) {
      prStates.push(`${chalk.green('●')} ${prOpen} open`);
    }
    if (prMerged > 0) {
      prStates.push(`${chalk.magenta('●')} ${prMerged} merged`);
    }

    output.log(`Pull Requests: ${chalk.bold(prs.toString())} total`);
    if (prStates.length > 0) {
      output.log(`  ${prStates.join('  ')}`);
    }
    output.log();
  }

  // Discussions (if any)
  if (discussions > 0) {
    output.log(`Discussions: ${chalk.bold(discussions.toString())} total`);
    output.log();
  }

  // Last synced
  output.log(chalk.gray(`Last synced: ${timeSince}`));
  output.log();
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
