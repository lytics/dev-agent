/**
 * Logger = Observability System
 * Structured logging for the coordinator and agents using @lytics/kero
 */

import type { Logger as KeroLogger } from '@lytics/kero';
import { createLogger } from '@lytics/kero';
import type { Logger } from '../types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Coordinator Logger - wraps kero with the coordinator's logger interface
 */
export class CoordinatorLogger implements Logger {
  private kero: KeroLogger;
  private context: string;

  constructor(context: string = 'coordinator', level: LogLevel = 'info') {
    this.context = context;

    // Map coordinator levels to kero levels
    const keroLevel =
      level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error';

    this.kero = createLogger({
      level: keroLevel,
      format: 'pretty',
      context: { component: context },
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.kero.debug(meta, message);
    } else {
      this.kero.debug(message);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.kero.info(meta, message);
    } else {
      this.kero.info(message);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.kero.warn(meta, message);
    } else {
      this.kero.warn(message);
    }
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    if (error) {
      const errorMeta = { ...meta, error: error.message, stack: error.stack };
      this.kero.error(errorMeta, message);
    } else if (meta) {
      this.kero.error(meta, message);
    } else {
      this.kero.error(message);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: string): CoordinatorLogger {
    const newContext = `${this.context}:${childContext}`;
    const currentLevel = this.kero.level;

    // Map kero level back to coordinator level
    const coordinatorLevel: LogLevel =
      currentLevel === 'trace' || currentLevel === 'debug'
        ? 'debug'
        : currentLevel === 'info'
          ? 'info'
          : currentLevel === 'warn'
            ? 'warn'
            : 'error';

    return new CoordinatorLogger(newContext, coordinatorLevel);
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    // Need to recreate logger with new level
    const keroLevel =
      level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error';

    this.kero = createLogger({
      level: keroLevel,
      format: 'pretty',
      context: { component: this.context },
    });
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    const keroLevel = this.kero.level;
    // Map kero level to coordinator level
    if (keroLevel === 'trace' || keroLevel === 'debug') return 'debug';
    if (keroLevel === 'info') return 'info';
    if (keroLevel === 'warn') return 'warn';
    return 'error';
  }
}
