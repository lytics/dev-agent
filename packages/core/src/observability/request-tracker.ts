/**
 * Request Tracker
 *
 * Tracks request lifecycle and emits events for observability.
 * Integrates with EventBus for pub/sub communication.
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../events';
import type { RequestContext, RequestMetrics } from './types';

/**
 * Request tracker configuration
 */
export interface RequestTrackerConfig {
  /** Event bus for emitting request events */
  eventBus?: EventBus;
  /** Maximum number of completed requests to keep in history */
  maxHistory?: number;
}

/**
 * Completed request record
 */
interface CompletedRequest {
  requestId: string;
  tool: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  tokenEstimate?: number;
}

/**
 * Request Tracker
 *
 * Tracks active requests and maintains history for metrics.
 * Emits events via EventBus for real-time observability.
 */
export class RequestTracker {
  private activeRequests: Map<string, RequestContext> = new Map();
  private completedRequests: CompletedRequest[] = [];
  private eventBus?: EventBus;
  private maxHistory: number;

  constructor(config: RequestTrackerConfig = {}) {
    this.eventBus = config.eventBus;
    this.maxHistory = config.maxHistory ?? 1000;
  }

  /**
   * Start tracking a new request
   * @returns RequestContext with generated requestId
   */
  startRequest(tool: string, args: Record<string, unknown>, parentId?: string): RequestContext {
    const context: RequestContext = {
      requestId: randomUUID(),
      startTime: Date.now(),
      tool,
      args,
      parentId,
    };

    this.activeRequests.set(context.requestId, context);

    // Emit request started event
    if (this.eventBus) {
      void this.eventBus.emit('request.started', {
        requestId: context.requestId,
        tool,
        args,
        timestamp: context.startTime,
      });
    }

    return context;
  }

  /**
   * Mark a request as completed successfully
   */
  completeRequest(requestId: string, tokenEstimate?: number): void {
    const context = this.activeRequests.get(requestId);
    if (!context) {
      return;
    }

    const endTime = Date.now();
    const duration = endTime - context.startTime;

    // Record completion
    this.recordCompletion({
      requestId,
      tool: context.tool,
      startTime: context.startTime,
      endTime,
      duration,
      success: true,
      tokenEstimate,
    });

    // Remove from active
    this.activeRequests.delete(requestId);

    // Emit request completed event
    if (this.eventBus) {
      void this.eventBus.emit('request.completed', {
        requestId,
        tool: context.tool,
        duration,
        success: true,
        tokenEstimate,
      });
    }
  }

  /**
   * Mark a request as failed
   */
  failRequest(requestId: string, error: string): void {
    const context = this.activeRequests.get(requestId);
    if (!context) {
      return;
    }

    const endTime = Date.now();
    const duration = endTime - context.startTime;

    // Record failure
    this.recordCompletion({
      requestId,
      tool: context.tool,
      startTime: context.startTime,
      endTime,
      duration,
      success: false,
      error,
    });

    // Remove from active
    this.activeRequests.delete(requestId);

    // Emit request failed event
    if (this.eventBus) {
      void this.eventBus.emit('request.failed', {
        requestId,
        tool: context.tool,
        duration,
        error,
      });
    }
  }

  /**
   * Get active request context by ID
   */
  getRequest(requestId: string): RequestContext | undefined {
    return this.activeRequests.get(requestId);
  }

  /**
   * Get all active requests
   */
  getActiveRequests(): RequestContext[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Get the number of active requests
   */
  getActiveCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get request metrics summary
   */
  getMetrics(): RequestMetrics {
    const completed = this.completedRequests;

    if (completed.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        avgDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        byTool: {},
      };
    }

    // Calculate totals
    const total = completed.length;
    const success = completed.filter((r) => r.success).length;
    const failed = total - success;

    // Calculate durations
    const durations = completed.map((r) => r.duration).sort((a, b) => a - b);
    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / total);
    const p50Duration = this.percentile(durations, 50);
    const p95Duration = this.percentile(durations, 95);
    const p99Duration = this.percentile(durations, 99);

    // Calculate by tool
    const byTool: Record<string, { count: number; avgDuration: number }> = {};
    for (const req of completed) {
      if (!byTool[req.tool]) {
        byTool[req.tool] = { count: 0, avgDuration: 0 };
      }
      byTool[req.tool].count++;
    }

    // Calculate avg duration per tool
    for (const tool of Object.keys(byTool)) {
      const toolRequests = completed.filter((r) => r.tool === tool);
      const totalDuration = toolRequests.reduce((sum, r) => sum + r.duration, 0);
      byTool[tool].avgDuration = Math.round(totalDuration / toolRequests.length);
    }

    return {
      total,
      success,
      failed,
      avgDuration,
      p50Duration,
      p95Duration,
      p99Duration,
      byTool,
    };
  }

  /**
   * Clear all history (keeps active requests)
   */
  clearHistory(): void {
    this.completedRequests = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private recordCompletion(record: CompletedRequest): void {
    this.completedRequests.push(record);

    // Trim history if needed
    if (this.completedRequests.length > this.maxHistory) {
      this.completedRequests = this.completedRequests.slice(-this.maxHistory);
    }
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * Create a new request tracker
 */
export function createRequestTracker(config?: RequestTrackerConfig): RequestTracker {
  return new RequestTracker(config);
}
