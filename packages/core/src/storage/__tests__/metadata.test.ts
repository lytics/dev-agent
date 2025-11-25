import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadMetadata,
  type RepositoryMetadata,
  saveMetadata,
  updateIndexedStats,
} from '../metadata';

describe('Storage Metadata', () => {
  let testStorageDir: string;
  let testRepoDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testStorageDir = path.join(os.tmpdir(), `metadata-test-${Date.now()}`);
    testRepoDir = path.join(os.tmpdir(), `repo-test-${Date.now()}`);
    await fs.mkdir(testStorageDir, { recursive: true });
    await fs.mkdir(testRepoDir, { recursive: true });

    // Create a git repo for testing
    process.chdir(testRepoDir);
    execSync('git init', { stdio: 'pipe' });
    execSync('git remote add origin https://github.com/test/repo.git', { stdio: 'pipe' });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
      await fs.rm(testRepoDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('saveMetadata', () => {
    it('should create metadata file', async () => {
      await saveMetadata(testStorageDir, testRepoDir);
      const metadataPath = path.join(testStorageDir, 'metadata.json');

      const exists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(metadataPath, 'utf-8');
      const parsed = JSON.parse(content) as RepositoryMetadata;

      expect(parsed.version).toBe('1.0');
      expect(parsed.repository.path).toBe(path.resolve(testRepoDir));
      expect(parsed.repository.remote).toBe('test/repo');
    });

    it('should update existing metadata', async () => {
      // Create initial metadata
      await saveMetadata(testStorageDir, testRepoDir, {
        indexed: {
          timestamp: '2025-01-01T00:00:00Z',
          files: 10,
          components: 20,
          size: 1000,
        },
      });

      // Update with new data
      await saveMetadata(testStorageDir, testRepoDir, {
        indexed: {
          timestamp: '2025-01-02T00:00:00Z',
          files: 15,
          components: 25,
          size: 2000,
        },
      });

      const metadata = await loadMetadata(testStorageDir);
      expect(metadata).not.toBeNull();
      expect(metadata?.indexed?.files).toBe(15);
      expect(metadata?.indexed?.components).toBe(25);
    });

    it('should preserve existing metadata when updating', async () => {
      // Create initial metadata with config
      await saveMetadata(testStorageDir, testRepoDir, {
        config: {
          languages: ['typescript', 'javascript'],
          excludePatterns: ['**/node_modules/**'],
        },
      });

      // Update with indexed stats
      await saveMetadata(testStorageDir, testRepoDir, {
        indexed: {
          timestamp: new Date().toISOString(),
          files: 10,
          components: 20,
          size: 1000,
        },
      });

      const metadata = await loadMetadata(testStorageDir);
      expect(metadata?.config?.languages).toEqual(['typescript', 'javascript']);
      expect(metadata?.indexed?.files).toBe(10);
    });
  });

  describe('loadMetadata', () => {
    it('should return null if metadata file does not exist', async () => {
      const metadata = await loadMetadata(testStorageDir);
      expect(metadata).toBeNull();
    });

    it('should load existing metadata', async () => {
      const testMetadata: RepositoryMetadata = {
        version: '1.0',
        repository: {
          path: testRepoDir,
          remote: 'test/repo',
          branch: 'main',
        },
        indexed: {
          timestamp: '2025-01-01T00:00:00Z',
          files: 10,
          components: 20,
          size: 1000,
        },
      };

      const metadataPath = path.join(testStorageDir, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(testMetadata, null, 2), 'utf-8');

      const loaded = await loadMetadata(testStorageDir);
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe('1.0');
      expect(loaded?.repository.remote).toBe('test/repo');
      expect(loaded?.indexed?.files).toBe(10);
    });

    it('should handle invalid JSON gracefully', async () => {
      const metadataPath = path.join(testStorageDir, 'metadata.json');
      await fs.writeFile(metadataPath, 'invalid json', 'utf-8');

      const loaded = await loadMetadata(testStorageDir);
      expect(loaded).toBeNull();
    });
  });

  describe('updateIndexedStats', () => {
    it('should update indexed stats in metadata', async () => {
      // Create initial metadata
      await saveMetadata(testStorageDir, testRepoDir);

      // Update stats
      await updateIndexedStats(testStorageDir, {
        files: 100,
        components: 500,
        size: 5000000,
      });

      const metadata = await loadMetadata(testStorageDir);
      expect(metadata?.indexed).not.toBeUndefined();
      expect(metadata?.indexed?.files).toBe(100);
      expect(metadata?.indexed?.components).toBe(500);
      expect(metadata?.indexed?.size).toBe(5000000);
      expect(metadata?.indexed?.timestamp).toBeDefined();
    });

    it('should create metadata if it does not exist', async () => {
      await updateIndexedStats(testStorageDir, {
        files: 50,
        components: 200,
        size: 1000000,
      });

      const metadata = await loadMetadata(testStorageDir);
      expect(metadata).not.toBeNull();
      expect(metadata?.indexed?.files).toBe(50);
    });

    it('should preserve other metadata fields', async () => {
      // Create metadata with config
      await saveMetadata(testStorageDir, testRepoDir, {
        config: {
          languages: ['typescript'],
        },
      });

      // Update stats
      await updateIndexedStats(testStorageDir, {
        files: 75,
        components: 300,
        size: 2000000,
      });

      const metadata = await loadMetadata(testStorageDir);
      expect(metadata?.config?.languages).toEqual(['typescript']);
      expect(metadata?.indexed?.files).toBe(75);
    });
  });
});
