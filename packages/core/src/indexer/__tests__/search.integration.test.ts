/**
 * Integration tests for search functionality
 * Tests against the dev-agent repository's indexed data
 *
 * These tests are skipped in CI by default (require pre-indexed data).
 * Set RUN_INTEGRATION=true to run them in CI.
 *
 * To run locally: `dev index .` first, then run tests.
 */

import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RepositoryIndexer } from '../index';

const shouldSkip = process.env.CI === 'true' && !process.env.RUN_INTEGRATION;

describe.skipIf(shouldSkip)('RepositoryIndexer Search Integration', () => {
  let indexer: RepositoryIndexer;
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const vectorPath = path.join(repoRoot, '.dev-agent/vectors.lance');

  beforeAll(async () => {
    indexer = new RepositoryIndexer({
      repositoryPath: repoRoot,
      vectorStorePath: vectorPath,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    });
    await indexer.initialize();
  });

  afterAll(async () => {
    await indexer.close();
  });

  describe('Statistics', () => {
    it('should return stats from existing index', async () => {
      const stats = await indexer.getStats();

      expect(stats).not.toBeNull();
      expect(stats?.vectorsStored).toBeGreaterThan(0);
      expect(stats?.filesScanned).toBeGreaterThan(0);
      expect(stats?.documentsExtracted).toBeGreaterThan(0);
    });
  });

  describe('Semantic Search', () => {
    it('should find results with low threshold', async () => {
      const results = await indexer.search('coordinator', {
        limit: 5,
        scoreThreshold: 0.0,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      // Verify result structure
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('score');
      expect(firstResult).toHaveProperty('metadata');
      expect(typeof firstResult.score).toBe('number');
      expect(firstResult.score).toBeGreaterThan(0);
      expect(firstResult.score).toBeLessThanOrEqual(1);
    });

    it('should respect score threshold', async () => {
      const lowThresholdResults = await indexer.search('coordinator', {
        limit: 10,
        scoreThreshold: 0.0,
      });

      const highThresholdResults = await indexer.search('coordinator', {
        limit: 10,
        scoreThreshold: 0.4,
      });

      // Higher threshold should return fewer or equal results
      expect(highThresholdResults.length).toBeLessThanOrEqual(lowThresholdResults.length);

      // All high threshold results should meet the score requirement
      for (const result of highThresholdResults) {
        expect(result.score).toBeGreaterThanOrEqual(0.4);
      }
    });

    it('should respect limit parameter', async () => {
      const limit = 3;
      const results = await indexer.search('coordinator', {
        limit,
        scoreThreshold: 0.0,
      });

      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('should return results sorted by score (descending)', async () => {
      const results = await indexer.search('coordinator', {
        limit: 5,
        scoreThreshold: 0.0,
      });

      expect(results.length).toBeGreaterThan(1);

      // Check that scores are in descending order
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should include metadata in results', async () => {
      const results = await indexer.search('coordinator', {
        limit: 1,
        scoreThreshold: 0.0,
      });

      expect(results.length).toBeGreaterThan(0);

      const metadata = results[0].metadata;
      expect(metadata).toHaveProperty('path');
      expect(metadata).toHaveProperty('type');
      expect(metadata).toHaveProperty('language');
      expect(typeof metadata.path).toBe('string');
      expect(typeof metadata.type).toBe('string');
    });

    it('should find semantically similar code for related terms', async () => {
      const coordinatorResults = await indexer.search('coordinator', {
        limit: 5,
        scoreThreshold: 0.3,
      });

      // Should find results for a term that exists in the codebase
      // This tests that embeddings capture semantic meaning
      expect(coordinatorResults.length).toBeGreaterThan(0);
    });

    it('should handle queries with no results gracefully', async () => {
      const results = await indexer.search('xyzabc123nonexistent', {
        limit: 5,
        scoreThreshold: 0.9, // Very high threshold
      });

      // Should return empty array, not throw
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle different query lengths', async () => {
      // Short query
      const shortResults = await indexer.search('test', {
        limit: 3,
        scoreThreshold: 0.3,
      });

      // Long query
      const longResults = await indexer.search(
        'how does the subagent coordinator manage task execution and message routing',
        {
          limit: 3,
          scoreThreshold: 0.3,
        }
      );

      // Both should work without errors
      expect(Array.isArray(shortResults)).toBe(true);
      expect(Array.isArray(longResults)).toBe(true);
    });
  });

  describe('Score Calculation', () => {
    it('should return scores in valid range (0-1)', async () => {
      const results = await indexer.search('coordinator', {
        limit: 10,
        scoreThreshold: 0.0,
      });

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });

    it('should give higher scores to better matches', async () => {
      // Search for a term that should have exact matches in the codebase
      const results = await indexer.search('RepositoryIndexer', {
        limit: 5,
        scoreThreshold: 0.0,
      });

      expect(results.length).toBeGreaterThan(0);

      // The top result should have a reasonably high score for an exact term match
      expect(results[0].score).toBeGreaterThan(0.3);
    });
  });
});
