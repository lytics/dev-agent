import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureStorageDirectory,
  getGitRemote,
  getStorageFilePaths,
  getStoragePath,
  normalizeGitRemote,
} from '../path';

describe('Storage Path Utilities', () => {
  describe('normalizeGitRemote', () => {
    it('should normalize git@ format', () => {
      expect(normalizeGitRemote('git@github.com:owner/repo.git')).toBe('owner/repo');
      expect(normalizeGitRemote('git@github.com:company/frontend.git')).toBe('company/frontend');
    });

    it('should normalize https format', () => {
      expect(normalizeGitRemote('https://github.com/owner/repo.git')).toBe('owner/repo');
      expect(normalizeGitRemote('https://github.com/owner/repo')).toBe('owner/repo');
    });

    it('should normalize http format', () => {
      expect(normalizeGitRemote('http://github.com/owner/repo.git')).toBe('owner/repo');
    });

    it('should handle URLs without .git suffix', () => {
      expect(normalizeGitRemote('https://github.com/owner/repo')).toBe('owner/repo');
    });

    it('should handle trailing slashes', () => {
      expect(normalizeGitRemote('https://github.com/owner/repo/')).toBe('owner/repo');
    });

    it('should convert to lowercase', () => {
      expect(normalizeGitRemote('https://github.com/Owner/Repo')).toBe('owner/repo');
    });

    it('should handle GitLab format', () => {
      expect(normalizeGitRemote('git@gitlab.com:group/project.git')).toBe('group/project');
    });
  });

  describe('getGitRemote', () => {
    let originalCwd: string;
    let testRepoDir: string;

    beforeEach(async () => {
      originalCwd = process.cwd();
      testRepoDir = path.join(os.tmpdir(), `git-test-${Date.now()}`);
      await fs.mkdir(testRepoDir, { recursive: true });
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      try {
        await fs.rm(testRepoDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should return git remote for git repository', async () => {
      // Create a git repo
      process.chdir(testRepoDir);
      execSync('git init', { stdio: 'pipe' });
      execSync('git remote add origin https://github.com/test/repo.git', { stdio: 'pipe' });

      const remote = getGitRemote(testRepoDir);
      // Git may return the URL as-is or transform it, so just check it contains the repo info
      expect(remote).toBeTruthy();
      expect(remote).toContain('test/repo');
    });

    it('should return null for non-git directory', () => {
      const remote = getGitRemote(os.tmpdir());
      expect(remote).toBeNull();
    });

    it('should return null for non-existent directory', () => {
      const remote = getGitRemote('/nonexistent/path/12345');
      expect(remote).toBeNull();
    });
  });

  describe('getStoragePath', () => {
    let testRepoDir: string;
    let originalCwd: string;

    beforeEach(async () => {
      originalCwd = process.cwd();
      testRepoDir = path.join(os.tmpdir(), `storage-test-${Date.now()}`);
      await fs.mkdir(testRepoDir, { recursive: true });
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      try {
        await fs.rm(testRepoDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should use git remote hash when git repo exists', async () => {
      // Create git repo with remote
      process.chdir(testRepoDir);
      execSync('git init', { stdio: 'pipe' });
      execSync('git remote add origin https://github.com/test/repo.git', { stdio: 'pipe' });

      const storagePath = await getStoragePath(testRepoDir);
      const homeDir = os.homedir();
      const expectedPath = path.join(homeDir, '.dev-agent', 'indexes');

      expect(storagePath).toContain(expectedPath);
      expect(storagePath).toMatch(/[a-f0-9]{8}$/); // Ends with 8-char hex hash
    });

    it('should use path hash for non-git directory', async () => {
      const storagePath = await getStoragePath(testRepoDir);
      const homeDir = os.homedir();
      const expectedPath = path.join(homeDir, '.dev-agent', 'indexes');

      expect(storagePath).toContain(expectedPath);
      expect(storagePath).toMatch(/[a-f0-9]{8}$/); // Ends with 8-char hex hash
    });

    it('should return consistent path for same repository', async () => {
      const path1 = await getStoragePath(testRepoDir);
      const path2 = await getStoragePath(testRepoDir);
      expect(path1).toBe(path2);
    });

    it('should resolve relative paths', async () => {
      const relativePath = path.relative(process.cwd(), testRepoDir);
      const storagePath1 = await getStoragePath(testRepoDir);
      const storagePath2 = await getStoragePath(relativePath);
      expect(storagePath1).toBe(storagePath2);
    });
  });

  describe('ensureStorageDirectory', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = path.join(os.tmpdir(), `ensure-test-${Date.now()}`);
    });

    afterEach(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create directory if it does not exist', async () => {
      await ensureStorageDirectory(testDir);
      const exists = await fs
        .access(testDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await fs.mkdir(testDir, { recursive: true });
      await expect(ensureStorageDirectory(testDir)).resolves.not.toThrow();
    });

    it('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'nested', 'deep');
      await ensureStorageDirectory(nestedDir);
      const exists = await fs
        .access(nestedDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('getStorageFilePaths', () => {
    it('should return correct file paths', () => {
      const storagePath = '/test/storage';
      const paths = getStorageFilePaths(storagePath);

      expect(paths.vectors).toBe(path.join(storagePath, 'vectors.lance'));
      expect(paths.githubState).toBe(path.join(storagePath, 'github-state.json'));
      expect(paths.metadata).toBe(path.join(storagePath, 'metadata.json'));
      expect(paths.indexerState).toBe(path.join(storagePath, 'indexer-state.json'));
    });

    it('should handle paths with trailing slashes', () => {
      const storagePath = '/test/storage/';
      const paths = getStorageFilePaths(storagePath);

      expect(paths.vectors).toContain('vectors.lance');
      expect(paths.githubState).toContain('github-state.json');
    });
  });
});
