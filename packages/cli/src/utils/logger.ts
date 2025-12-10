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
 */
export function createIndexLogger(verbose: boolean): Logger {
  const level: LogLevel = verbose ? 'debug' : 'info';
  return createLogger({
    level,
    format: 'pretty',
  });
}
