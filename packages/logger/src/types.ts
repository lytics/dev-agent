/**
 * Log levels in order of priority (lowest to highest)
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Numeric values for log levels (Pino-compatible)
 */
export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * Log entry passed to formatters and transports
 */
export interface LogEntry {
  level: LogLevel;
  levelValue: number;
  time: number;
  msg: string;
  context: Record<string, unknown>;
  error?: Error;
}

/**
 * Formatter transforms a log entry into a string
 */
export interface Formatter {
  format(entry: LogEntry): string;
}

/**
 * Transport writes formatted log output somewhere
 */
export interface Transport {
  write(entry: LogEntry, formatted: string): void;
  flush?(): void;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level?: LogLevel;
  /** Format preset: 'pretty' for development, 'json' for production */
  format?: 'pretty' | 'json';
  /** Custom formatter (overrides format) */
  formatter?: Formatter;
  /** Custom transports (overrides default console transport) */
  transports?: Transport[];
  /** Context to include in all log entries */
  context?: Record<string, unknown>;
  /** Preset configuration */
  preset?: 'development' | 'production' | 'test';
}

/**
 * Logger interface
 */
export interface Logger {
  /** Log at trace level */
  trace(msg: string): void;
  trace(obj: Record<string, unknown>, msg: string): void;

  /** Log at debug level */
  debug(msg: string): void;
  debug(obj: Record<string, unknown>, msg: string): void;

  /** Log at info level */
  info(msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;

  /** Log success at info level (with success indicator) */
  success(msg: string): void;
  success(obj: Record<string, unknown>, msg: string): void;

  /** Log at warn level */
  warn(msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;

  /** Log at error level */
  error(msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  error(err: Error, msg: string): void;

  /** Log at fatal level */
  fatal(msg: string): void;
  fatal(obj: Record<string, unknown>, msg: string): void;
  fatal(err: Error, msg: string): void;

  /** Create a child logger with additional context */
  child(context: Record<string, unknown>): Logger;

  /** Start a timer, returns a function to stop and log */
  startTimer(label: string): () => void;

  /** Check if a level would be logged */
  isLevelEnabled(level: LogLevel): boolean;

  /** Get current log level */
  readonly level: LogLevel;
}
