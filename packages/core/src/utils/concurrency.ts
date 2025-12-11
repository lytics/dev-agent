/**
 * Concurrency calculation utilities
 * Separated for testability and reuse across scanners and indexers
 */

export interface SystemResources {
  cpuCount: number;
  memoryGB: number;
}

export interface ConcurrencyConfig {
  context: string;
  systemResources: SystemResources;
  environmentVariables: Record<string, string | undefined>;
}

/**
 * Calculate optimal concurrency based on system resources
 */
export function calculateOptimalConcurrency(
  context: string,
  systemResources: SystemResources
): number {
  const { cpuCount, memoryGB } = systemResources;

  // Context-specific logic
  if (context === 'indexer') {
    // Indexer is more memory-intensive
    if (memoryGB < 4) return 2;
    if (memoryGB < 8) return 3;
    if (cpuCount >= 8) return 5;
    return 4;
  } else {
    // Scanner contexts (typescript, go, etc.)
    if (memoryGB < 4) return 5;
    if (memoryGB < 8) return 15;
    if (cpuCount >= 8) return 30;
    return 20;
  }
}

/**
 * Parse environment variable for concurrency setting
 */
export function parseConcurrencyFromEnv(
  context: string,
  environmentVariables: Record<string, string | undefined>,
  maxValue: number = 50
): number | null {
  const envVar = `DEV_AGENT_${context.toUpperCase()}_CONCURRENCY`;
  const envValue = environmentVariables[envVar] || environmentVariables.DEV_AGENT_CONCURRENCY;

  if (!envValue) return null;

  const parsed = parseInt(envValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 100) {
    return null;
  }

  return Math.min(parsed, maxValue);
}

/**
 * Get optimal concurrency with environment variable override
 */
export function getOptimalConcurrency(config: ConcurrencyConfig): number {
  const { context, systemResources, environmentVariables } = config;

  // Try environment variable first
  const envConcurrency = parseConcurrencyFromEnv(context, environmentVariables);
  if (envConcurrency !== null) {
    return envConcurrency;
  }

  // Fall back to system-based calculation
  return calculateOptimalConcurrency(context, systemResources);
}

/**
 * Get current system resources (wrapper for testing)
 */
export function getCurrentSystemResources(): SystemResources {
  const os = require('node:os');
  return {
    cpuCount: os.cpus().length,
    memoryGB: os.totalmem() / (1024 * 1024 * 1024),
  };
}
