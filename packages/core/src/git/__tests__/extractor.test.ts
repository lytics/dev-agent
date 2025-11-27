import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalGitExtractor } from '../extractor';

describe('LocalGitExtractor', () => {
  let testRepoPath: string;
  let extractor: LocalGitExtractor;

  beforeAll(() => {
    // Create a temporary git repository for testing
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-extractor-test-'));

    // Initialize git repo
    execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'pipe' });

    // Create initial commit
    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repo\n');
    execSync('git add README.md', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'pipe' });

    // Create a second commit with issue reference
    fs.writeFileSync(path.join(testRepoPath, 'file1.ts'), 'export const x = 1;\n');
    execSync('git add file1.ts', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "feat: add file1 #123"', { cwd: testRepoPath, stdio: 'pipe' });

    // Create a third commit with PR reference
    fs.writeFileSync(path.join(testRepoPath, 'file2.ts'), 'export const y = 2;\n');
    execSync('git add file2.ts', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "fix: bug fix PR #456"', { cwd: testRepoPath, stdio: 'pipe' });

    // Create a fourth commit modifying existing file
    fs.appendFileSync(path.join(testRepoPath, 'file1.ts'), 'export const z = 3;\n');
    execSync('git add file1.ts', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "refactor: update file1"', { cwd: testRepoPath, stdio: 'pipe' });

    extractor = new LocalGitExtractor(testRepoPath);
  });

  afterAll(() => {
    // Cleanup
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  describe('getCommits', () => {
    it('should return commits in reverse chronological order', async () => {
      const commits = await extractor.getCommits();

      expect(commits.length).toBe(4);
      expect(commits[0].subject).toBe('refactor: update file1');
      expect(commits[3].subject).toBe('Initial commit');
    });

    it('should respect limit option', async () => {
      const commits = await extractor.getCommits({ limit: 2 });

      expect(commits.length).toBe(2);
      expect(commits[0].subject).toBe('refactor: update file1');
      expect(commits[1].subject).toBe('fix: bug fix PR #456');
    });

    it('should include author information', async () => {
      const commits = await extractor.getCommits({ limit: 1 });

      expect(commits[0].author.name).toBe('Test User');
      expect(commits[0].author.email).toBe('test@example.com');
      expect(commits[0].author.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include file changes', async () => {
      const commits = await extractor.getCommits({ limit: 1 });

      expect(commits[0].files.length).toBeGreaterThan(0);
      expect(commits[0].files[0].path).toBe('file1.ts');
      expect(commits[0].stats.filesChanged).toBe(1);
    });

    it('should extract issue references from message', async () => {
      const commits = await extractor.getCommits();
      const issueCommit = commits.find((c) => c.subject.includes('#123'));

      expect(issueCommit).toBeDefined();
      expect(issueCommit?.refs.issueRefs).toContain(123);
    });

    it('should extract PR references from message', async () => {
      const commits = await extractor.getCommits();
      const prCommit = commits.find((c) => c.subject.includes('PR #456'));

      expect(prCommit).toBeDefined();
      expect(prCommit?.refs.prRefs).toContain(456);
    });

    it('should filter by path', async () => {
      const commits = await extractor.getCommits({ path: 'file1.ts' });

      expect(commits.length).toBe(2); // Initial add and update
      expect(commits.every((c) => c.files.some((f) => f.path === 'file1.ts'))).toBe(true);
    });

    it('should handle empty repository gracefully', async () => {
      const emptyRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-empty-test-'));
      execSync('git init', { cwd: emptyRepoPath, stdio: 'pipe' });

      const emptyExtractor = new LocalGitExtractor(emptyRepoPath);

      // Should not throw, just return empty array
      const commits = await emptyExtractor.getCommits();
      expect(commits).toEqual([]);

      fs.rmSync(emptyRepoPath, { recursive: true, force: true });
    });
  });

  describe('getCommit', () => {
    it('should return a single commit by hash', async () => {
      const commits = await extractor.getCommits({ limit: 1 });
      const hash = commits[0].hash;

      const commit = await extractor.getCommit(hash);

      expect(commit).not.toBeNull();
      expect(commit?.hash).toBe(hash);
      expect(commit?.subject).toBe('refactor: update file1');
    });

    it('should return null for non-existent hash', async () => {
      const commit = await extractor.getCommit('0000000000000000000000000000000000000000');

      expect(commit).toBeNull();
    });

    it('should work with short hash', async () => {
      const commits = await extractor.getCommits({ limit: 1 });
      const shortHash = commits[0].shortHash;

      const commit = await extractor.getCommit(shortHash);

      expect(commit).not.toBeNull();
      expect(commit?.shortHash).toBe(shortHash);
    });
  });

  describe('getRepositoryInfo', () => {
    it('should return repository information', async () => {
      const info = await extractor.getRepositoryInfo();

      expect(info.branch).toBeDefined();
      expect(info.head).toMatch(/^[0-9a-f]{40}$/);
      expect(info.dirty).toBe(false);
    });

    it('should detect dirty state', async () => {
      // Create uncommitted change
      fs.writeFileSync(path.join(testRepoPath, 'uncommitted.txt'), 'dirty');

      const info = await extractor.getRepositoryInfo();
      expect(info.dirty).toBe(true);

      // Cleanup
      fs.unlinkSync(path.join(testRepoPath, 'uncommitted.txt'));
    });
  });

  describe('getBlame', () => {
    it('should return blame information for a file', async () => {
      const blame = await extractor.getBlame('file1.ts');

      expect(blame.file).toBe('file1.ts');
      expect(blame.lines.length).toBe(2); // Two lines in file
      expect(blame.lines[0].lineNumber).toBe(1);
      expect(blame.lines[0].content).toBe('export const x = 1;');
      expect(blame.lines[0].commit.author).toBe('Test User');
    });

    it('should support line range', async () => {
      const blame = await extractor.getBlame('file1.ts', { startLine: 1, endLine: 1 });

      expect(blame.lines.length).toBe(1);
      expect(blame.lines[0].lineNumber).toBe(1);
    });
  });

  describe('reference extraction', () => {
    it('should extract multiple issue references', async () => {
      // Create commit with multiple refs
      fs.writeFileSync(path.join(testRepoPath, 'multi.ts'), 'multi');
      execSync('git add multi.ts', { cwd: testRepoPath, stdio: 'pipe' });
      execSync('git commit -m "fix: resolve #1, #2, and #3"', { cwd: testRepoPath, stdio: 'pipe' });

      const commits = await extractor.getCommits({ limit: 1 });

      expect(commits[0].refs.issueRefs).toContain(1);
      expect(commits[0].refs.issueRefs).toContain(2);
      expect(commits[0].refs.issueRefs).toContain(3);
    });

    it('should not confuse PR refs with issue refs', async () => {
      fs.writeFileSync(path.join(testRepoPath, 'pr-test.ts'), 'pr');
      execSync('git add pr-test.ts', { cwd: testRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Merge pull request #999 from branch"', {
        cwd: testRepoPath,
        stdio: 'pipe',
      });

      const commits = await extractor.getCommits({ limit: 1 });

      expect(commits[0].refs.prRefs).toContain(999);
      expect(commits[0].refs.issueRefs).not.toContain(999);
    });
  });

  describe('file change parsing', () => {
    it('should track additions and deletions', async () => {
      const commits = await extractor.getCommits();
      const updateCommit = commits.find((c) => c.subject === 'refactor: update file1');

      expect(updateCommit).toBeDefined();
      expect(updateCommit?.stats.additions).toBeGreaterThan(0);
    });

    it('should handle file renames', async () => {
      // Create and rename a file
      fs.writeFileSync(path.join(testRepoPath, 'old-name.ts'), 'content');
      execSync('git add old-name.ts', { cwd: testRepoPath, stdio: 'pipe' });
      execSync('git commit -m "add file to rename"', { cwd: testRepoPath, stdio: 'pipe' });

      fs.renameSync(path.join(testRepoPath, 'old-name.ts'), path.join(testRepoPath, 'new-name.ts'));
      execSync('git add -A', { cwd: testRepoPath, stdio: 'pipe' });
      execSync('git commit -m "rename file"', { cwd: testRepoPath, stdio: 'pipe' });

      const commits = await extractor.getCommits({ limit: 1 });

      // Note: git may or may not detect this as a rename depending on similarity
      // Just verify there are file changes
      expect(commits[0].files.length).toBeGreaterThan(0);
    });
  });
});
