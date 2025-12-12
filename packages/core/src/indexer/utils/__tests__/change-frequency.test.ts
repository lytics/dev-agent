/**
 * Tests for change frequency tracking
 */

import { describe, expect, it } from 'vitest';
import type { FileChangeFrequency } from '../change-frequency';
import { aggregateChangeFrequency } from '../change-frequency';

describe('aggregateChangeFrequency', () => {
  it('should calculate total commits and average', () => {
    const frequencies = new Map<string, FileChangeFrequency>([
      [
        'src/index.ts',
        {
          filePath: 'src/index.ts',
          commitCount: 10,
          lastModified: new Date('2024-01-10'),
          authorCount: 3,
        },
      ],
      [
        'src/utils.ts',
        {
          filePath: 'src/utils.ts',
          commitCount: 20,
          lastModified: new Date('2024-01-15'),
          authorCount: 2,
        },
      ],
    ]);

    const result = aggregateChangeFrequency(frequencies);

    expect(result.totalCommits).toBe(30);
    expect(result.avgCommitsPerFile).toBe(15);
    expect(result.lastModified).toEqual(new Date('2024-01-15'));
  });

  it('should filter by path prefix', () => {
    const frequencies = new Map<string, FileChangeFrequency>([
      [
        'packages/core/src/index.ts',
        {
          filePath: 'packages/core/src/index.ts',
          commitCount: 10,
          lastModified: new Date('2024-01-10'),
          authorCount: 3,
        },
      ],
      [
        'packages/cli/src/index.ts',
        {
          filePath: 'packages/cli/src/index.ts',
          commitCount: 20,
          lastModified: new Date('2024-01-15'),
          authorCount: 2,
        },
      ],
    ]);

    const result = aggregateChangeFrequency(frequencies, 'packages/core/');

    expect(result.totalCommits).toBe(10);
    expect(result.avgCommitsPerFile).toBe(10);
    expect(result.lastModified).toEqual(new Date('2024-01-10'));
  });

  it('should handle empty frequencies', () => {
    const frequencies = new Map<string, FileChangeFrequency>();

    const result = aggregateChangeFrequency(frequencies);

    expect(result.totalCommits).toBe(0);
    expect(result.avgCommitsPerFile).toBe(0);
    expect(result.lastModified).toBeNull();
  });

  it('should handle single file', () => {
    const frequencies = new Map<string, FileChangeFrequency>([
      [
        'README.md',
        {
          filePath: 'README.md',
          commitCount: 5,
          lastModified: new Date('2024-01-01'),
          authorCount: 1,
        },
      ],
    ]);

    const result = aggregateChangeFrequency(frequencies);

    expect(result.totalCommits).toBe(5);
    expect(result.avgCommitsPerFile).toBe(5);
    expect(result.lastModified).toEqual(new Date('2024-01-01'));
  });

  it('should find most recent modification across files', () => {
    const frequencies = new Map<string, FileChangeFrequency>([
      [
        'old.ts',
        {
          filePath: 'old.ts',
          commitCount: 50,
          lastModified: new Date('2023-01-01'),
          authorCount: 5,
        },
      ],
      [
        'new.ts',
        {
          filePath: 'new.ts',
          commitCount: 2,
          lastModified: new Date('2024-12-01'),
          authorCount: 1,
        },
      ],
    ]);

    const result = aggregateChangeFrequency(frequencies);

    expect(result.lastModified).toEqual(new Date('2024-12-01'));
  });
});
