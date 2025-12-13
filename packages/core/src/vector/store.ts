import type { Connection, Table } from '@lancedb/lancedb';
import * as lancedb from '@lancedb/lancedb';
import type {
  EmbeddingDocument,
  SearchOptions,
  SearchResult,
  SearchResultMetadata,
  VectorStore,
} from './types';

/**
 * Vector store implementation using LanceDB
 */
export class LanceDBVectorStore implements VectorStore {
  readonly path: string;
  private readonly tableName = 'documents';
  private connection: Connection | null = null;
  private table: Table | null = null;

  constructor(path: string, _dimension = 384) {
    this.path = path;
    // Note: dimension is determined by the embeddings passed to add()
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    if (this.connection) {
      return; // Already initialized
    }

    try {
      // Connect to LanceDB (creates directory if it doesn't exist)
      this.connection = await lancedb.connect(this.path);

      // Try to open existing table
      const tableNames = await this.connection.tableNames();

      if (tableNames.includes(this.tableName)) {
        this.table = await this.connection.openTable(this.tableName);
      }
      // Table will be created on first add() call
    } catch (error) {
      throw new Error(
        `Failed to initialize LanceDB at ${this.path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Add documents to the store using upsert (prevents duplicates)
   */
  async add(documents: EmbeddingDocument[], embeddings: number[][]): Promise<void> {
    if (!this.connection) {
      throw new Error('Store not initialized. Call initialize() first.');
    }

    if (documents.length !== embeddings.length) {
      throw new Error('Number of documents must match number of embeddings');
    }

    if (documents.length === 0) {
      return;
    }

    try {
      // Prepare data for LanceDB
      const data = documents.map((doc, i) => ({
        id: doc.id,
        text: doc.text,
        vector: embeddings[i],
        metadata: JSON.stringify(doc.metadata),
      }));

      if (!this.table) {
        // Create table on first add
        this.table = await this.connection.createTable(this.tableName, data);
        // Create scalar index on 'id' column for fast upsert operations
        await this.ensureIdIndex();
      } else {
        // Use mergeInsert to prevent duplicates (upsert operation)
        // This updates existing documents with the same ID or inserts new ones
        await this.table
          .mergeInsert('id')
          .whenMatchedUpdateAll()
          .whenNotMatchedInsertAll()
          .execute(data);
      }
    } catch (error) {
      throw new Error(
        `Failed to add documents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Search for similar documents
   */
  async search(queryEmbedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.table) {
      return []; // No documents yet
    }

    const { limit = 10, scoreThreshold = 0 } = options;

    try {
      // Perform vector search
      // LanceDB uses L2 distance by default, returning lower values for more similar vectors
      const results = await this.table.search(queryEmbedding).limit(limit).toArray();

      // Transform results
      // Convert L2 distance to a similarity score (0-1 range)
      // For normalized embeddings, L2 distance ≈ sqrt(2 * (1 - cosine_similarity))
      // So cosine_similarity ≈ 1 - (L2_distance^2 / 2)
      // We'll use an exponential decay to convert distance to similarity
      return results
        .map((result) => {
          const distance =
            result._distance !== undefined ? result._distance : Number.POSITIVE_INFINITY;
          // Use exponential decay: score = e^(-distance^2)
          // This gives scores close to 1 for distance≈0, and approaches 0 for large distances
          const score = Math.exp(-(distance * distance));

          return {
            id: result.id as string,
            score,
            metadata: JSON.parse(result.metadata as string) as SearchResultMetadata,
          };
        })
        .filter((result) => result.score >= scoreThreshold);
    } catch (error) {
      throw new Error(
        `Failed to search: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all documents without semantic search (fast scan)
   * Use this when you need all documents and don't need relevance ranking
   */
  async getAll(options: { limit?: number } = {}): Promise<SearchResult[]> {
    if (!this.table) {
      return []; // No documents yet
    }

    const { limit = 10000 } = options;

    try {
      // Use query() instead of search() - no vector similarity calculation needed
      // This is much faster as it skips embedding generation and distance computation
      const results = await this.table
        .query()
        .select(['id', 'text', 'metadata'])
        .limit(limit)
        .toArray();

      // Transform results (all have score of 1 since no ranking)
      return results.map((result) => ({
        id: result.id as string,
        score: 1, // No relevance score for full scan
        metadata: JSON.parse(result.metadata as string) as SearchResultMetadata,
      }));
    } catch (error) {
      throw new Error(
        `Failed to get all documents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a document by ID
   */
  async get(id: string): Promise<EmbeddingDocument | null> {
    if (!this.table) {
      return null;
    }

    try {
      // Use a dummy vector for search since LanceDB requires it
      // We'll search with a zero vector and filter results by ID
      const dummyVector = new Array(384).fill(0); // Default dimension
      const results = await this.table.search(dummyVector).limit(10000).toArray();

      const result = results.find((r) => r.id === id);

      if (!result) {
        return null;
      }

      return {
        id: result.id as string,
        text: result.text as string,
        metadata: JSON.parse(result.metadata as string) as Record<string, unknown>,
      };
    } catch (error) {
      throw new Error(
        `Failed to get document: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete documents by ID
   */
  async delete(ids: string[]): Promise<void> {
    if (!this.table || ids.length === 0) {
      return;
    }

    try {
      // Delete using SQL IN predicate
      // Escape single quotes in IDs to prevent SQL injection
      const escapedIds = ids.map((id) => id.replace(/'/g, "''"));
      const predicate = `id IN ('${escapedIds.join("', '")}')`;
      await this.table.delete(predicate);
    } catch (error) {
      throw new Error(
        `Failed to delete documents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Count total documents
   */
  async count(): Promise<number> {
    if (!this.table) {
      return 0;
    }

    try {
      return await this.table.countRows();
    } catch (error) {
      throw new Error(
        `Failed to count documents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Optimize the vector store (compact fragments, update indices)
   */
  async optimize(): Promise<void> {
    if (!this.table) {
      return;
    }

    try {
      await this.table.optimize();
    } catch (error) {
      throw new Error(
        `Failed to optimize: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Ensure scalar index exists on 'id' column for fast upsert operations
   */
  private async ensureIdIndex(): Promise<void> {
    if (!this.table) {
      return;
    }

    try {
      // Create a scalar index on the 'id' column to speed up mergeInsert operations
      // LanceDB will use an appropriate index type automatically
      await this.table.createIndex('id');
    } catch (error) {
      // Index may already exist or not be supported - log but don't fail
      // Some versions of LanceDB may not support this or it may already exist
      console.warn(
        `Could not create index on 'id' column: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Close the store
   */
  async close(): Promise<void> {
    // LanceDB doesn't require explicit closing
    this.table = null;
    this.connection = null;
  }
}
