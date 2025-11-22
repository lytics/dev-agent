import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VectorStorage } from './index';
import type { EmbeddingDocument } from './types';

describe('Vector Storage', () => {
  let vectorStorage: VectorStorage;
  let testDir: string;

  beforeAll(async () => {
    // Create temporary directory for tests
    testDir = path.join(os.tmpdir(), `vector-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    vectorStorage = new VectorStorage({
      storePath: path.join(testDir, 'test.lance'),
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      dimension: 384,
    });

    // Initialize (downloads model on first run)
    await vectorStorage.initialize();
  }, 60000); // Longer timeout for model download

  afterAll(async () => {
    await vectorStorage.close();
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should initialize successfully', async () => {
    const stats = await vectorStorage.getStats();
    expect(stats.modelName).toBe('Xenova/all-MiniLM-L6-v2');
    expect(stats.dimension).toBe(384);
    expect(stats.totalDocuments).toBe(0);
  });

  it('should add documents and generate embeddings', async () => {
    const documents: EmbeddingDocument[] = [
      {
        id: 'doc1',
        text: 'TypeScript is a typed superset of JavaScript',
        metadata: { type: 'definition', language: 'typescript' },
      },
      {
        id: 'doc2',
        text: 'JavaScript is a dynamic programming language',
        metadata: { type: 'definition', language: 'javascript' },
      },
      {
        id: 'doc3',
        text: 'Python is a high-level programming language',
        metadata: { type: 'definition', language: 'python' },
      },
    ];

    await vectorStorage.addDocuments(documents);

    const stats = await vectorStorage.getStats();
    expect(stats.totalDocuments).toBe(3);
  });

  it('should search for similar documents', async () => {
    const query = 'What is TypeScript?';
    const results = await vectorStorage.search(query, { limit: 2 });

    expect(results.length).toBeLessThanOrEqual(2);
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('metadata');

    // TypeScript document should be most similar
    expect(results[0].id).toBe('doc1');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('should respect score threshold', async () => {
    const query = 'What is Rust?'; // Not in our documents
    const results = await vectorStorage.search(query, {
      limit: 10,
      scoreThreshold: 0.8, // High threshold
    });

    // Should return fewer or no results due to high threshold
    expect(results.length).toBeLessThanOrEqual(3);
    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('should retrieve document by ID', async () => {
    const doc = await vectorStorage.getDocument('doc2');

    expect(doc).toBeDefined();
    expect(doc?.id).toBe('doc2');
    expect(doc?.text).toContain('JavaScript');
    expect(doc?.metadata.language).toBe('javascript');
  });

  it('should return null for non-existent document', async () => {
    const doc = await vectorStorage.getDocument('nonexistent');
    expect(doc).toBeNull();
  });

  it('should handle empty search results', async () => {
    // Create a new empty store
    const emptyDir = path.join(testDir, 'empty');
    await fs.mkdir(emptyDir, { recursive: true });

    const emptyStorage = new VectorStorage({
      storePath: path.join(emptyDir, 'empty.lance'),
    });

    await emptyStorage.initialize();

    const results = await emptyStorage.search('test query');
    expect(results).toEqual([]);

    await emptyStorage.close();
  });

  it('should handle batch embedding efficiently', async () => {
    const largeBatch: EmbeddingDocument[] = Array.from({ length: 50 }, (_, i) => ({
      id: `batch-${i}`,
      text: `This is document number ${i} about programming languages`,
      metadata: { index: i },
    }));

    const startTime = Date.now();
    await vectorStorage.addDocuments(largeBatch);
    const duration = Date.now() - startTime;

    // Should complete in reasonable time (batching should help)
    expect(duration).toBeLessThan(30000); // 30 seconds

    const stats = await vectorStorage.getStats();
    expect(stats.totalDocuments).toBeGreaterThanOrEqual(50);
  });

  it('should throw error on delete (not yet implemented)', async () => {
    // Delete is not yet implemented
    await expect(vectorStorage.deleteDocuments(['any-id'])).rejects.toThrow('not yet implemented');
  });

  it('should handle empty document array', async () => {
    // Should not throw
    await vectorStorage.addDocuments([]);

    const stats = await vectorStorage.getStats();
    expect(stats.totalDocuments).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty delete array', async () => {
    // Should not throw
    await vectorStorage.deleteDocuments([]);
  });

  it('should get embedder stats', async () => {
    const stats = await vectorStorage.getStats();
    expect(stats.modelName).toBe('Xenova/all-MiniLM-L6-v2');
    expect(stats.dimension).toBe(384);
    expect(stats.totalDocuments).toBeGreaterThan(0);
  });

  it('should handle search with default options', async () => {
    const results = await vectorStorage.search('programming language');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle search with empty query', async () => {
    const results = await vectorStorage.search('');
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle multiple initializations gracefully', async () => {
    // Should not throw or re-initialize
    await vectorStorage.initialize();
    await vectorStorage.initialize();

    const stats = await vectorStorage.getStats();
    expect(stats.modelName).toBe('Xenova/all-MiniLM-L6-v2');
  });
});

describe('Vector Storage - Low-level Components', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `vector-component-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should use default model and dimension', async () => {
    const storage = new VectorStorage({
      storePath: path.join(testDir, 'defaults.lance'),
    });

    await storage.initialize();

    const stats = await storage.getStats();
    expect(stats.modelName).toBe('Xenova/all-MiniLM-L6-v2');
    expect(stats.dimension).toBe(384);

    await storage.close();
  });

  it('should throw error for operations before initialization', async () => {
    const storage = new VectorStorage({
      storePath: path.join(testDir, 'uninit.lance'),
    });

    // Operations on uninitialized store should throw
    await expect(storage.search('test')).rejects.toThrow('not initialized');
    await expect(storage.getDocument('test')).rejects.toThrow('not initialized');

    await storage.close();
  });

  it('should get store document count', async () => {
    const storage = new VectorStorage({
      storePath: path.join(testDir, 'count-test.lance'),
    });

    await storage.initialize();

    await storage.addDocuments([
      { id: 'count1', text: 'Test document 1', metadata: {} },
      { id: 'count2', text: 'Test document 2', metadata: {} },
    ]);

    const stats = await storage.getStats();
    expect(stats.totalDocuments).toBe(2);

    await storage.close();
  });

  it('should handle close without initialization', async () => {
    const storage = new VectorStorage({
      storePath: path.join(testDir, 'never-init.lance'),
    });

    // Should not throw
    await storage.close();
  });

  it('should filter search results by score threshold', async () => {
    const storage = new VectorStorage({
      storePath: path.join(testDir, 'threshold-test.lance'),
    });

    await storage.initialize();

    await storage.addDocuments([
      { id: 'exact', text: 'Machine learning algorithms', metadata: {} },
      { id: 'related', text: 'Artificial intelligence methods', metadata: {} },
      { id: 'unrelated', text: 'Cooking recipes for dinner', metadata: {} },
    ]);

    // High threshold should return fewer results
    const strictResults = await storage.search('machine learning', { scoreThreshold: 0.9 });
    const lenientResults = await storage.search('machine learning', { scoreThreshold: 0.1 });

    expect(strictResults.length).toBeLessThanOrEqual(lenientResults.length);

    await storage.close();
  });

  it('should handle very long documents', async () => {
    const storage = new VectorStorage({
      storePath: path.join(testDir, 'long-doc.lance'),
    });

    await storage.initialize();

    const longText = 'This is a very detailed explanation about machine learning. '.repeat(100); // Very long document
    await storage.addDocuments([{ id: 'long1', text: longText, metadata: { type: 'long' } }]);

    const stats = await storage.getStats();
    expect(stats.totalDocuments).toBe(1);

    // Verify we can retrieve it by ID
    const doc = await storage.getDocument('long1');
    expect(doc).toBeDefined();
    expect(doc?.id).toBe('long1');

    await storage.close();
  });

  it('should handle sequential batch operations', async () => {
    const storage = new VectorStorage({
      storePath: path.join(testDir, 'sequential.lance'),
    });

    await storage.initialize();

    // Add documents sequentially
    await storage.addDocuments([{ id: 'seq1', text: 'First doc', metadata: {} }]);
    await storage.addDocuments([{ id: 'seq2', text: 'Second doc', metadata: {} }]);
    await storage.addDocuments([{ id: 'seq3', text: 'Third doc', metadata: {} }]);

    const stats = await storage.getStats();
    expect(stats.totalDocuments).toBeGreaterThanOrEqual(3);

    // Verify all docs are searchable
    const results = await storage.search('doc', { limit: 10 });
    expect(results.length).toBeGreaterThanOrEqual(3);

    await storage.close();
  });
});
