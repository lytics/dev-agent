import type { LoggerConfig } from './types';

/**
 * Preset configurations for common use cases
 */
export const presets: Record<string, Partial<LoggerConfig>> = {
  /**
   * Development preset
   * - Pretty output with colors
   * - Debug level for maximum visibility
   */
  development: {
    level: 'debug',
    format: 'pretty',
  },

  /**
   * Production preset
   * - JSON output for log aggregation
   * - Info level (no debug noise)
   */
  production: {
    level: 'info',
    format: 'json',
  },

  /**
   * Test preset
   * - JSON output for parsing in tests
   * - Warn level (minimal output)
   */
  test: {
    level: 'warn',
    format: 'json',
  },

  /**
   * Silent preset
   * - Fatal only (essentially silent)
   */
  silent: {
    level: 'fatal',
    format: 'json',
  },
};

/**
 * Get preset configuration by name
 */
export function getPreset(name: string): Partial<LoggerConfig> {
  return presets[name] ?? presets.development;
}
