import { beforeAll, describe, expect, it } from 'vitest';
import { TransformersEmbedder } from './embedder';

describe('TransformersEmbedder', () => {
  let embedder: TransformersEmbedder;

  beforeAll(async () => {
    embedder = new TransformersEmbedder();
    await embedder.initialize();
  }, 60000); // Longer timeout for model download

  it('should have correct dimension', () => {
    expect(embedder.dimension).toBe(384);
    expect(embedder.modelName).toBe('Xenova/all-MiniLM-L6-v2');
  });

  it('should initialize with custom model', () => {
    const customEmbedder = new TransformersEmbedder('Xenova/all-MiniLM-L6-v2', 384);
    expect(customEmbedder.dimension).toBe(384);
    expect(customEmbedder.modelName).toBe('Xenova/all-MiniLM-L6-v2');
  });

  it('should generate embeddings for single text', async () => {
    const text = 'This is a test sentence';
    const embedding = await embedder.embed(text);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
    expect(typeof embedding[0]).toBe('number');
  });

  it('should generate consistent embeddings', async () => {
    const text = 'Consistent test';
    const embedding1 = await embedder.embed(text);
    const embedding2 = await embedder.embed(text);

    // Should be identical for same input
    expect(embedding1.length).toBe(embedding2.length);
    expect(embedding1[0]).toBeCloseTo(embedding2[0], 5);
  });

  it('should generate different embeddings for different text', async () => {
    const text1 = 'First sentence';
    const text2 = 'Completely different meaning about programming';

    const embedding1 = await embedder.embed(text1);
    const embedding2 = await embedder.embed(text2);

    // Should be different - check multiple dimensions
    const totalDiff = embedding1.reduce((sum, val, i) => sum + Math.abs(val - embedding2[i]), 0);
    expect(totalDiff).toBeGreaterThan(1); // Significant difference across all dimensions
  });

  it('should handle empty string', async () => {
    const embedding = await embedder.embed('');
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
  });

  it('should handle long text', async () => {
    const longText = 'word '.repeat(1000);
    const embedding = await embedder.embed(longText);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
  });

  it('should generate batch embeddings', async () => {
    const texts = ['First text', 'Second text', 'Third text'];
    const embeddings = await embedder.embedBatch(texts);

    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(3);
    for (const embedding of embeddings) {
      expect(embedding.length).toBe(384);
    }
  });

  it('should handle empty batch', async () => {
    const embeddings = await embedder.embedBatch([]);
    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(0);
  });

  it('should handle single item batch', async () => {
    const embeddings = await embedder.embedBatch(['Single item']);
    expect(embeddings.length).toBe(1);
    expect(embeddings[0].length).toBe(384);
  });

  it('should handle multiple initializations', async () => {
    await embedder.initialize();
    await embedder.initialize();
    // Should not throw
  });

  it('should throw error when embedding without initialization', async () => {
    const uninitEmbedder = new TransformersEmbedder();
    await expect(uninitEmbedder.embed('test')).rejects.toThrow();
  });

  it('should throw error when batch embedding without initialization', async () => {
    const uninitEmbedder = new TransformersEmbedder();
    await expect(uninitEmbedder.embedBatch(['test'])).rejects.toThrow();
  });

  it('should handle batch size configuration', () => {
    embedder.setBatchSize(16);
    expect(embedder.getBatchSize()).toBe(16);

    embedder.setBatchSize(32);
    expect(embedder.getBatchSize()).toBe(32);
  });

  it('should reject invalid batch size', () => {
    expect(() => embedder.setBatchSize(0)).toThrow();
    expect(() => embedder.setBatchSize(-1)).toThrow();
  });

  it('should handle large batch efficiently', async () => {
    const texts = Array.from({ length: 100 }, (_, i) => `Text number ${i}`);
    const embeddings = await embedder.embedBatch(texts);

    expect(embeddings.length).toBe(100);
    for (const embedding of embeddings) {
      expect(embedding.length).toBe(384);
    }
  });

  it('should handle special characters in text', async () => {
    const specialText = 'Test with émojis 🚀 and spëcial çharacters @#$%';
    const embedding = await embedder.embed(specialText);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
  });

  it('should handle very long single token', async () => {
    const longWord = 'a'.repeat(1000);
    const embedding = await embedder.embed(longWord);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
  });
});
