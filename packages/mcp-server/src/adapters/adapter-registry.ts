/**
 * Adapter Registry
 * Manages adapter lifecycle and tool execution routing
 */

import { ErrorCode } from '../server/protocol/types';
import { RateLimiter } from '../server/utils/rate-limiter';
import type { ToolAdapter } from './tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from './types';

export interface RegistryConfig {
  autoDiscover?: boolean;
  customAdaptersPath?: string;
  /** Enable rate limiting (default: true) */
  enableRateLimiting?: boolean;
  /** Default rate limit: capacity (burst) */
  rateLimitCapacity?: number;
  /** Default rate limit: refill rate (per second) */
  rateLimitRefillRate?: number;
}

export class AdapterRegistry {
  private adapters = new Map<string, ToolAdapter>();
  private rateLimiter: RateLimiter | null;

  constructor(config: RegistryConfig = {}) {
    // Initialize rate limiter if enabled (default: true)
    if (config.enableRateLimiting !== false) {
      const capacity = config.rateLimitCapacity ?? 100; // 100 requests burst
      const refillRate = config.rateLimitRefillRate ?? 10; // 10 req/sec = 600/min
      this.rateLimiter = new RateLimiter(capacity, refillRate);
    } else {
      this.rateLimiter = null;
    }
  }

  /**
   * Register a single adapter
   */
  register(adapter: ToolAdapter): void {
    const toolName = adapter.getToolDefinition().name;

    if (this.adapters.has(toolName)) {
      throw new Error(`Adapter already registered: ${toolName}`);
    }

    this.adapters.set(toolName, adapter);
  }

  /**
   * Unregister an adapter
   */
  async unregister(toolName: string): Promise<void> {
    const adapter = this.adapters.get(toolName);
    if (!adapter) {
      return;
    }

    // Call shutdown if available
    if (adapter.shutdown) {
      await adapter.shutdown();
    }

    this.adapters.delete(toolName);
  }

  /**
   * Initialize all registered adapters
   */
  async initializeAll(context: AdapterContext): Promise<void> {
    const initPromises = Array.from(this.adapters.values()).map((adapter) =>
      adapter.initialize(context)
    );

    await Promise.all(initPromises);
  }

  /**
   * Get all tool definitions (for MCP tools/list)
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.adapters.values()).map((adapter) => adapter.getToolDefinition());
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const adapter = this.adapters.get(toolName);

    if (!adapter) {
      return {
        success: false,
        error: {
          code: String(ErrorCode.ToolNotFound),
          message: `Tool not found: ${toolName}`,
          recoverable: false,
        },
      };
    }

    // Check rate limit
    if (this.rateLimiter) {
      const rateLimit = this.rateLimiter.check(toolName);
      if (!rateLimit.allowed) {
        context.logger.warn('Rate limit exceeded', {
          toolName,
          retryAfter: rateLimit.retryAfter,
        });

        return {
          success: false,
          error: {
            code: '429', // HTTP 429 Too Many Requests
            message: `Rate limit exceeded for ${toolName}. Try again in ${rateLimit.retryAfter} second(s).`,
            recoverable: true,
            suggestion: `Wait ${rateLimit.retryAfter} second(s) before retrying`,
          },
        };
      }
    }

    // Optional validation
    if (adapter.validate) {
      const validation = adapter.validate(args);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: String(ErrorCode.InvalidParams),
            message: validation.error || 'Invalid arguments',
            details: validation.details,
            recoverable: true,
            suggestion: 'Check the tool input schema and try again',
          },
        };
      }
    }

    // Execute tool
    try {
      const startTime = Date.now();
      const result = await adapter.execute(args, context);

      // Ensure duration is tracked (adapters should set this, but fallback here)
      if (result.success && result.metadata && !result.metadata.duration_ms) {
        result.metadata.duration_ms = Date.now() - startTime;
      }

      return result;
    } catch (error) {
      context.logger.error('Tool execution failed', {
        toolName,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: {
          code: String(ErrorCode.ToolExecutionError),
          message: error instanceof Error ? error.message : 'Tool execution failed',
          recoverable: true,
          suggestion: 'Check the tool arguments and try again',
        },
      };
    }
  }

  /**
   * Get adapter by tool name
   */
  getAdapter(toolName: string): ToolAdapter | undefined {
    return this.adapters.get(toolName);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.adapters.has(toolName);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAdapters: number;
    toolNames: string[];
  } {
    return {
      totalAdapters: this.adapters.size,
      toolNames: this.getToolNames(),
    };
  }

  /**
   * Shutdown all adapters
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.adapters.values())
      .filter((adapter) => adapter.shutdown)
      .map((adapter) => adapter.shutdown?.());

    await Promise.all(shutdownPromises);
    this.adapters.clear();
  }

  /**
   * Get rate limit status for all tools
   */
  getRateLimitStatus(): Map<string, { available: number; capacity: number }> | null {
    return this.rateLimiter?.getStatus() ?? null;
  }

  /**
   * Reset rate limit for specific tool (for testing/admin)
   */
  resetRateLimit(toolName: string): void {
    this.rateLimiter?.reset(toolName);
  }

  /**
   * Reset all rate limits (for testing/admin)
   */
  resetAllRateLimits(): void {
    this.rateLimiter?.resetAll();
  }
}
