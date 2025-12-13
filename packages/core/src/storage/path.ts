/**
 * Storage Path Utilities
 * Centralized storage path resolution for repository indexes
 */

import { execSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Normalize git remote URL to a consistent format
 * Examples:
 *   git@github.com:owner/repo.git → owner/repo
 *   https://github.com/owner/repo.git → owner/repo
 *   https://github.com/owner/repo → owner/repo
 */
export function normalizeGitRemote(remote: string): string {
  // Handle git@ format first: git@github.com:owner/repo → owner/repo
  if (remote.startsWith('git@')) {
    // Remove git@ prefix
    let normalized = remote.replace(/^git@/, '');
    // Remove .git suffix
    normalized = normalized.replace(/\.git$/, '');
    // Extract owner/repo after colon
    if (normalized.includes(':')) {
      const colonIndex = normalized.indexOf(':');
      normalized = normalized.slice(colonIndex + 1);
    }
    return normalized.toLowerCase();
  }

  // Handle https/http/ssh formats
  let normalized = remote
    .replace(/^https?:\/\//, '')
    .replace(/^ssh:\/\/git@/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

  // Remove domain (github.com, gitlab.com, etc.)
  // Format: domain/owner/repo → owner/repo
  const parts = normalized.split('/');
  if (parts.length >= 2) {
    // Skip domain (first part), take owner/repo
    normalized = parts.slice(1).join('/');
  }

  return normalized.toLowerCase();
}

/**
 * Get git remote URL for a repository
 * @param repositoryPath - Path to the repository
 * @returns Git remote URL or null if not found
 */
export function getGitRemote(repositoryPath: string): string | null {
  try {
    const output = execSync('git remote get-url origin', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: repositoryPath,
    });
    return output.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get storage path for a repository based on git remote or path hash
 * @param repositoryPath - Path to the repository
 * @returns Storage path in ~/.dev-agent/indexes/{hash}/
 */
export async function getStoragePath(repositoryPath: string): Promise<string> {
  const resolvedPath = path.resolve(repositoryPath);
  const homeDir = os.homedir();
  const baseStorageDir = path.join(homeDir, '.dev-agent', 'indexes');

  // Try git remote first (stable across clones)
  const gitRemote = getGitRemote(resolvedPath);
  if (gitRemote) {
    const normalized = normalizeGitRemote(gitRemote);
    const hash = crypto.createHash('md5').update(normalized).digest('hex').slice(0, 8);
    return path.join(baseStorageDir, hash);
  }

  // Fallback: absolute path hash (for non-git repos)
  const pathHash = crypto.createHash('md5').update(resolvedPath).digest('hex').slice(0, 8);
  return path.join(baseStorageDir, pathHash);
}

/**
 * Ensure storage directory exists
 * @param storagePath - Storage path to ensure exists
 */
export async function ensureStorageDirectory(storagePath: string): Promise<void> {
  await fs.mkdir(storagePath, { recursive: true });
}

/**
 * Get paths for storage files within a storage directory
 */
export function getStorageFilePaths(storagePath: string): {
  vectors: string;
  githubState: string;
  metadata: string;
  indexerState: string;
  metrics: string;
} {
  return {
    vectors: path.join(storagePath, 'vectors.lance'),
    githubState: path.join(storagePath, 'github-state.json'),
    metadata: path.join(storagePath, 'metadata.json'),
    indexerState: path.join(storagePath, 'indexer-state.json'),
    metrics: path.join(storagePath, 'metrics.db'),
  };
}
