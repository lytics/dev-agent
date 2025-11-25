/**
 * Observability Module
 *
 * Provides request tracking, structured logging, and metrics
 * for the dev-agent system.
 *
 * @example
 * ```typescript
 * import { createLogger, createRequestTracker } from '@lytics/dev-agent-core';
 *
 * // Create a logger
 * const logger = createLogger({ component: 'my-adapter', level: 'debug' });
 * logger.info('Starting operation', { tool: 'dev_search' });
 *
 * // Track requests
 * const tracker = createRequestTracker({ eventBus });
 * const ctx = tracker.startRequest('dev_search', { query: 'auth' });
 * // ... do work
 * tracker.completeRequest(ctx.requestId, tokenEstimate);
 *
 * // Get metrics
 * const metrics = tracker.getMetrics();
 * console.log(`Total requests: ${metrics.total}, P95: ${metrics.p95Duration}ms`);
 * ```
 */

export { createLogger, ObservableLoggerImpl } from './logger';
export type { RequestTrackerConfig } from './request-tracker';
export { createRequestTracker, RequestTracker } from './request-tracker';
export type {
  LogEntry,
  LogFormat,
  LoggerConfig,
  LogLevel,
  MetricPoint,
  ObservableLogger,
  RequestContext,
  RequestMetrics,
  Timer,
} from './types';
