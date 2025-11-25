/**
 * Observable Logger
 *
 * Structured logging with request correlation, timing, and multiple output formats.
 */

import type { LogEntry, LogFormat, LoggerConfig, LogLevel, ObservableLogger, Timer } from './types';

/**
 * Log level priorities (higher = more severe)
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * ANSI color codes for pretty output
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  // Levels
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  // Components
  component: '\x1b[35m', // Magenta
  requestId: '\x1b[34m', // Blue
  duration: '\x1b[33m', // Yellow
};

/**
 * Observable Logger Implementation
 */
export class ObservableLoggerImpl implements ObservableLogger {
  private config: Required<LoggerConfig>;
  private requestId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? 'info',
      format: config.format ?? 'pretty',
      component: config.component ?? 'app',
      timestamps: config.timestamps ?? true,
      colors: config.colors ?? true,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Standard Log Methods
  // ─────────────────────────────────────────────────────────────────────────

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const errorData = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : undefined;

    this.log('error', message, { ...data, ...errorData });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scoped Logging
  // ─────────────────────────────────────────────────────────────────────────

  child(component: string): ObservableLogger {
    const childLogger = new ObservableLoggerImpl({
      ...this.config,
      component: `${this.config.component}:${component}`,
    });
    childLogger.requestId = this.requestId;
    return childLogger;
  }

  withRequest(requestId: string): ObservableLogger {
    const scopedLogger = new ObservableLoggerImpl(this.config);
    scopedLogger.requestId = requestId;
    return scopedLogger;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Timing
  // ─────────────────────────────────────────────────────────────────────────

  startTimer(operation: string): Timer {
    const startTime = performance.now();
    let stopped = false;
    let finalDuration = 0;

    return {
      stop: () => {
        if (!stopped) {
          finalDuration = performance.now() - startTime;
          stopped = true;
          this.debug(`${operation} completed`, { duration: Math.round(finalDuration) });
        }
        return Math.round(finalDuration);
      },
      elapsed: () => {
        return stopped ? Math.round(finalDuration) : Math.round(performance.now() - startTime);
      },
    };
  }

  async time<T>(operation: string, fn: () => T | Promise<T>): Promise<T> {
    const timer = this.startTimer(operation);
    try {
      const result = await fn();
      timer.stop();
      return result;
    } catch (error) {
      const duration = timer.stop();
      this.error(`${operation} failed`, error as Error, { duration });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────────────

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    // Check if this level should be logged
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: this.config.component,
      requestId: this.requestId,
      data,
    };

    // Extract duration from data if present
    if (data?.duration !== undefined) {
      entry.duration = data.duration as number;
    }

    // Extract error from data if present
    if (data?.error) {
      entry.error = data.error as LogEntry['error'];
    }

    // Output based on format
    if (this.config.format === 'json') {
      this.outputJson(entry);
    } else {
      this.outputPretty(entry);
    }
  }

  private outputJson(entry: LogEntry): void {
    // Clean up the entry for JSON output
    const output: Record<string, unknown> = {
      timestamp: entry.timestamp,
      level: entry.level,
      component: entry.component,
      message: entry.message,
    };

    if (entry.requestId) output.requestId = entry.requestId;
    if (entry.duration !== undefined) output.duration = entry.duration;
    if (entry.data) {
      // Exclude error and duration from data since they're top-level
      const { error: _error, duration: _duration, ...rest } = entry.data;
      if (Object.keys(rest).length > 0) output.data = rest;
    }
    if (entry.error) output.error = entry.error;

    console.error(JSON.stringify(output));
  }

  private outputPretty(entry: LogEntry): void {
    const parts: string[] = [];
    const useColors = this.config.colors;

    // Timestamp
    if (this.config.timestamps) {
      const time = entry.timestamp.split('T')[1].split('.')[0]; // HH:MM:SS
      parts.push(useColors ? `${COLORS.dim}[${time}]${COLORS.reset}` : `[${time}]`);
    }

    // Level
    const levelStr = entry.level.toUpperCase().padEnd(5);
    if (useColors) {
      parts.push(`${COLORS[entry.level]}${levelStr}${COLORS.reset}`);
    } else {
      parts.push(levelStr);
    }

    // Component
    if (useColors) {
      parts.push(`${COLORS.component}[${entry.component}]${COLORS.reset}`);
    } else {
      parts.push(`[${entry.component}]`);
    }

    // Request ID
    if (entry.requestId) {
      const shortId = entry.requestId.slice(0, 8);
      if (useColors) {
        parts.push(`${COLORS.requestId}(${shortId})${COLORS.reset}`);
      } else {
        parts.push(`(${shortId})`);
      }
    }

    // Message
    parts.push(entry.message);

    // Duration
    if (entry.duration !== undefined) {
      const durationStr = `${entry.duration}ms`;
      if (useColors) {
        parts.push(`${COLORS.duration}(${durationStr})${COLORS.reset}`);
      } else {
        parts.push(`(${durationStr})`);
      }
    }

    // Data (excluding error and duration)
    if (entry.data) {
      const { error: _error, duration: _duration, ...rest } = entry.data;
      if (Object.keys(rest).length > 0) {
        const dataStr = JSON.stringify(rest);
        if (useColors) {
          parts.push(`${COLORS.dim}${dataStr}${COLORS.reset}`);
        } else {
          parts.push(dataStr);
        }
      }
    }

    // Output
    console.error(parts.join(' '));

    // Error stack (on separate line)
    if (entry.error?.stack) {
      const stack = entry.error.stack
        .split('\n')
        .slice(1)
        .map((line) => `  ${line.trim()}`)
        .join('\n');
      if (useColors) {
        console.error(`${COLORS.dim}${stack}${COLORS.reset}`);
      } else {
        console.error(stack);
      }
    }
  }
}

/**
 * Create a new observable logger
 */
export function createLogger(config?: Partial<LoggerConfig>): ObservableLogger {
  return new ObservableLoggerImpl(config);
}
