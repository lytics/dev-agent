/**
 * MCP Server Logger using @lytics/kero
 *
 * MCP requires all logs on stderr (stdout is reserved for JSON-RPC)
 */

import type { LogEntry, Transport } from '@lytics/kero';
import { createLogger } from '@lytics/kero';
import type { Logger } from '../adapters/types';

/**
 * Stderr transport - writes all log levels to stderr
 * Required for MCP protocol compliance
 */
class StderrTransport implements Transport {
  write(_entry: LogEntry, formatted: string): void {
    process.stderr.write(`${formatted}\n`);
  }

  flush(): void {
    // No-op for stderr, writes are synchronous
  }
}

/**
 * Create an MCP-compliant logger
 */
export class ConsoleLogger implements Logger {
  private kero: ReturnType<typeof createLogger>;

  constructor(prefix = '[MCP]', minLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    // Map MCP levels to kero levels
    const levelMap: Record<string, 'trace' | 'debug' | 'info' | 'warn' | 'error'> = {
      debug: 'debug',
      info: 'info',
      warn: 'warn',
      error: 'error',
    };

    this.kero = createLogger({
      level: levelMap[minLevel] || 'info',
      format: 'pretty',
      transports: [new StderrTransport()],
      context: { component: prefix },
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

  error(message: string | Error, meta?: Record<string, unknown>): void {
    if (message instanceof Error) {
      this.kero.error(message, meta ? JSON.stringify(meta) : message.message);
    } else if (meta) {
      this.kero.error(meta, message);
    } else {
      this.kero.error(message);
    }
  }
}
