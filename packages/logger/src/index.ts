/**
 * @lytics/kero - Zero-dependency TypeScript logger
 *
 * @example
 * ```typescript
 * import { createLogger, kero } from '@lytics/kero';
 *
 * // Use the default logger
 * kero.info('Hello, world!');
 * kero.debug({ user: 'alice' }, 'User logged in');
 *
 * // Create a custom logger
 * const logger = createLogger({
 *   level: 'debug',
 *   format: 'json',
 * });
 *
 * // Child loggers inherit context
 * const reqLogger = logger.child({ requestId: 'abc-123' });
 * reqLogger.info('Processing request');
 *
 * // Timing
 * const done = kero.startTimer('database-query');
 * await db.query(sql);
 * done(); // logs: "database-query completed (42ms)"
 * ```
 */

// Formatters
export { JsonFormatter } from './formatters/json';
export { PrettyFormatter } from './formatters/pretty';
// Main exports
export { createLogger, KeroLogger, kero } from './logger';
// Presets
export { getPreset, presets } from './presets';
// Transports
export { ConsoleTransport } from './transports/console';
// Types
export type {
  Formatter,
  LogEntry,
  Logger,
  LoggerConfig,
  LogLevel,
  Transport,
} from './types';
export { LOG_LEVELS } from './types';
