/**
 * Status Adapter
 * Provides repository status, indexing statistics, and health checks
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import { GitHubIndexer } from '@lytics/dev-agent-subagents';
import { estimateTokensForText } from '../../formatters/utils';
import { StatusArgsSchema } from '../../schemas/index.js';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';
import { validateArgs } from '../validation.js';

/**
 * Status section types
 */
export type StatusSection = 'summary' | 'repo' | 'indexes' | 'github' | 'health';

/**
 * Status adapter configuration
 */
export interface StatusAdapterConfig {
  /**
   * Repository indexer instance
   */
  repositoryIndexer: RepositoryIndexer;

  /**
   * Repository path
   */
  repositoryPath: string;

  /**
   * Vector storage path
   */
  vectorStorePath: string;

  /**
   * Default section to display
   */
  defaultSection?: StatusSection;
}

/**
 * Status Adapter
 * Implements the dev_status tool for repository status and health checks
 */
export class StatusAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'status-adapter',
    version: '1.0.0',
    description: 'Repository status and health monitoring adapter',
    author: 'Dev-Agent Team',
  };

  private repositoryIndexer: RepositoryIndexer;
  private repositoryPath: string;
  private vectorStorePath: string;
  private defaultSection: StatusSection;
  private githubIndexer?: GitHubIndexer;
  private githubStatePath?: string; // Track state file path for reload
  private lastStateFileModTime?: number; // Track state file modification time for auto-reload

  constructor(config: StatusAdapterConfig) {
    super();
    this.repositoryIndexer = config.repositoryIndexer;
    this.repositoryPath = config.repositoryPath;
    this.vectorStorePath = config.vectorStorePath;
    this.defaultSection = config.defaultSection ?? 'summary';
  }

  async initialize(context: AdapterContext): Promise<void> {
    context.logger.info('StatusAdapter initialized', {
      repositoryPath: this.repositoryPath,
      defaultSection: this.defaultSection,
    });

    // Initialize GitHub indexer lazily
    try {
      // Try to load repository from state file
      let repository: string | undefined;
      this.githubStatePath = path.join(this.repositoryPath, '.dev-agent/github-state.json');
      try {
        const stateContent = await fs.promises.readFile(this.githubStatePath, 'utf-8');
        const state = JSON.parse(stateContent);
        repository = state.repository;

        // Track initial modification time
        const stats = await fs.promises.stat(this.githubStatePath);
        this.lastStateFileModTime = stats.mtimeMs;
      } catch {
        // State file doesn't exist, will try gh CLI
      }

      this.githubIndexer = new GitHubIndexer(
        {
          vectorStorePath: `${this.vectorStorePath}-github`,
          statePath: this.githubStatePath, // Use absolute path
          autoUpdate: false, // We handle updates via file watching
          staleThreshold: 15 * 60 * 1000,
        },
        repository
      );
      await this.githubIndexer.initialize();
    } catch (error) {
      context.logger.warn('GitHub indexer initialization failed', { error });
      // Not fatal, GitHub section will show "not indexed"
    }
  }

  /**
   * Check if GitHub state file has been modified since last load
   * Returns true if file was modified and indexer needs reload
   */
  private async hasGitHubStateChanged(): Promise<boolean> {
    if (!this.githubStatePath || !this.lastStateFileModTime) {
      return false;
    }

    try {
      const stats = await fs.promises.stat(this.githubStatePath);
      const currentModTime = stats.mtimeMs;
      return currentModTime > this.lastStateFileModTime;
    } catch {
      // File doesn't exist or can't be accessed
      return false;
    }
  }

  /**
   * Reload the GitHub indexer to pick up fresh data
   */
  private async reloadGitHubIndexer(): Promise<void> {
    if (!this.githubIndexer || !this.githubStatePath) {
      return;
    }

    try {
      // Close existing indexer
      await this.githubIndexer.close();

      // Load fresh repository from state file
      const stateContent = await fs.promises.readFile(this.githubStatePath, 'utf-8');
      const state = JSON.parse(stateContent);
      const repository: string | undefined = state.repository;

      // Update modification time
      const stats = await fs.promises.stat(this.githubStatePath);
      this.lastStateFileModTime = stats.mtimeMs;

      // Re-initialize with fresh data
      this.githubIndexer = new GitHubIndexer(
        {
          vectorStorePath: `${this.vectorStorePath}-github`,
          statePath: this.githubStatePath,
          autoUpdate: false,
          staleThreshold: 15 * 60 * 1000,
        },
        repository
      );
      await this.githubIndexer.initialize();
    } catch (error) {
      // Log error but don't crash - old indexer might still work
      console.error('[StatusAdapter] Failed to reload GitHub indexer:', error);
    }
  }

  /**
   * Ensure GitHub indexer is up-to-date
   * Checks for file modifications and reloads if needed
   */
  private async ensureGitHubIndexerUpToDate(): Promise<void> {
    if (this.githubIndexer && (await this.hasGitHubStateChanged())) {
      await this.reloadGitHubIndexer();
    }
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_status',
      description: 'Get repository indexing status, configuration, and health checks',
      inputSchema: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['summary', 'repo', 'indexes', 'github', 'health'],
            description:
              'Which section to display: "summary" (overview), "repo" (repository details), "indexes" (vector storage), "github" (GitHub integration), "health" (system checks)',
            default: this.defaultSection,
          },
          format: {
            type: 'string',
            enum: ['compact', 'verbose'],
            description:
              'Output format: "compact" for brief info (default), "verbose" for full details',
            default: 'compact',
          },
        },
        required: [],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod (no type assertions!)
    const validation = validateArgs(StatusArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { section, format } = validation.data;

    try {
      const startTime = Date.now();
      context.logger.debug('Executing status check', { section, format });

      // Generate status content based on section
      const content = await this.generateStatus(section, format, context);

      const duration_ms = Date.now() - startTime;
      const tokens = estimateTokensForText(content);

      context.logger.info('Status check completed', { section, format, duration_ms });

      return {
        success: true,
        data: {
          section,
          format,
          content,
        },
        metadata: {
          tokens,
          duration_ms,
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };
    } catch (error) {
      context.logger.error('Status check failed', { error });
      return {
        success: false,
        error: {
          code: 'STATUS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  /**
   * Generate status content for a specific section
   */
  private async generateStatus(
    section: StatusSection,
    format: string,
    _context: ToolExecutionContext
  ): Promise<string> {
    switch (section) {
      case 'summary':
        return this.generateSummary(format);
      case 'repo':
        return this.generateRepoStatus(format);
      case 'indexes':
        return this.generateIndexesStatus(format);
      case 'github':
        return this.generateGitHubStatus(format);
      case 'health':
        return this.generateHealthStatus(format);
      default:
        throw new Error(`Unknown section: ${section}`);
    }
  }

  /**
   * Generate summary (overview of all sections)
   */
  private async generateSummary(format: string): Promise<string> {
    const repoStats = await this.repositoryIndexer.getStats();
    const githubStats = this.githubIndexer?.getStats() ?? null;

    if (format === 'verbose') {
      return this.generateVerboseSummary(repoStats, githubStats);
    }

    // Compact summary
    const lines: string[] = ['## Dev-Agent Status', ''];

    // Repository
    if (repoStats) {
      const timeAgo = this.formatTimeAgo(repoStats.startTime);
      lines.push(
        `**Repository:** ${this.repositoryPath} (${repoStats.filesScanned} files indexed)`
      );
      lines.push(`**Last Scan:** ${timeAgo}`);
    } else {
      lines.push(`**Repository:** ${this.repositoryPath} (not indexed)`);
    }

    lines.push('');

    // Indexes
    if (repoStats) {
      const codeIcon = '✅';
      const githubIcon = githubStats ? '✅' : '⚠️';
      lines.push(
        `**Indexes:** ${codeIcon} Code (${repoStats.documentsExtracted} components) | ${githubIcon} GitHub ${githubStats ? `(${githubStats.totalDocuments} items)` : '(not indexed)'}`
      );
    }

    lines.push('');

    // Storage
    if (repoStats) {
      const storageSize = await this.getStorageSize();
      lines.push(`**Storage:** ${this.formatBytes(storageSize)} (LanceDB)`);
    }

    lines.push('');

    // Health
    const health = await this.checkHealth();
    const healthIcon = health.every((check) => check.status === 'ok') ? '✅' : '⚠️';
    lines.push(
      `**Health:** ${healthIcon} ${health.filter((c) => c.status === 'ok').length}/${health.length} checks passed`
    );

    return lines.join('\n');
  }

  /**
   * Generate verbose summary with all details
   */
  private generateVerboseSummary(
    repoStats: Awaited<ReturnType<typeof this.repositoryIndexer.getStats>>,
    githubStats: ReturnType<NonNullable<typeof this.githubIndexer>['getStats']>
  ): string {
    const lines: string[] = ['## Dev-Agent Status (Detailed)', ''];

    // Repository
    lines.push('### Repository');
    lines.push(`- **Path:** ${this.repositoryPath}`);
    if (repoStats) {
      lines.push(`- **Files Indexed:** ${repoStats.filesScanned}`);
      lines.push(`- **Components:** ${repoStats.documentsExtracted}`);
      const startTimeISO =
        typeof repoStats.startTime === 'string'
          ? repoStats.startTime
          : repoStats.startTime.toISOString();
      lines.push(`- **Last Scan:** ${startTimeISO} (${this.formatTimeAgo(repoStats.startTime)})`);
    } else {
      lines.push('- **Status:** Not indexed');
    }
    lines.push('');

    // Indexes
    lines.push('### Vector Indexes');
    if (repoStats) {
      lines.push(`- **Code Index:** ${repoStats.vectorsStored} vectors`);
    } else {
      lines.push('- **Code Index:** Not initialized');
    }
    if (githubStats) {
      lines.push(`- **GitHub Index:** ${githubStats.totalDocuments} documents`);
      lines.push(`  - Issues: ${githubStats.byType.issue || 0}`);
      lines.push(`  - Pull Requests: ${githubStats.byType.pull_request || 0}`);
    } else {
      lines.push('- **GitHub Index:** Not indexed');
    }
    lines.push('');

    // Health
    lines.push('### Health Checks');
    const checks = this.checkHealthSync();
    for (const check of checks) {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      lines.push(`${icon} **${check.name}:** ${check.message}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate repository status
   */
  private async generateRepoStatus(format: string): Promise<string> {
    const stats = await this.repositoryIndexer.getStats();

    const lines: string[] = ['## Repository Index', ''];

    if (!stats) {
      lines.push('**Status:** Not indexed');
      lines.push('');
      lines.push('Run `dev index` to index your repository');
      return lines.join('\n');
    }

    lines.push(`**Path:** ${this.repositoryPath}`);
    lines.push(`**Indexed Files:** ${stats.filesScanned}`);
    lines.push(`**Components:** ${stats.documentsExtracted}`);

    if (format === 'verbose') {
      lines.push(`**Documents Indexed:** ${stats.documentsIndexed}`);
      lines.push(`**Vectors Stored:** ${stats.vectorsStored}`);
    }

    const startTimeISO =
      typeof stats.startTime === 'string' ? stats.startTime : stats.startTime.toISOString();
    lines.push(`**Last Scan:** ${startTimeISO} (${this.formatTimeAgo(stats.startTime)})`);

    if (format === 'verbose' && stats.errors.length > 0) {
      lines.push('');
      lines.push('**Errors:**');
      for (const error of stats.errors.slice(0, 5)) {
        lines.push(`- ${error.message}`);
      }
      if (stats.errors.length > 5) {
        lines.push(`- ... and ${stats.errors.length - 5} more`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate indexes status
   */
  private async generateIndexesStatus(format: string): Promise<string> {
    const repoStats = await this.repositoryIndexer.getStats();
    const githubStats = this.githubIndexer?.getStats() ?? null;
    const storageSize = await this.getStorageSize();

    const lines: string[] = ['## Vector Indexes', ''];

    // Code Index
    lines.push('### Code Index');
    if (repoStats) {
      lines.push(`- **Storage:** LanceDB (${this.vectorStorePath})`);
      lines.push(`- **Vectors:** ${repoStats.vectorsStored} embeddings`);
      if (format === 'verbose') {
        lines.push(`- **Documents:** ${repoStats.documentsIndexed}`);
        lines.push(`- **Model:** all-MiniLM-L6-v2 (384-dim)`);
      }
      lines.push(`- **Size:** ${this.formatBytes(storageSize)}`);
      lines.push(`- **Last Updated:** ${this.formatTimeAgo(repoStats.startTime)}`);
    } else {
      lines.push('- **Status:** Not initialized');
    }

    lines.push('');

    // GitHub Index
    lines.push('### GitHub Index');
    if (githubStats) {
      lines.push(`- **Storage:** LanceDB (${this.vectorStorePath}-github)`);
      lines.push(`- **Documents:** ${githubStats.totalDocuments}`);
      if (format === 'verbose') {
        lines.push(`- **By Type:**`);
        lines.push(`  - Issues: ${githubStats.byType.issue || 0}`);
        lines.push(`  - Pull Requests: ${githubStats.byType.pull_request || 0}`);
        lines.push(`- **By State:**`);
        lines.push(`  - Open: ${githubStats.byState.open || 0}`);
        lines.push(`  - Closed: ${githubStats.byState.closed || 0}`);
        if (githubStats.byState.merged) {
          lines.push(`  - Merged: ${githubStats.byState.merged}`);
        }
      }
      lines.push(
        `- **Last Sync:** ${githubStats.lastIndexed} (${this.formatTimeAgo(new Date(githubStats.lastIndexed))})`
      );
    } else {
      lines.push('- **Status:** Not indexed');
      lines.push('- Run `dev gh index` to sync GitHub data');
    }

    return lines.join('\n');
  }

  /**
   * Generate GitHub status
   */
  private async generateGitHubStatus(format: string): Promise<string> {
    // Check for index updates and reload if needed
    await this.ensureGitHubIndexerUpToDate();

    const stats = this.githubIndexer?.getStats() ?? null;

    const lines: string[] = ['## GitHub Integration', ''];

    if (!stats) {
      lines.push('**Status:** Not indexed');
      lines.push('');
      lines.push('Run `dev gh index` to sync GitHub data');
      return lines.join('\n');
    }

    lines.push(`**Repository:** ${stats.repository}`);
    lines.push(`**Total Documents:** ${stats.totalDocuments}`);
    lines.push('');

    lines.push('**By Type:**');
    lines.push(`- Issues: ${stats.byType.issue || 0}`);
    lines.push(`- Pull Requests: ${stats.byType.pull_request || 0}`);
    lines.push('');

    lines.push('**By State:**');
    lines.push(`- Open: ${stats.byState.open || 0}`);
    lines.push(`- Closed: ${stats.byState.closed || 0}`);
    if (stats.byState.merged) {
      lines.push(`- Merged: ${stats.byState.merged}`);
    }
    lines.push('');

    lines.push(
      `**Last Sync:** ${stats.lastIndexed} (${this.formatTimeAgo(new Date(stats.lastIndexed))})`
    );

    if (format === 'verbose') {
      lines.push('');
      lines.push('**Configuration:**');
      lines.push('- Auto-reload: Enabled (on file change)');
      lines.push('- Authentication: GitHub CLI (gh)');
    }

    return lines.join('\n');
  }

  /**
   * Generate health status
   */
  private async generateHealthStatus(format: string): Promise<string> {
    const checks = await this.checkHealth();

    const lines: string[] = ['## Health Checks', ''];

    for (const check of checks) {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      lines.push(`${icon} **${check.name}:** ${check.message}`);
      if (format === 'verbose' && check.details) {
        lines.push(`   ${check.details}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Check system health
   */
  private async checkHealth(): Promise<
    Array<{ name: string; status: 'ok' | 'warning' | 'error'; message: string; details?: string }>
  > {
    const checks: Array<{
      name: string;
      status: 'ok' | 'warning' | 'error';
      message: string;
      details?: string;
    }> = [];

    // Repository access
    try {
      await fs.promises.access(this.repositoryPath, fs.constants.R_OK);
      checks.push({
        name: 'Repository Access',
        status: 'ok',
        message: 'Can read source files',
      });
    } catch {
      checks.push({
        name: 'Repository Access',
        status: 'error',
        message: 'Cannot access repository',
        details: `Path: ${this.repositoryPath}`,
      });
    }

    // Vector storage
    const stats = await this.repositoryIndexer.getStats();
    if (stats) {
      checks.push({
        name: 'Vector Storage',
        status: 'ok',
        message: 'LanceDB operational',
        details: `${stats.vectorsStored} vectors stored`,
      });
    } else {
      checks.push({
        name: 'Vector Storage',
        status: 'warning',
        message: 'Not initialized',
        details: 'Run "dev index" to initialize',
      });
    }

    // GitHub CLI
    try {
      const { execSync } = await import('node:child_process');
      execSync('gh --version', { stdio: 'ignore' });
      checks.push({
        name: 'GitHub CLI',
        status: 'ok',
        message: 'Installed and operational',
      });
    } catch {
      checks.push({
        name: 'GitHub CLI',
        status: 'warning',
        message: 'Not available',
        details: 'Install gh CLI for GitHub integration',
      });
    }

    // Disk space
    try {
      const storageSize = await this.getStorageSize();
      const storageMB = storageSize / (1024 * 1024);
      if (storageMB > 100) {
        checks.push({
          name: 'Storage Size',
          status: 'warning',
          message: `Large storage (${this.formatBytes(storageSize)})`,
          details: 'Consider cleaning old indexes',
        });
      } else {
        checks.push({
          name: 'Storage Size',
          status: 'ok',
          message: this.formatBytes(storageSize),
        });
      }
    } catch {
      checks.push({
        name: 'Storage Size',
        status: 'warning',
        message: 'Cannot determine size',
      });
    }

    return checks;
  }

  /**
   * Synchronous health checks (for verbose summary)
   */
  private checkHealthSync(): Array<{
    name: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
  }> {
    const checks: Array<{ name: string; status: 'ok' | 'warning' | 'error'; message: string }> = [];

    // Repository access
    try {
      fs.accessSync(this.repositoryPath, fs.constants.R_OK);
      checks.push({ name: 'Repository', status: 'ok', message: 'Accessible' });
    } catch {
      checks.push({ name: 'Repository', status: 'error', message: 'Not accessible' });
    }

    // Vector storage (check if directory exists)
    try {
      const vectorDir = path.dirname(this.vectorStorePath);
      fs.accessSync(vectorDir, fs.constants.R_OK);
      checks.push({ name: 'Vector Storage', status: 'ok', message: 'Available' });
    } catch {
      checks.push({ name: 'Vector Storage', status: 'warning', message: 'Not initialized' });
    }

    return checks;
  }

  /**
   * Get total storage size for vector indexes
   */
  private async getStorageSize(): Promise<number> {
    try {
      const getDirectorySize = async (dirPath: string): Promise<number> => {
        try {
          const stats = await fs.promises.stat(dirPath);
          if (!stats.isDirectory()) {
            return stats.size;
          }

          const files = await fs.promises.readdir(dirPath);
          const sizes = await Promise.all(
            files.map((file) => getDirectorySize(path.join(dirPath, file)))
          );
          return sizes.reduce((acc, size) => acc + size, 0);
        } catch {
          return 0;
        }
      };

      const vectorDir = path.dirname(this.vectorStorePath);
      return await getDirectorySize(vectorDir);
    } catch {
      return 0;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Format time ago (e.g., "2 hours ago")
   */
  private formatTimeAgo(date: Date | string): string {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  estimateTokens(args: Record<string, unknown>): number {
    const { section = this.defaultSection, format = 'compact' } = args;

    // Rough estimates based on section and format
    if (format === 'verbose') {
      return section === 'summary' ? 800 : 500;
    }

    // Compact estimates
    return section === 'summary' ? 200 : 150;
  }
}
