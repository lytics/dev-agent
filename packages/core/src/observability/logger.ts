/**
 * Observable Logger
 *
 * Structured logging with request correlation, timing, and multiple output formats.
 * Uses @lytics/kero as the underlying logging engine.
 */

import type { Logger as KeroLogger } from '@lytics/kero';
import { createLogger as createKeroLogger } from '@lytics/kero';
import type { LoggerConfig, LogLevel, ObservableLogger, Timer } from './types';

/**
 * Observable Logger Implementation
 * Wraps @lytics/kero with request tracking and timing utilities
 */
export class ObservableLoggerImpl implements ObservableLogger {
  private config: Required<LoggerConfig>;
  private requestId?: string;
  private kero: KeroLogger;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? 'info',
      format: config.format ?? 'pretty',
      component: config.component ?? 'app',
      timestamps: config.timestamps ?? true,
      colors: config.colors ?? true,
    };

    // Map observable logger level to kero level
    const keroLevel =
      this.config.level === 'debug'
        ? 'debug'
        : this.config.level === 'info'
          ? 'info'
          : this.config.level === 'warn'
            ? 'warn'
            : 'error';

    // Create kero logger instance
    this.kero = createKeroLogger({
      level: keroLevel,
      format: this.config.format === 'json' ? 'json' : 'pretty',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Standard Log Methods
  // ─────────────────────────────────────────────────────────────────────────

  debug(message: string, data?: Record<string, unknown>): void {
    const context = this.buildContext(data);
    if (context) {
      this.kero.debug(context, message);
    } else {
      this.kero.debug(message);
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    const context = this.buildContext(data);
    if (context) {
      this.kero.info(context, message);
    } else {
      this.kero.info(message);
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    const context = this.buildContext(data);
    if (context) {
      this.kero.warn(context, message);
    } else {
      this.kero.warn(message);
    }
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

    const context = this.buildContext({ ...data, ...errorData });

    if (error && context) {
      this.kero.error(context, message);
    } else if (error) {
      this.kero.error(error, message);
    } else if (context) {
      this.kero.error(context, message);
    } else {
      this.kero.error(message);
    }
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
  // Timing Utilities
  // ─────────────────────────────────────────────────────────────────────────

  startTimer(label: string): Timer {
    const start = Date.now();

    return {
      stop: () => {
        const duration = Date.now() - start;
        const context = this.buildContext({ duration, label });
        if (context) {
          this.kero.info(context, `${label} completed`);
        } else {
          this.kero.info(`${label} completed`);
        }
        return duration;
      },
      elapsed: () => Date.now() - start,
    };
  }

  time<T>(label: string, fn: () => T): T;
  time<T>(label: string, fn: () => Promise<T>): Promise<T>;
  time<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    const timer = this.startTimer(label);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.then(
          (value) => {
            timer.stop();
            return value;
          },
          (error) => {
            const duration = timer.stop();
            this.error(`${label} failed`, error instanceof Error ? error : undefined, { duration });
            throw error;
          }
        );
      }

      timer.stop();
      return result;
    } catch (error) {
      const duration = timer.stop();
      this.error(`${label} failed`, error instanceof Error ? error : undefined, { duration });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  setLevel(level: LogLevel): void {
    this.config.level = level;

    // Recreate kero logger with new level
    const keroLevel =
      level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error';

    this.kero = createKeroLogger({
      level: keroLevel,
      format: this.config.format === 'json' ? 'json' : 'pretty',
    });
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private buildContext(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data && !this.requestId) return undefined;

    const context: Record<string, unknown> = {};

    if (this.requestId) {
      context.requestId = this.requestId;
    }

    if (data) {
      Object.assign(context, data);
    }

    return Object.keys(context).length > 0 ? context : undefined;
  }
}

/**
 * Create a new observable logger
 */
export function createLogger(config: Partial<LoggerConfig> = {}): ObservableLogger {
  return new ObservableLoggerImpl(config);
}
