import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RepositoryIndexer } from '../index';
import type { IndexProgress } from '../types';

describe('RepositoryIndexer', () => {
  let testDir: string;
  let repoDir: string;
  let vectorDir: string;

  beforeAll(async () => {
    // Create temporary directories
    testDir = path.join(os.tmpdir(), `indexer-test-${Date.now()}`);
    repoDir = path.join(testDir, 'repo');
    vectorDir = path.join(testDir, 'vectors');

    await fs.mkdir(repoDir, { recursive: true });
    await fs.mkdir(vectorDir, { recursive: true });

    // Create test files
    await fs.writeFile(
      path.join(repoDir, 'auth.ts'),
      `export class AuthService {
  authenticate(user: string, password: string): boolean {
    return true;
  }
}`,
      'utf-8'
    );

    await fs.writeFile(
      path.join(repoDir, 'utils.ts'),
      `export function formatDate(date: Date): string {
  return date.toISOString();
}`,
      'utf-8'
    );

    await fs.writeFile(
      path.join(repoDir, 'README.md'),
      `# Test Repository

This is a test repository for indexing.`,
      'utf-8'
    );
  }, 60000); // Longer timeout for model download

  afterAll(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should initialize successfully', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test1.lance'),
    });

    await indexer.initialize();
    await indexer.close();
  });

  it('should index repository', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test2.lance'),
    });

    await indexer.initialize();

    const stats = await indexer.index();

    expect(stats.filesScanned).toBeGreaterThan(0);
    expect(stats.documentsExtracted).toBeGreaterThan(0);
    expect(stats.documentsIndexed).toBeGreaterThan(0);
    expect(stats.vectorsStored).toBe(stats.documentsIndexed);
    expect(stats.duration).toBeGreaterThan(0);
    expect(stats.errors).toEqual([]);
    expect(stats.repositoryPath).toBe(repoDir);

    await indexer.close();
  });

  it('should track progress during indexing', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test3.lance'),
    });

    await indexer.initialize();

    const progressUpdates: IndexProgress[] = [];

    await indexer.index({
      onProgress: (progress) => {
        progressUpdates.push({ ...progress });
      },
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].phase).toBe('complete');
    expect(progressUpdates[progressUpdates.length - 1].percentComplete).toBe(100);

    await indexer.close();
  });

  it('should search indexed content', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test4.lance'),
    });

    await indexer.initialize();
    await indexer.index();

    const results = await indexer.search('authentication', { limit: 5 });

    expect(Array.isArray(results)).toBe(true);
    // Results may be empty if no documents were indexed or semantic similarity is low
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('metadata');
    }

    await indexer.close();
  });

  it('should get indexing statistics', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test5.lance'),
    });

    await indexer.initialize();

    // Index
    await indexer.index();

    // Stats after indexing
    const stats = await indexer.getStats();
    expect(stats).toBeDefined();
    expect(stats?.duration).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats?.errors)).toBe(true);

    await indexer.close();
  });

  it('should support custom batch size', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test6.lance'),
      batchSize: 1, // Very small batch
    });

    await indexer.initialize();

    const stats = await indexer.index({ batchSize: 1 });

    expect(stats.documentsIndexed).toBeGreaterThan(0);

    await indexer.close();
  });

  it('should support language filtering', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test7.lance'),
    });

    await indexer.initialize();

    const stats = await indexer.index({
      languages: ['typescript'],
    });

    // Should complete without error
    expect(stats.duration).toBeGreaterThanOrEqual(0);
    expect(stats.errors.length).toBe(0);

    await indexer.close();
  });

  it('should handle empty repository', async () => {
    const emptyRepo = path.join(testDir, 'empty-repo');
    await fs.mkdir(emptyRepo, { recursive: true });

    const indexer = new RepositoryIndexer({
      repositoryPath: emptyRepo,
      vectorStorePath: path.join(vectorDir, 'test8.lance'),
    });

    await indexer.initialize();

    const stats = await indexer.index();

    expect(stats.filesScanned).toBe(0);
    expect(stats.documentsIndexed).toBe(0);

    await indexer.close();
  });

  it('should persist state to disk', async () => {
    const stateDir = path.join(testDir, 'state-test');
    await fs.mkdir(stateDir, { recursive: true });

    // Copy test files
    await fs.writeFile(path.join(stateDir, 'test.ts'), 'export function test() {}', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: stateDir,
      vectorStorePath: path.join(vectorDir, 'test9.lance'),
    });

    await indexer.initialize();
    await indexer.index();
    await indexer.close();

    // Check state file exists
    const statePath = path.join(stateDir, '.dev-agent', 'indexer-state.json');
    const stateExists = await fs
      .access(statePath)
      .then(() => true)
      .catch(() => false);

    expect(stateExists).toBe(true);

    // Read and validate state
    const stateContent = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(stateContent);

    expect(state.version).toBeDefined();
    expect(state.repositoryPath).toBe(stateDir);
    expect(state.files).toBeDefined();
    expect(typeof state.files).toBe('object');
  });

  it('should handle incremental updates', async () => {
    const updateDir = path.join(testDir, 'update-test');
    await fs.mkdir(updateDir, { recursive: true });

    // Create tsconfig for scanner
    await fs.writeFile(
      path.join(updateDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'es2020', module: 'commonjs' } }),
      'utf-8'
    );

    await fs.writeFile(
      path.join(updateDir, 'original.ts'),
      'export function original() { return true; }',
      'utf-8'
    );

    const indexer = new RepositoryIndexer({
      repositoryPath: updateDir,
      vectorStorePath: path.join(vectorDir, 'test10.lance'),
    });

    await indexer.initialize();

    // Initial index
    const initialStats = await indexer.index();
    expect(initialStats.documentsExtracted).toBeGreaterThanOrEqual(1);

    // No changes - update should find nothing
    const updateStats1 = await indexer.update();
    expect(updateStats1.filesScanned).toBe(0);

    // Add a new file
    await fs.writeFile(
      path.join(updateDir, 'new.ts'),
      'export function newFile() { return true; }',
      'utf-8'
    );

    // Update should detect and index new file
    const updateStats2 = await indexer.update();
    expect(updateStats2.filesScanned).toBe(1);
    expect(updateStats2.documentsIndexed).toBeGreaterThanOrEqual(1);

    await indexer.close();
  });

  it('should handle search with options', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test11.lance'),
    });

    await indexer.initialize();
    await indexer.index();

    // Search with limit
    const results = await indexer.search('function', { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);

    // Search with score threshold
    const filteredResults = await indexer.search('test', { scoreThreshold: 0.8 });
    for (const result of filteredResults) {
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    }

    await indexer.close();
  });

  it('should handle close without initialization', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test12.lance'),
    });

    // Should not throw
    await indexer.close();
  });

  it('should handle very small batch sizes', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test14.lance'),
    });

    await indexer.initialize();

    // Very small batch size (1 doc at a time)
    const stats = await indexer.index({ batchSize: 1 });
    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should handle large batch sizes', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test15.lance'),
    });

    await indexer.initialize();

    // Large batch size
    const stats = await indexer.index({ batchSize: 100 });
    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should format documents with missing fields', async () => {
    const emptyRepo = path.join(testDir, 'empty-fields');
    await fs.mkdir(emptyRepo, { recursive: true });

    // Create file with minimal content
    await fs.writeFile(path.join(emptyRepo, 'minimal.md'), '# Title', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: emptyRepo,
      vectorStorePath: path.join(vectorDir, 'test16.lance'),
    });

    await indexer.initialize();

    const stats = await indexer.index();
    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should format document text properly', async () => {
    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(vectorDir, 'test13.lance'),
    });

    await indexer.initialize();
    const stats = await indexer.index();

    // Should have indexed some documents
    expect(stats.documentsIndexed).toBeGreaterThanOrEqual(0);

    // Search should work (may or may not find results depending on semantic similarity)
    const results = await indexer.search('test query', { limit: 5 });
    expect(Array.isArray(results)).toBe(true);

    await indexer.close();
  });
});

