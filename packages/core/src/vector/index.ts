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
   * @param options Optional initialization options
   * @param options.skipEmbedder Skip embedder initialization (useful for read-only operations)
   */
  async initialize(options?: { skipEmbedder?: boolean }): Promise<void> {
    if (this.initialized) {
      return;
    }

    const { skipEmbedder = false } = options || {};

    if (skipEmbedder) {
      // Only initialize store, skip embedder (much faster for read-only operations)
      await this.store.initialize();
    } else {
      // Initialize both embedder and store
      await Promise.all([this.embedder.initialize(), this.store.initialize()]);
    }

    this.initialized = true;
  }

  /**
   * Ensure embedder is initialized (lazy initialization for search operations)
   */
  private async ensureEmbedder(): Promise<void> {
    if (!this.embedder) {
      throw new Error('Embedder not available');
    }
    // Initialize embedder if not already done
    await this.embedder.initialize();
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

    // Ensure embedder is initialized (lazy load if needed)
    await this.ensureEmbedder();

    // Generate query embedding
    const queryEmbedding = await this.embedder.embed(query);

    // Search vector store
    return this.store.search(queryEmbedding, options);
  }

  /**
   * Find similar documents to a given document by ID
   * More efficient than search() as it reuses the document's existing embedding
   */
  async searchByDocumentId(documentId: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    return this.store.searchByDocumentId(documentId, options);
  }

  /**
   * Get all documents without semantic search (fast scan)
   * Use this when you need all documents and don't need relevance ranking
   * This is 10-20x faster than search() as it skips embedding generation
   */
  async getAll(options?: { limit?: number }): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    return this.store.getAll(options);
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
   * Clear all documents from the store (destructive operation)
   * Used for force re-indexing
   */
  async clear(): Promise<void> {
    if (!this.initialized) {
      throw new Error('VectorStorage not initialized. Call initialize() first.');
    }

    await this.store.clear();
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
