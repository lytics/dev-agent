/**
 * Health Check Adapter
 *
 * Provides health and readiness checks for the MCP server and its dependencies.
 */

import * as fs from 'node:fs/promises';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';

export interface HealthCheckConfig {
  repositoryPath: string;
  vectorStorePath: string;
  githubStatePath?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    vectorStorage: CheckResult;
    repository: CheckResult;
    githubIndex?: CheckResult;
  };
  timestamp: string;
  uptime: number; // milliseconds
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

export class HealthAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'health-adapter',
    version: '1.0.0',
    description: 'Provides health and readiness checks for the MCP server',
  };

  private config: HealthCheckConfig;
  private startTime: number;

  constructor(config: HealthCheckConfig) {
    super();
    this.config = config;
    this.startTime = Date.now();
  }

  async initialize(context: AdapterContext): Promise<void> {
    this.initializeBase(context);
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_health',
      description:
        'Check the health status of the dev-agent MCP server and its dependencies (vector storage, repository, GitHub index)',
      inputSchema: {
        type: 'object',
        properties: {
          verbose: {
            type: 'boolean',
            description: 'Include detailed diagnostic information',
            default: false,
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const verbose = args.verbose === true;

    try {
      const health = await this.performHealthChecks(verbose);

      const status = this.getOverallStatus(health);
      const emoji = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';

      const content = this.formatHealthReport(health, verbose);

      return {
        success: true,
        data: {
          ...health,
          formattedReport: `${emoji} **MCP Server Health: ${status.toUpperCase()}**\n\n${content}`,
        },
      };
    } catch (error) {
      context.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error instanceof Error ? error.message : 'Health check failed',
          recoverable: true,
        },
      };
    }
  }

  private async performHealthChecks(verbose: boolean): Promise<HealthStatus> {
    const [vectorStorage, repository, githubIndex] = await Promise.all([
      this.checkVectorStorage(verbose),
      this.checkRepository(verbose),
      this.config.githubStatePath ? this.checkGitHubIndex(verbose) : Promise.resolve(undefined),
    ]);

    const checks: HealthStatus['checks'] = {
      vectorStorage,
      repository,
    };

    if (githubIndex) {
      checks.githubIndex = githubIndex;
    }

    return {
      status: this.getOverallStatus({ checks } as HealthStatus),
      checks,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  private async checkVectorStorage(verbose: boolean): Promise<CheckResult> {
    try {
      const stats = await fs.stat(this.config.vectorStorePath);

      if (!stats.isDirectory()) {
        return {
          status: 'fail',
          message: 'Vector storage path is not a directory',
        };
      }

      // Check if vector storage has data
      const files = await fs.readdir(this.config.vectorStorePath);
      const hasData = files.length > 0;

      if (!hasData) {
        return {
          status: 'warn',
          message: 'Vector storage is empty (repository may not be indexed)',
          details: verbose ? { path: this.config.vectorStorePath } : undefined,
        };
      }

      return {
        status: 'pass',
        message: `Vector storage operational (${files.length} files)`,
        details: verbose
          ? { path: this.config.vectorStorePath, fileCount: files.length }
          : undefined,
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Vector storage not accessible: ${error instanceof Error ? error.message : String(error)}`,
        details: verbose ? { path: this.config.vectorStorePath } : undefined,
      };
    }
  }

  private async checkRepository(verbose: boolean): Promise<CheckResult> {
    try {
      const stats = await fs.stat(this.config.repositoryPath);

      if (!stats.isDirectory()) {
        return {
          status: 'fail',
          message: 'Repository path is not a directory',
        };
      }

      // Check if it's a git repository
      try {
        await fs.stat(`${this.config.repositoryPath}/.git`);
        return {
          status: 'pass',
          message: 'Repository accessible and is a Git repository',
          details: verbose ? { path: this.config.repositoryPath } : undefined,
        };
      } catch {
        return {
          status: 'warn',
          message: 'Repository accessible but not a Git repository',
          details: verbose ? { path: this.config.repositoryPath } : undefined,
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: `Repository not accessible: ${error instanceof Error ? error.message : String(error)}`,
        details: verbose ? { path: this.config.repositoryPath } : undefined,
      };
    }
  }

  private async checkGitHubIndex(verbose: boolean): Promise<CheckResult> {
    if (!this.config.githubStatePath) {
      return {
        status: 'warn',
        message: 'GitHub index not configured',
      };
    }

    try {
      const content = await fs.readFile(this.config.githubStatePath, 'utf-8');
      const state = JSON.parse(content);

      const lastIndexed = state.lastIndexed ? new Date(state.lastIndexed) : null;
      const itemCount = state.items?.length ?? 0;

      if (!lastIndexed) {
        return {
          status: 'warn',
          message: 'GitHub index exists but has no lastIndexed timestamp',
          details: verbose ? { path: this.config.githubStatePath } : undefined,
        };
      }

      const ageMs = Date.now() - lastIndexed.getTime();
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

      // Warn if index is older than 24 hours
      if (ageHours > 24) {
        return {
          status: 'warn',
          message: `GitHub index is ${ageHours}h old (${itemCount} items) - consider re-indexing`,
          details: verbose
            ? { path: this.config.githubStatePath, lastIndexed: lastIndexed.toISOString() }
            : undefined,
        };
      }

      return {
        status: 'pass',
        message: `GitHub index operational (${itemCount} items, indexed ${ageHours}h ago)`,
        details: verbose
          ? { path: this.config.githubStatePath, lastIndexed: lastIndexed.toISOString() }
          : undefined,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: `GitHub index not accessible: ${error instanceof Error ? error.message : String(error)}`,
        details: verbose ? { path: this.config.githubStatePath } : undefined,
      };
    }
  }

  private getOverallStatus(health: HealthStatus): 'healthy' | 'degraded' | 'unhealthy' {
    const checks = Object.values(health.checks).filter(
      (check): check is CheckResult => check !== undefined
    );

    const hasFail = checks.some((check) => check.status === 'fail');
    const hasWarn = checks.some((check) => check.status === 'warn');

    if (hasFail) {
      return 'unhealthy';
    }
    if (hasWarn) {
      return 'degraded';
    }
    return 'healthy';
  }

  private formatHealthReport(health: HealthStatus, verbose: boolean): string {
    const lines: string[] = [];

    // Uptime
    const uptimeMs = health.uptime;
    const uptimeStr = this.formatUptime(uptimeMs);
    lines.push(`**Uptime:** ${uptimeStr}`);
    lines.push(`**Timestamp:** ${new Date(health.timestamp).toLocaleString()}`);
    lines.push('');

    // Checks
    lines.push('**Component Status:**');
    lines.push('');

    for (const [name, check] of Object.entries(health.checks)) {
      if (!check) continue;

      const statusEmoji = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
      const componentName = this.formatComponentName(name);

      lines.push(`${statusEmoji} **${componentName}:** ${check.message}`);

      if (verbose && check.details) {
        lines.push(`   *Details:* ${JSON.stringify(check.details)}`);
      }
    }

    return lines.join('\n');
  }

  private formatComponentName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  async healthCheck(): Promise<boolean> {
    const health = await this.performHealthChecks(false);
    return health.status === 'healthy';
  }
}
