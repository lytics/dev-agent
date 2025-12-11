/**
 * Tests for concurrency calculation utilities
 */

import { describe, expect, it } from 'vitest';
import {
  type ConcurrencyConfig,
  calculateOptimalConcurrency,
  getOptimalConcurrency,
  parseConcurrencyFromEnv,
  type SystemResources,
} from '../concurrency';

describe('calculateOptimalConcurrency', () => {
  it('should return low concurrency for low memory systems', () => {
    const lowMemorySystem: SystemResources = { cpuCount: 4, memoryGB: 2 };

    expect(calculateOptimalConcurrency('typescript', lowMemorySystem)).toBe(5);
    expect(calculateOptimalConcurrency('indexer', lowMemorySystem)).toBe(2);
  });

  it('should return medium concurrency for standard systems', () => {
    const standardSystem: SystemResources = { cpuCount: 4, memoryGB: 6 };

    expect(calculateOptimalConcurrency('typescript', standardSystem)).toBe(15);
    expect(calculateOptimalConcurrency('indexer', standardSystem)).toBe(3);
  });

  it('should return high concurrency for high-end systems', () => {
    const highEndSystem: SystemResources = { cpuCount: 12, memoryGB: 16 };

    expect(calculateOptimalConcurrency('typescript', highEndSystem)).toBe(30);
    expect(calculateOptimalConcurrency('indexer', highEndSystem)).toBe(5);
  });

  it('should handle edge case values', () => {
    const extremeSystem: SystemResources = { cpuCount: 1, memoryGB: 0.5 };

    expect(calculateOptimalConcurrency('typescript', extremeSystem)).toBe(5);
    expect(calculateOptimalConcurrency('indexer', extremeSystem)).toBe(2);
  });
});

describe('parseConcurrencyFromEnv', () => {
  it('should parse valid environment variables', () => {
    const env = {
      DEV_AGENT_TYPESCRIPT_CONCURRENCY: '20',
      DEV_AGENT_CONCURRENCY: '10',
    };

    expect(parseConcurrencyFromEnv('typescript', env)).toBe(20);
    expect(parseConcurrencyFromEnv('go', env)).toBe(10); // falls back to general
  });

  it('should return null for invalid values', () => {
    const invalidEnv = {
      DEV_AGENT_TYPESCRIPT_CONCURRENCY: 'invalid',
      DEV_AGENT_INDEXER_CONCURRENCY: '0',
      DEV_AGENT_GO_CONCURRENCY: '101',
    };

    expect(parseConcurrencyFromEnv('typescript', invalidEnv)).toBeNull();
    expect(parseConcurrencyFromEnv('indexer', invalidEnv)).toBeNull();
    expect(parseConcurrencyFromEnv('go', invalidEnv)).toBeNull();
  });

  it('should respect max value cap', () => {
    const env = { DEV_AGENT_CONCURRENCY: '100' };

    expect(parseConcurrencyFromEnv('typescript', env, 30)).toBe(30);
  });

  it('should return null when no relevant env vars exist', () => {
    const emptyEnv = {};

    expect(parseConcurrencyFromEnv('typescript', emptyEnv)).toBeNull();
  });
});

describe('getOptimalConcurrency', () => {
  it('should prefer environment variable over system detection', () => {
    const config: ConcurrencyConfig = {
      context: 'typescript',
      systemResources: { cpuCount: 16, memoryGB: 32 }, // Would give 30
      environmentVariables: { DEV_AGENT_TYPESCRIPT_CONCURRENCY: '5' },
    };

    expect(getOptimalConcurrency(config)).toBe(5);
  });

  it('should fall back to system detection when no env var', () => {
    const config: ConcurrencyConfig = {
      context: 'typescript',
      systemResources: { cpuCount: 8, memoryGB: 16 },
      environmentVariables: {},
    };

    expect(getOptimalConcurrency(config)).toBe(30);
  });

  it('should use general env var as fallback', () => {
    const config: ConcurrencyConfig = {
      context: 'go',
      systemResources: { cpuCount: 4, memoryGB: 8 },
      environmentVariables: { DEV_AGENT_CONCURRENCY: '12' },
    };

    expect(getOptimalConcurrency(config)).toBe(12);
  });
});
