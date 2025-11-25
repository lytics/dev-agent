/**
 * Storage Metadata Management
 * Handles metadata.json creation and updates for repository indexes
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getGitRemote, normalizeGitRemote } from './path';

export interface RepositoryMetadata {
  version: string;
  repository: {
    path: string;
    remote?: string;
    branch?: string;
    lastCommit?: string;
  };
  indexed?: {
    timestamp: string;
    files: number;
    components: number;
    size: number;
  };
  config?: {
    languages?: string[];
    excludePatterns?: string[];
  };
  migrated?: {
    timestamp: string;
    from: string;
  };
}

const METADATA_VERSION = '1.0';

/**
 * Get current git branch
 */
function getGitBranch(repositoryPath: string): string | undefined {
  try {
    const output = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: repositoryPath,
    });
    return output.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get last commit hash
 */
function getLastCommit(repositoryPath: string): string | undefined {
  try {
    const output = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: repositoryPath,
    });
    return output.trim().slice(0, 7) || undefined; // Short hash
  } catch {
    return undefined;
  }
}

/**
 * Load metadata from storage path
 */
export async function loadMetadata(storagePath: string): Promise<RepositoryMetadata | null> {
  const metadataPath = path.join(storagePath, 'metadata.json');
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content) as RepositoryMetadata;
  } catch {
    return null;
  }
}

/**
 * Create or update metadata file
 */
export async function saveMetadata(
  storagePath: string,
  repositoryPath: string,
  updates?: Partial<RepositoryMetadata>
): Promise<RepositoryMetadata> {
  const metadataPath = path.join(storagePath, 'metadata.json');
  const resolvedRepoPath = path.resolve(repositoryPath);

  // Load existing metadata or create new
  const existing = await loadMetadata(storagePath);
  const gitRemote = getGitRemote(resolvedRepoPath);

  const metadata: RepositoryMetadata = {
    version: METADATA_VERSION,
    ...existing,
    ...updates,
    // Merge repository info (don't overwrite with undefined)
    repository: {
      ...existing?.repository,
      path: resolvedRepoPath,
      remote: gitRemote ? normalizeGitRemote(gitRemote) : existing?.repository?.remote,
      branch: getGitBranch(resolvedRepoPath) ?? existing?.repository?.branch,
      lastCommit: getLastCommit(resolvedRepoPath) ?? existing?.repository?.lastCommit,
      ...updates?.repository,
    },
  };

  await fs.mkdir(storagePath, { recursive: true });
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  return metadata;
}

/**
 * Update indexed statistics in metadata
 */
export async function updateIndexedStats(
  storagePath: string,
  stats: {
    files: number;
    components: number;
    size: number;
  }
): Promise<void> {
  const existing = await loadMetadata(storagePath);
  await saveMetadata(storagePath, existing?.repository?.path || '', {
    indexed: {
      timestamp: new Date().toISOString(),
      ...stats,
    },
  });
}
