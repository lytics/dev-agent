import { JsonFormatter } from './formatters/json';
import { PrettyFormatter } from './formatters/pretty';
import { getPreset } from './presets';
import { ConsoleTransport } from './transports/console';
import type { Formatter, LogEntry, Logger, LoggerConfig, LogLevel, Transport } from './types';
import { LOG_LEVELS } from './types';

/**
 * Core logger implementation
 */
export class KeroLogger implements Logger {
  private readonly _level: LogLevel;
  private readonly levelValue: number;
  private readonly formatter: Formatter;
  private readonly transports: Transport[];
  private readonly context: Record<string, unknown>;

  constructor(config: LoggerConfig = {}) {
    // Apply preset first, then override with explicit config
    const preset = config.preset ? getPreset(config.preset) : {};
    const merged = { ...preset, ...config };

    this._level = merged.level ?? 'info';
    this.levelValue = LOG_LEVELS[this._level];
    this.context = merged.context ?? {};

    // Set up formatter
    if (merged.formatter) {
      this.formatter = merged.formatter;
    } else if (merged.format === 'json') {
      this.formatter = new JsonFormatter();
    } else {
      this.formatter = new PrettyFormatter();
    }

    // Set up transports
    this.transports = merged.transports ?? [new ConsoleTransport()];
  }

  get level(): LogLevel {
    return this._level;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.levelValue;
  }

  trace(msgOrObj: string | Record<string, unknown>, msg?: string): void {
    this.log('trace', msgOrObj, msg);
  }

  debug(msgOrObj: string | Record<string, unknown>, msg?: string): void {
    this.log('debug', msgOrObj, msg);
  }

  info(msgOrObj: string | Record<string, unknown>, msg?: string): void {
    this.log('info', msgOrObj, msg);
  }

  success(msgOrObj: string | Record<string, unknown>, msg?: string): void {
    // Log at info level with success indicator
    if (typeof msgOrObj === 'string') {
      this.log('info', { _success: true }, msgOrObj);
    } else {
      this.log('info', { ...msgOrObj, _success: true }, msg);
    }
  }

  warn(msgOrObj: string | Record<string, unknown>, msg?: string): void {
    this.log('warn', msgOrObj, msg);
  }

  error(msgOrObjOrErr: string | Record<string, unknown> | Error, msg?: string): void {
    this.log('error', msgOrObjOrErr, msg);
  }

  fatal(msgOrObjOrErr: string | Record<string, unknown> | Error, msg?: string): void {
    this.log('fatal', msgOrObjOrErr, msg);
  }

  child(childContext: Record<string, unknown>): Logger {
    return new KeroLogger({
      level: this._level,
      formatter: this.formatter,
      transports: this.transports,
      context: { ...this.context, ...childContext },
    });
  }

  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info({ duration, label }, `${label} completed (${duration}ms)`);
    };
  }

  private log(
    level: LogLevel,
    msgOrObjOrErr: string | Record<string, unknown> | Error,
    msg?: string
  ): void {
    // Check if level is enabled
    if (!this.isLevelEnabled(level)) return;

    // Parse arguments
    let message: string;
    let extraContext: Record<string, unknown> = {};
    let error: Error | undefined;

    if (typeof msgOrObjOrErr === 'string') {
      message = msgOrObjOrErr;
    } else if (msgOrObjOrErr instanceof Error) {
      error = msgOrObjOrErr;
      message = msg ?? msgOrObjOrErr.message;
    } else {
      extraContext = msgOrObjOrErr;
      message = msg ?? '';
    }

    // Build log entry
    const entry: LogEntry = {
      level,
      levelValue: LOG_LEVELS[level],
      time: Date.now(),
      msg: message,
      context: { ...this.context, ...extraContext },
      error,
    };

    // Format and write
    const formatted = this.formatter.format(entry);
    for (const transport of this.transports) {
      transport.write(entry, formatted);
    }
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  return new KeroLogger(config);
}

/**
 * Default logger instance (development preset)
 */
export const kero = createLogger({ preset: 'development' });
