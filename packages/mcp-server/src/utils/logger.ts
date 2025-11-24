/**
 * Simple logger implementation
 */

import type { Logger } from '../adapters/types';

export class ConsoleLogger implements Logger {
  constructor(
    private prefix = '[MCP]',
    private minLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'
  ) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.minLevel === 'debug') {
      // MCP requires all logs on stderr (stdout is for JSON-RPC only)
      console.error(`${this.prefix} DEBUG:`, message, meta || '');
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.minLevel === 'debug' || this.minLevel === 'info') {
      // MCP requires all logs on stderr (stdout is for JSON-RPC only)
      console.error(`${this.prefix} INFO:`, message, meta ? JSON.stringify(meta) : '');
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.minLevel !== 'error') {
      // MCP requires all logs on stderr (stdout is for JSON-RPC only)
      console.error(`${this.prefix} WARN:`, message, meta ? JSON.stringify(meta) : '');
    }
  }

  error(message: string | Error, meta?: Record<string, unknown>): void {
    const errorMsg = message instanceof Error ? message.message : message;
    console.error(`${this.prefix} ERROR:`, errorMsg, meta ? JSON.stringify(meta) : '');
    if (message instanceof Error && message.stack) {
      console.error(message.stack);
    }
  }
}
