/**
 * CLI Logger using @lytics/kero
 */

import { createLogger, type Logger, type LogLevel } from '@lytics/kero';

// Create a logger with pretty output and icons
export const keroLogger = createLogger({
  preset: 'development',
  format: 'pretty',
});

// Export a simple interface for CLI usage
export const logger = {
  info: (message: string) => {
    keroLogger.info(message);
  },

  success: (message: string) => {
    keroLogger.success(message);
  },

  error: (message: string) => {
    keroLogger.error(message);
  },

  warn: (message: string) => {
    keroLogger.warn(message);
  },

  log: (message: string) => {
    keroLogger.info(message);
  },

  debug: (message: string) => {
    keroLogger.debug(message);
  },
};

/**
 * Create a logger for indexing operations with configurable verbosity
 *
 * In non-verbose mode, only warnings and errors are shown (progress handled by ProgressRenderer).
 * In verbose mode, all debug logs are shown for troubleshooting.
 */
export function createIndexLogger(verbose: boolean): Logger {
  const level: LogLevel = verbose ? 'debug' : 'warn';
  return createLogger({
    level,
    format: 'pretty',
  });
}
