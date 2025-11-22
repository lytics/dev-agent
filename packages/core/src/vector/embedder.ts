import { type FeatureExtractionPipeline, pipeline } from '@xenova/transformers';
import type { EmbeddingProvider } from './types';

/**
 * Options for feature extraction from transformers.js
 */
interface FeatureExtractionOptions {
  pooling?: 'none' | 'mean' | 'cls';
  normalize?: boolean;
  quantize?: boolean;
  precision?: 'binary' | 'ubinary';
}

/**
 * Embedding provider using Transformers.js
 * Uses all-MiniLM-L6-v2 model for generating embeddings
 */
export class TransformersEmbedder implements EmbeddingProvider {
  readonly modelName: string;
  readonly dimension: number;
  private pipeline: FeatureExtractionPipeline | null = null;
  private batchSize = 32;

  constructor(modelName = 'Xenova/all-MiniLM-L6-v2', dimension = 384) {
    this.modelName = modelName;
    this.dimension = dimension;
  }

  /**
   * Initialize the embedding model
   * Downloads and caches the model on first run
   */
  async initialize(): Promise<void> {
    if (this.pipeline) {
      return; // Already initialized
    }

    try {
      // Create pipeline with the feature-extraction task
      this.pipeline = (await pipeline(
        'feature-extraction',
        this.modelName
      )) as FeatureExtractionPipeline;
    } catch (error) {
      throw new Error(
        `Failed to initialize embedding model ${this.modelName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    if (!this.pipeline) {
      throw new Error('Embedder not initialized. Call initialize() first.');
    }

    try {
      // Call pipeline with proper options
      const options: FeatureExtractionOptions = {
        pooling: 'mean', // Mean pooling
        normalize: true, // L2 normalization
      };

      const output = await this.pipeline(text, options);

      // Extract data from tensor output
      // Note: Using any because transformers.js doesn't export specific Tensor types
      // biome-ignore lint/suspicious/noExplicitAny: Tensor type not exported
      const tensorOutput = output as any;

      if (tensorOutput?.data) {
        return Array.from(tensorOutput.data as Float32Array);
      }

      throw new Error('Unexpected output format from embedding model');
    } catch (error) {
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate embeddings for multiple texts (batched for efficiency)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.pipeline) {
      throw new Error('Embedder not initialized. Call initialize() first.');
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      // Process in batches to avoid memory issues
      const embeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += this.batchSize) {
        const batch = texts.slice(i, i + this.batchSize);

        // Process batch in parallel
        const batchEmbeddings = await Promise.all(batch.map((text) => this.embed(text)));

        embeddings.push(...batchEmbeddings);
      }

      return embeddings;
    } catch (error) {
      throw new Error(
        `Failed to generate batch embeddings: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Set batch size for batch processing
   */
  setBatchSize(size: number): void {
    if (size < 1) {
      throw new Error('Batch size must be at least 1');
    }
    this.batchSize = size;
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.batchSize;
  }
}
