/**
 * Vector storage and embedding system
 */

export * from './embedder';
export * from './store';
export * from './types';

import * as fs from 'node:fs/promises';
import { TransformersEmbedder } from './embedder';
import { LanceDBVectorStore } from './store';
import type {
  EmbeddingDocument,
  SearchOptions,
  SearchResult,
  VectorStats,
  VectorStorageConfig,
} from './types';

/**
 * Convenience class that combines embedder and vector store
 * Provides a simple API for storing and searching documents
 */
export class VectorStorage {
  private readonly embedder: TransformersEmbedder;
  private readonly store: LanceDBVectorStore;
  private initialized = false;

  constructor(config: VectorStorageConfig) {
    const { storePath, embeddingModel = 'Xenova/all-MiniLM-L6-v2', dimension = 384 } = config;

    this.embedder = new TransformersEmbedder(embeddingModel, dimension);
    this.store = new LanceDBVectorStore(storePath, dimension);
  }

  /**
   * Initialize both embedder and store
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await Promise.all([this.embedder.initialize(), this.store.initialize()]);

    this.initialized = true;
  }

  /**
   * Add documents to the store (automatically generates embeddings)
   */
  async addDocuments(documents: EmbeddingDocument[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    if (documents.length === 0) {
      return;
    }

    // Generate embeddings
    const texts = documents.map((doc) => doc.text);
    const embeddings = await this.embedder.embedBatch(texts);

    // Store documents with embeddings
    await this.store.add(documents, embeddings);
  }

  /**
   * Search for similar documents using natural language query
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    // Generate query embedding
    const queryEmbedding = await this.embedder.embed(query);

    // Search vector store
    return this.store.search(queryEmbedding, options);
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<EmbeddingDocument | null> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    return this.store.get(id);
  }

  /**
   * Delete documents by ID
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    await this.store.delete(ids);
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(): Promise<VectorStats> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    const totalDocuments = await this.store.count();

    // Get storage size
    let storageSize = 0;
    try {
      const storePath = this.store.path;
      const stats = await fs.stat(storePath);
      storageSize = stats.size;
    } catch {
      // Directory might not exist yet
      storageSize = 0;
    }

    return {
      totalDocuments,
      storageSize,
      dimension: this.embedder.dimension,
      modelName: this.embedder.modelName,
    };
  }

  /**
   * Optimize the vector store (compact fragments, update indices)
   * Call this after bulk indexing operations for better performance
   */
  async optimize(): Promise<void> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    await this.store.optimize();
  }

  /**
   * Close the storage
   */
  async close(): Promise<void> {
    await this.store.close();
    this.initialized = false;
  }
}
