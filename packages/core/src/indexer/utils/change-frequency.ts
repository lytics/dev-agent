/**
 * Change Frequency Tracker
 *
 * Calculates git commit frequency for files and packages to show
 * which parts of the codebase change most often.
 */

import { execSync } from 'node:child_process';

/**
 * File change frequency data
 */
export interface FileChangeFrequency {
  /** File path relative to repository root */
  filePath: string;

  /** Total commits touching this file */
  commitCount: number;

  /** Last modification timestamp */
  lastModified: Date;

  /** Number of authors who modified this file */
  authorCount: number;
}

/**
 * Author contribution data for a specific file
 */
export interface FileAuthorContribution {
  /** Author email */
  authorEmail: string;

  /** Number of commits by this author */
  commitCount: number;

  /** Last commit timestamp by this author */
  lastCommit: Date | null;
}

/**
 * Options for calculating change frequency
 */
export interface ChangeFrequencyOptions {
  /** Repository path */
  repositoryPath: string;

  /** Only count commits since this date */
  since?: Date;

  /** Maximum number of commits to analyze (default: 1000) */
  maxCommits?: number;
}

/**
 * Calculate change frequency for all tracked files in a repository
 */
export async function calculateChangeFrequency(
  options: ChangeFrequencyOptions
): Promise<Map<string, FileChangeFrequency>> {
  const { repositoryPath, since, maxCommits = 1000 } = options;

  const frequencies = new Map<string, FileChangeFrequency>();

  try {
    // Build git log command
    const args = [
      'log',
      `--max-count=${maxCommits}`,
      '--pretty=format:%H',
      '--name-only',
      '--diff-filter=AMCR', // Added, Modified, Copied, Renamed
    ];

    if (since) {
      args.push(`--since="${since.toISOString()}"`);
    }

    const output = execSync(`git ${args.join(' ')}`, {
      cwd: repositoryPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
    });

    // Parse output to count file occurrences
    const lines = output.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      // Skip commit hashes (40 char hex strings)
      if (/^[0-9a-f]{40}$/.test(line)) {
        continue;
      }

      // This is a file path
      const filePath = line.trim();
      if (!filePath) continue;

      const existing = frequencies.get(filePath);
      if (existing) {
        existing.commitCount++;
      } else {
        // Get additional metadata for this file
        const metadata = await getFileMetadata(repositoryPath, filePath);
        frequencies.set(filePath, {
          filePath,
          commitCount: 1,
          lastModified: metadata.lastModified,
          authorCount: metadata.authorCount,
        });
      }
    }
  } catch (_error) {
    // Git command failed (repo not initialized, etc.)
    // Return empty map
  }

  return frequencies;
}

/**
 * Get metadata for a specific file
 */
async function getFileMetadata(
  repositoryPath: string,
  filePath: string
): Promise<{ lastModified: Date; authorCount: number }> {
  try {
    // Get last modification time
    const dateOutput = execSync(`git log -1 --pretty=format:%ai -- "${filePath}"`, {
      cwd: repositoryPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    // Get unique authors count
    const authorsOutput = execSync(
      `git log --pretty=format:%ae -- "${filePath}" | sort -u | wc -l`,
      {
        cwd: repositoryPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }
    );

    return {
      lastModified: dateOutput ? new Date(dateOutput.trim()) : new Date(),
      authorCount: Number.parseInt(authorsOutput.trim(), 10) || 1,
    };
  } catch (_error) {
    // If git command fails, return defaults
    return {
      lastModified: new Date(),
      authorCount: 1,
    };
  }
}

/**
 * Calculate aggregate stats from file frequencies
 */
export function aggregateChangeFrequency(
  frequencies: Map<string, FileChangeFrequency>,
  filterPath?: string
): {
  totalCommits: number;
  avgCommitsPerFile: number;
  lastModified: Date | null;
} {
  let totalCommits = 0;
  let fileCount = 0;
  let mostRecent: Date | null = null;

  for (const [filePath, frequency] of frequencies) {
    // Apply filter if specified
    if (filterPath && !filePath.startsWith(filterPath)) {
      continue;
    }

    totalCommits += frequency.commitCount;
    fileCount++;

    if (!mostRecent || frequency.lastModified > mostRecent) {
      mostRecent = frequency.lastModified;
    }
  }

  return {
    totalCommits,
    avgCommitsPerFile: fileCount > 0 ? totalCommits / fileCount : 0,
    lastModified: mostRecent,
  };
}

/**
 * Calculate per-file author contributions (batched for performance)
 *
 * Returns a map of file path → array of author contributions.
 * Uses a single batched git call for efficiency.
 *
 * @param options - Change frequency options
 * @returns Map of file paths to author contributions
 */
export async function calculateFileAuthorContributions(
  options: ChangeFrequencyOptions
): Promise<Map<string, FileAuthorContribution[]>> {
  const { repositoryPath } = options;
  const result = new Map<string, FileAuthorContribution[]>();

  try {
    // Single batched git call: get all commits with author, timestamp, and files changed
    // Format: commit-hash|author-email|timestamp|file-path (one per line)
    const output = execSync('git log --all --pretty=format:"%H|%ae|%ai" --name-only --no-merges', {
      cwd: repositoryPath,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large repos
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    // Parse git output to build file → author → {commits, lastCommit} map
    const fileAuthorData = new Map<
      string,
      Map<string, { commitCount: number; lastCommit: Date | null }>
    >();

    const lines = output.split('\n');
    let currentCommit: string | null = null;
    let currentAuthor: string | null = null;
    let currentTimestamp: Date | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if this is a commit line (format: hash|email|timestamp)
      if (trimmed.includes('|')) {
        const parts = trimmed.split('|');
        if (parts.length >= 3) {
          currentCommit = parts[0];
          currentAuthor = parts[1];
          currentTimestamp = new Date(parts.slice(2).join('|'));
          continue;
        }
      }

      // This is a file path
      if (currentCommit && currentAuthor && currentTimestamp) {
        let authorMap = fileAuthorData.get(trimmed);
        if (!authorMap) {
          authorMap = new Map();
          fileAuthorData.set(trimmed, authorMap);
        }

        let authorData = authorMap.get(currentAuthor);
        if (!authorData) {
          authorData = { commitCount: 0, lastCommit: null };
          authorMap.set(currentAuthor, authorData);
        }

        authorData.commitCount++;

        // Track most recent commit by this author
        if (!authorData.lastCommit || currentTimestamp > authorData.lastCommit) {
          authorData.lastCommit = currentTimestamp;
        }
      }
    }

    // Convert to final format
    for (const [filePath, authorMap] of fileAuthorData) {
      const contributions: FileAuthorContribution[] = [];

      for (const [authorEmail, data] of authorMap) {
        contributions.push({
          authorEmail,
          commitCount: data.commitCount,
          lastCommit: data.lastCommit,
        });
      }

      // Sort by commit count (descending)
      contributions.sort((a, b) => b.commitCount - a.commitCount);

      result.set(filePath, contributions);
    }
  } catch (_error) {
    // Git command failed, return empty map
  }

  return result;
}
