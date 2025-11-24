/**
 * Simple logger implementation
 */

import type { Logger } from '../adapters/types';

export class ConsoleLogger implements Logger {
  constructor(private prefix = '[MCP]') {}

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      console.debug(`${this.prefix} DEBUG:`, message, meta || '');
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`${this.prefix} INFO:`, message, meta ? JSON.stringify(meta) : '');
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`${this.prefix} WARN:`, message, meta ? JSON.stringify(meta) : '');
  }

  error(message: string | Error, meta?: Record<string, unknown>): void {
    const errorMsg = message instanceof Error ? message.message : message;
    console.error(`${this.prefix} ERROR:`, errorMsg, meta ? JSON.stringify(meta) : '');
    if (message instanceof Error && message.stack) {
      console.error(message.stack);
    }
  }
}
