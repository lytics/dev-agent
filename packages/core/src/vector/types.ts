/**
 * Vector storage and embedding types
 */

/**
 * Document to be embedded and stored
 */
export interface EmbeddingDocument {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

/**
 * Search result from vector store
 */
export interface SearchResult {
  id: string;
  score: number; // Cosine similarity score (0-1)
  metadata: Record<string, unknown>;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number; // Number of results to return (default: 10)
  filter?: Record<string, unknown>; // Metadata filters
  scoreThreshold?: number; // Minimum similarity score (default: 0)
}

/**
 * Embedding provider interface
 * Generates vector embeddings from text
 */
export interface EmbeddingProvider {
  readonly modelName: string;
  readonly dimension: number;

  /**
   * Initialize the embedding model
   */
  initialize(): Promise<void>;

  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batched for efficiency)
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Vector store interface
 * Stores and retrieves vector embeddings
 */
export interface VectorStore {
  readonly path: string;

  /**
   * Initialize the vector store
   */
  initialize(): Promise<void>;

  /**
   * Add documents to the store
   */
  add(documents: EmbeddingDocument[], embeddings: number[][]): Promise<void>;

  /**
   * Search for similar documents
   */
  search(queryEmbedding: number[], options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Get a document by ID
   */
  get(id: string): Promise<EmbeddingDocument | null>;

  /**
   * Delete documents by ID
   */
  delete(ids: string[]): Promise<void>;

  /**
   * Count total documents
   */
  count(): Promise<number>;

  /**
   * Close the store
   */
  close(): Promise<void>;
}

/**
 * Vector storage configuration
 */
export interface VectorStorageConfig {
  storePath: string; // Path to LanceDB storage
  embeddingModel?: string; // Model name (default: 'Xenova/all-MiniLM-L6-v2')
  dimension?: number; // Embedding dimension (default: 384)
}

/**
 * Statistics about the vector store
 */
export interface VectorStats {
  totalDocuments: number;
  storageSize: number; // in bytes
  dimension: number;
  modelName: string;
}