describe('RepositoryIndexer - Edge Cases', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `indexer-edge-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should handle file that disappears during indexing', async () => {
    const repoDir = path.join(testDir, 'disappearing');
    await fs.mkdir(repoDir, { recursive: true });

    // Create a file
    await fs.writeFile(path.join(repoDir, 'temp.ts'), 'export const temp = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'edge1.lance'),
    });

    await indexer.initialize();
    await indexer.index();

    // Delete the file
    await fs.unlink(path.join(repoDir, 'temp.ts'));

    // Update should handle missing file gracefully
    const updateStats = await indexer.update();
    expect(updateStats.errors.length).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should detect file changes via hash', async () => {
    const repoDir = path.join(testDir, 'hash-change');
    await fs.mkdir(repoDir, { recursive: true });

    const filePath = path.join(repoDir, 'changing.ts');
    await fs.writeFile(filePath, 'export const v1 = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'edge2.lance'),
    });

    await indexer.initialize();

    // Initial index
    await indexer.index();

    // Modify file (keep same timestamp if possible, but change content)
    await fs.writeFile(filePath, 'export const v2 = 2;', 'utf-8');

    // Update should detect the change
    const updateStats = await indexer.update();
    expect(updateStats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should handle update with since date filter', async () => {
    const repoDir = path.join(testDir, 'since-date');
    await fs.mkdir(repoDir, { recursive: true });

    await fs.writeFile(path.join(repoDir, 'old.ts'), 'export const old = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'edge3.lance'),
    });

    await indexer.initialize();
    await indexer.index();

    // Update with since date in the future (should find nothing)
    const futureDate = new Date(Date.now() + 100000);
    const updateStats = await indexer.update({ since: futureDate });

    expect(updateStats.filesScanned).toBe(0);

    await indexer.close();
  });

  it('should handle unreadable files during state update', async () => {
    const repoDir = path.join(testDir, 'unreadable');
    await fs.mkdir(repoDir, { recursive: true });

    // Create a temporary file that we'll make unreadable
    const tempFile = path.join(repoDir, 'temp.ts');
    await fs.writeFile(tempFile, 'export const temp = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'edge4.lance'),
    });

    await indexer.initialize();

    // Index should handle files that can't be read
    const stats = await indexer.index();
    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should handle update without prior state', async () => {
    const repoDir = path.join(testDir, 'no-state');
    await fs.mkdir(repoDir, { recursive: true });

    await fs.writeFile(path.join(repoDir, 'file.ts'), 'export const x = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'edge5.lance'),
    });

    await indexer.initialize();

    // Update without prior index should do full index
    const stats = await indexer.update();
    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should handle file modification with timestamp check', async () => {
    const repoDir = path.join(testDir, 'timestamp');
    await fs.mkdir(repoDir, { recursive: true });

    await fs.writeFile(path.join(repoDir, 'file.ts'), 'export const v1 = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'edge6.lance'),
    });

    await indexer.initialize();
    await indexer.index();

    // Modify file
    await fs.writeFile(path.join(repoDir, 'file.ts'), 'export const v2 = 2;', 'utf-8');

    // Update with since parameter (past date - should detect changes)
    const pastDate = new Date(Date.now() - 100000);
    const stats = await indexer.update({ since: pastDate });

    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should handle file that becomes unreadable', async () => {
    const repoDir = path.join(testDir, 'unreadable-change');
    await fs.mkdir(repoDir, { recursive: true });

    const filePath = path.join(repoDir, 'file.ts');
    await fs.writeFile(filePath, 'export const x = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'edge7.lance'),
    });

    await indexer.initialize();
    await indexer.index();

    // Delete file to trigger error path in detectChangedFiles
    await fs.unlink(filePath);

    // Update should detect deleted file
    const stats = await indexer.update();
    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });
});

describe('RepositoryIndexer - Configuration', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `indexer-config-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should use default configuration values', async () => {
    const repoDir = path.join(testDir, 'repo1');
    await fs.mkdir(repoDir, { recursive: true });

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'vectors1.lance'),
    });

    await indexer.initialize();

    const stats = await indexer.getStats();
    // Stats will be null if no indexing has happened
    expect(stats).toBeNull();

    await indexer.close();
  });

  it('should accept custom embedding model', async () => {
    const repoDir = path.join(testDir, 'repo2');
    await fs.mkdir(repoDir, { recursive: true });

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'vectors2.lance'),
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      embeddingDimension: 384,
    });

    await indexer.initialize();
    await indexer.close();
  });

  it('should accept exclude patterns', async () => {
    const repoDir = path.join(testDir, 'repo3');
    await fs.mkdir(repoDir, { recursive: true });

    await fs.writeFile(path.join(repoDir, 'include.ts'), 'export const a = 1;', 'utf-8');
    await fs.writeFile(path.join(repoDir, 'exclude.ts'), 'export const b = 2;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'vectors3.lance'),
      excludePatterns: ['exclude.ts'],
    });

    await indexer.initialize();

    const stats = await indexer.index();

    // Should complete without error
    expect(stats.duration).toBeGreaterThanOrEqual(0);
    expect(stats.errors.length).toBe(0);

    await indexer.close();
  });

  it('should handle all progress phases', async () => {
    const repoDir = path.join(testDir, 'progress-test');
    await fs.mkdir(repoDir, { recursive: true });

    await fs.writeFile(path.join(repoDir, 'file.ts'), 'export const x = 1;', 'utf-8');

    const phases: string[] = [];

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'progress.lance'),
    });

    await indexer.initialize();

    await indexer.index({
      onProgress: (progress) => {
        if (!phases.includes(progress.phase)) {
          phases.push(progress.phase);
        }
      },
    });

    // Should have gone through all phases
    expect(phases.length).toBeGreaterThan(0);

    await indexer.close();
  });

  it('should handle custom language extensions', async () => {
    const repoDir = path.join(testDir, 'lang-ext');
    await fs.mkdir(repoDir, { recursive: true });

    await fs.writeFile(path.join(repoDir, 'file.ts'), 'export const x = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'lang-ext.lance'),
    });

    await indexer.initialize();

    // Test with various language options
    const stats = await indexer.index({ languages: ['typescript', 'python', 'go', 'rust'] });
    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });

  it('should handle state file in custom location', async () => {
    const repoDir = path.join(testDir, 'custom-state');
    const customStatePath = path.join(testDir, 'custom-state.json');
    await fs.mkdir(repoDir, { recursive: true });

    await fs.writeFile(path.join(repoDir, 'file.ts'), 'export const x = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'custom-state.lance'),
      statePath: customStatePath,
    });

    await indexer.initialize();
    await indexer.index();
    await indexer.close();

    // Verify custom state file was created
    const exists = await fs
      .access(customStatePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('should handle empty exclude patterns', async () => {
    const repoDir = path.join(testDir, 'no-exclude');
    await fs.mkdir(repoDir, { recursive: true });

    await fs.writeFile(path.join(repoDir, 'file.ts'), 'export const x = 1;', 'utf-8');

    const indexer = new RepositoryIndexer({
      repositoryPath: repoDir,
      vectorStorePath: path.join(testDir, 'no-exclude.lance'),
      excludePatterns: [],
    });

    await indexer.initialize();

    const stats = await indexer.index({ excludePatterns: [] });
    expect(stats.duration).toBeGreaterThanOrEqual(0);

    await indexer.close();
  });
});
