/**
 * Observability Types
 *
 * Types for request tracking, metrics, and structured logging.
 */

/**
 * Request context that flows through the system
 * Enables correlation of logs and events for a single request
 */
export interface RequestContext {
  /** Unique request identifier */
  requestId: string;
  /** Request start time (ms since epoch) */
  startTime: number;
  /** Tool/operation being executed */
  tool: string;
  /** Original request arguments */
  args: Record<string, unknown>;
  /** Parent request ID (for nested operations) */
  parentId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Component that generated the log */
  component: string;
  /** Request ID for correlation */
  requestId?: string;
  /** Duration in ms (for timed operations) */
  duration?: number;
  /** Additional structured data */
  data?: Record<string, unknown>;
  /** Error information */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Log output format
 */
export type LogFormat = 'pretty' | 'json';

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Output format */
  format: LogFormat;
  /** Component name for this logger */
  component: string;
  /** Include timestamps */
  timestamps?: boolean;
  /** Include colors (pretty format only) */
  colors?: boolean;
}

/**
 * Timer returned by startTimer()
 */
export interface Timer {
  /** Stop the timer and return duration in ms */
  stop(): number;
  /** Get elapsed time without stopping */
  elapsed(): number;
}

/**
 * Observable logger interface
 */
export interface ObservableLogger {
  // Standard log methods
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;

  // Scoped logging
  child(component: string): ObservableLogger;
  withRequest(requestId: string): ObservableLogger;

  // Timing
  startTimer(operation: string): Timer;
  time<T>(operation: string, fn: () => T | Promise<T>): Promise<T>;

  // Configuration
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

/**
 * Metrics types
 */
export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

/**
 * Request metrics summary
 */
export interface RequestMetrics {
  /** Total requests */
  total: number;
  /** Successful requests */
  success: number;
  /** Failed requests */
  failed: number;
  /** Average duration (ms) */
  avgDuration: number;
  /** P50 duration (ms) */
  p50Duration: number;
  /** P95 duration (ms) */
  p95Duration: number;
  /** P99 duration (ms) */
  p99Duration: number;
  /** Requests by tool */
  byTool: Record<string, { count: number; avgDuration: number }>;
}
