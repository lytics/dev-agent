import type { Connection, Table } from '@lancedb/lancedb';
import * as lancedb from '@lancedb/lancedb';
import type { EmbeddingDocument, SearchOptions, SearchResult, VectorStore } from './types';

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
   * Add documents to the store
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
      } else {
        // Add to existing table
        await this.table.add(data);
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
      const results = await this.table.search(queryEmbedding).limit(limit).toArray();

      // Transform results
      return results
        .map((result) => ({
          id: result.id as string,
          score: result._distance ? 1 - result._distance : 0, // Convert distance to similarity
          metadata: JSON.parse(result.metadata as string) as Record<string, unknown>,
        }))
        .filter((result) => result.score >= scoreThreshold);
    } catch (error) {
      throw new Error(
        `Failed to search: ${error instanceof Error ? error.message : String(error)}`
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
      // Note: LanceDB delete API may vary by version
      // For now, we'll mark this as a TODO for proper implementation
      // This is a limitation of the current LanceDB API
      throw new Error('Delete operation not yet implemented for LanceDB');
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
   * Close the store
   */
  async close(): Promise<void> {
    // LanceDB doesn't require explicit closing
    this.table = null;
    this.connection = null;
  }
}
