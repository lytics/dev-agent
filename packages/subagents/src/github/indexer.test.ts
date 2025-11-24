/**
 * Tests for GitHub indexer persistence and auto-update
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { VectorStorage } from '@lytics/dev-agent-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubIndexer } from './indexer';
import type { GitHubDocument, GitHubIndexStats } from './types';
import * as utils from './utils/index';

// Mock the utilities
vi.mock('./utils/index', () => ({
  fetchAllDocuments: vi.fn(),
  enrichDocument: vi.fn((doc: GitHubDocument) => doc),
  getCurrentRepository: vi.fn(() => 'lytics/dev-agent'),
  calculateRelevance: vi.fn(() => 0.8),
  matchesQuery: vi.fn(() => true),
}));

// Mock VectorStorage
vi.mock('@lytics/dev-agent-core', () => ({
  VectorStorage: class MockVectorStorage {
    initialize = vi.fn().mockResolvedValue(undefined);
    addDocuments = vi.fn().mockResolvedValue(undefined);
    search = vi.fn().mockResolvedValue([]);
    close = vi.fn().mockResolvedValue(undefined);

    constructor(config: any) {
      // Store config if needed
    }
  },
}));

describe('GitHubIndexer - Persistence', () => {
  const testVectorPath = '.test-vectors/github';
  const testStatePath = '.test-state/github-state.json';
  let indexer: GitHubIndexer;

  const mockDocuments: GitHubDocument[] = [
    {
      type: 'issue',
      number: 1,
      title: 'Test Issue',
      body: 'Test body',
      state: 'open',
      author: 'testuser',
      labels: ['bug'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      url: 'https://github.com/lytics/dev-agent/issues/1',
      relatedIssues: [],
      relatedPRs: [],
      linkedFiles: [],
      mentions: [],
    },
    {
      type: 'pull_request',
      number: 2,
      title: 'Test PR',
      body: 'Test PR body',
      state: 'merged',
      author: 'testuser',
      labels: ['feature'],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      url: 'https://github.com/lytics/dev-agent/pull/2',
      relatedIssues: [1],
      relatedPRs: [],
      linkedFiles: ['src/test.ts'],
      mentions: [],
    },
  ];

  beforeEach(async () => {
    // Create indexer
    indexer = new GitHubIndexer({
      vectorStorePath: testVectorPath,
      statePath: testStatePath,
      autoUpdate: false, // Disable auto-update for tests
      staleThreshold: 1000, // 1 second
    });

    // Mock fetchAllDocuments to return test data
    vi.mocked(utils.fetchAllDocuments).mockReturnValue(mockDocuments);

    await indexer.initialize();
  });

  afterEach(async () => {
    if (indexer) {
      try {
        await indexer.close();
      } catch {
        // Ignore close errors
      }
    }

    // Clean up test files
    try {
      await fs.rm(path.dirname(testStatePath), { recursive: true, force: true });
      await fs.rm(testVectorPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    vi.clearAllMocks();
  });

  describe('State Persistence', () => {
    it('should save state file after indexing', async () => {
      const stats = await indexer.index();

      expect(stats.totalDocuments).toBe(2);
      expect(stats.byType.issue).toBe(1);
      expect(stats.byType.pull_request).toBe(1);

      // Verify state file was created
      const stateContent = await fs.readFile(testStatePath, 'utf-8');
      const state = JSON.parse(stateContent);

      expect(state.version).toBe('1.0.0');
      expect(state.repository).toBe('lytics/dev-agent');
      expect(state.totalDocuments).toBe(2);
      expect(state.lastIndexed).toBeDefined();
    });

    it('should load state on initialization', async () => {
      // First indexing
      await indexer.index();

      // Close and re-create indexer
      await indexer.close();

      const newIndexer = new GitHubIndexer({
        vectorStorePath: testVectorPath,
        statePath: testStatePath,
        autoUpdate: false,
      });

      await newIndexer.initialize();

      // Stats should be loaded from state
      const stats = newIndexer.getStats();
      expect(stats).not.toBeNull();
      expect(stats?.totalDocuments).toBe(2);

      await newIndexer.close();
    });

    it('should indicate indexed status', async () => {
      expect(indexer.isIndexed()).toBe(false);

      await indexer.index();

      expect(indexer.isIndexed()).toBe(true);
    });
  });

  describe('Vector Storage Integration', () => {
    it('should add documents to vector storage', async () => {
      const vectorStorage = (indexer as any).vectorStorage as VectorStorage;

      await indexer.index();

      expect(vectorStorage.addDocuments).toHaveBeenCalledTimes(1);
      expect(vectorStorage.addDocuments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'issue-1',
            text: expect.stringContaining('Test Issue'),
            metadata: expect.objectContaining({
              type: 'issue',
              number: 1,
              title: 'Test Issue',
            }),
          }),
          expect.objectContaining({
            id: 'pull_request-2',
            text: expect.stringContaining('Test PR'),
            metadata: expect.objectContaining({
              type: 'pull_request',
              number: 2,
            }),
          }),
        ])
      );
    });

    it('should use vector search for queries', async () => {
      const vectorStorage = (indexer as any).vectorStorage as VectorStorage;

      // Mock vector search results
      vi.mocked(vectorStorage.search).mockResolvedValue([
        {
          id: 'issue-1',
          score: 0.9,
          metadata: {
            document: JSON.stringify(mockDocuments[0]),
          },
        },
      ]);

      await indexer.index();

      const results = await indexer.search('test query');

      expect(vectorStorage.search).toHaveBeenCalledWith('test query', {
        limit: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0].document.number).toBe(1);
      expect(results[0].score).toBe(0.9);
    });
  });

  describe('Auto-Update', () => {
    it('should detect stale data', async () => {
      await indexer.index();

      const isStale = (indexer as any).isStale();
      expect(isStale).toBe(false);

      // Wait for data to become stale
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const isStaleAfter = (indexer as any).isStale();
      expect(isStaleAfter).toBe(true);
    });

    it('should trigger background update on stale search', async () => {
      // Create indexer with auto-update enabled
      const autoIndexer = new GitHubIndexer({
        vectorStorePath: testVectorPath + '-auto',
        statePath: testStatePath.replace('.json', '-auto.json'),
        autoUpdate: true,
        staleThreshold: 100, // 100ms
      });

      await autoIndexer.initialize();
      await autoIndexer.index();

      // Wait for data to become stale
      await new Promise((resolve) => setTimeout(resolve, 150));

      const indexSpy = vi.spyOn(autoIndexer, 'index');

      // Mock vector search
      const vectorStorage = (autoIndexer as any).vectorStorage as VectorStorage;
      vi.mocked(vectorStorage.search).mockResolvedValue([]);

      // Search should trigger background update
      await autoIndexer.search('test');

      // Give background update time to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(indexSpy).toHaveBeenCalled();

      await autoIndexer.close();
    });
  });

  describe('Statistics', () => {
    it('should return null stats when not indexed', () => {
      const stats = indexer.getStats();
      expect(stats).toBeNull();
    });

    it('should return accurate stats after indexing', async () => {
      const indexStats = await indexer.index();

      const stats = indexer.getStats();
      expect(stats).not.toBeNull();
      expect(stats?.repository).toBe('lytics/dev-agent');
      expect(stats?.totalDocuments).toBe(2);
      expect(stats?.byType).toEqual({
        issue: 1,
        pull_request: 1,
      });
      expect(stats?.byState).toEqual({
        open: 1,
        merged: 1,
      });
    });
  });
});
