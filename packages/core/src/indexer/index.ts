/**
 * Repository Indexer - Orchestrates scanning, embedding, and storage
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { scanRepository } from '../scanner';
import type { Document } from '../scanner/types';
import { VectorStorage } from '../vector';
import type { SearchOptions, SearchResult } from '../vector/types';
import type {
  FileMetadata,
  IndexError,
  IndexerConfig,
  IndexerState,
  IndexOptions,
  IndexStats,
  UpdateOptions,
} from './types';
import { getExtensionForLanguage, prepareDocumentsForEmbedding } from './utils';

const INDEXER_VERSION = '1.0.0';
const DEFAULT_STATE_PATH = '.dev-agent/indexer-state.json';

/**
 * Repository Indexer
 * Orchestrates repository scanning, embedding generation, and vector storage
 */
export class RepositoryIndexer {
  private readonly config: Required<IndexerConfig>;
  private vectorStorage: VectorStorage;
  private state: IndexerState | null = null;

  constructor(config: IndexerConfig) {
    this.config = {
      statePath: path.join(config.repositoryPath, DEFAULT_STATE_PATH),
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      embeddingDimension: 384,
      batchSize: 32,
      excludePatterns: [],
      languages: [],
      ...config,
    };

    this.vectorStorage = new VectorStorage({
      storePath: this.config.vectorStorePath,
      embeddingModel: this.config.embeddingModel,
      dimension: this.config.embeddingDimension,
    });
  }

  /**
   * Initialize the indexer (load state and initialize vector storage)
   */
  async initialize(): Promise<void> {
    // Initialize vector storage
    await this.vectorStorage.initialize();

    // Load existing state if available
    await this.loadState();
  }

  /**
   * Index the entire repository
   */
  async index(options: IndexOptions = {}): Promise<IndexStats> {
    const startTime = new Date();
    const errors: IndexError[] = [];
    let filesScanned = 0;
    let documentsExtracted = 0;
    let documentsIndexed = 0;

    try {
      // Phase 1: Scan repository
      const onProgress = options.onProgress;
      onProgress?.({
        phase: 'scanning',
        filesProcessed: 0,
        totalFiles: 0,
        documentsIndexed: 0,
        percentComplete: 0,
      });

      const scanResult = await scanRepository({
        repoRoot: this.config.repositoryPath,
        include: options.languages?.map((lang) => `**/*.${getExtensionForLanguage(lang)}`),
        exclude: [...this.config.excludePatterns, ...(options.excludePatterns || [])],
        languages: options.languages,
        logger: options.logger,
      });

      filesScanned = scanResult.documents.length;
      documentsExtracted = scanResult.documents.length;

      // Phase 2: Prepare documents for embedding
      const logger = options.logger?.child({ component: 'indexer' });
      logger?.info({ documents: documentsExtracted }, 'Preparing documents for embedding');

      onProgress?.({
        phase: 'embedding',
        filesProcessed: filesScanned,
        totalFiles: filesScanned,
        documentsIndexed: 0,
        percentComplete: 33,
      });

      const embeddingDocuments = prepareDocumentsForEmbedding(scanResult.documents);

      // Phase 3: Batch embed and store
      logger?.info(
        {
          documents: embeddingDocuments.length,
          batchSize: options.batchSize || this.config.batchSize,
        },
        'Starting embedding and storage'
      );

      onProgress?.({
        phase: 'storing',
        filesProcessed: filesScanned,
        totalFiles: filesScanned,
        documentsIndexed: 0,
        totalDocuments: embeddingDocuments.length,
        percentComplete: 66,
      });

      const batchSize = options.batchSize || this.config.batchSize;
      const totalBatches = Math.ceil(embeddingDocuments.length / batchSize);
      let batchNum = 0;

      for (let i = 0; i < embeddingDocuments.length; i += batchSize) {
        const batch = embeddingDocuments.slice(i, i + batchSize);
        batchNum++;

        try {
          await this.vectorStorage.addDocuments(batch);
          documentsIndexed += batch.length;

          // Log progress every 10 batches or on last batch
          if (batchNum % 10 === 0 || batchNum === totalBatches) {
            logger?.info(
              { batch: batchNum, totalBatches, documentsIndexed, total: embeddingDocuments.length },
              `Embedded ${documentsIndexed}/${embeddingDocuments.length} documents`
            );
          }

          onProgress?.({
            phase: 'storing',
            filesProcessed: filesScanned,
            totalFiles: filesScanned,
            documentsIndexed,
            totalDocuments: embeddingDocuments.length,
            percentComplete: 66 + (documentsIndexed / embeddingDocuments.length) * 33,
          });
        } catch (error) {
          errors.push({
            type: 'storage',
            message: `Failed to store batch: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : undefined,
            timestamp: new Date(),
          });
          logger?.error(
            { batch: batchNum, error: error instanceof Error ? error.message : String(error) },
            'Batch embedding failed'
          );
        }
      }

      logger?.info({ documentsIndexed, errors: errors.length }, 'Embedding complete');

      // Update state
      await this.updateState(scanResult.documents);

      // Phase 4: Complete
      const endTime = new Date();
      onProgress?.({
        phase: 'complete',
        filesProcessed: filesScanned,
        totalFiles: filesScanned,
        documentsIndexed,
        percentComplete: 100,
      });

      const stats: IndexStats = {
        filesScanned,
        documentsExtracted,
        documentsIndexed,
        vectorsStored: documentsIndexed,
        duration: endTime.getTime() - startTime.getTime(),
        errors,
        startTime,
        endTime,
        repositoryPath: this.config.repositoryPath,
      };

      return stats;
    } catch (error) {
      errors.push({
        type: 'scanner',
        message: `Indexing failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : undefined,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Incrementally update the index (only changed files)
   */
  async update(options: UpdateOptions = {}): Promise<IndexStats> {
    if (!this.state) {
      // No previous state, do full index
      return this.index(options);
    }

    const startTime = new Date();
    const errors: IndexError[] = [];

    // Determine which files need reindexing
    const { changed, added, deleted } = await this.detectChangedFiles(options.since);
    const filesToReindex = [...changed, ...added];

    if (filesToReindex.length === 0 && deleted.length === 0) {
      // No changes, return empty stats
      return {
        filesScanned: 0,
        documentsExtracted: 0,
        documentsIndexed: 0,
        vectorsStored: 0,
        duration: Date.now() - startTime.getTime(),
        errors: [],
        startTime,
        endTime: new Date(),
        repositoryPath: this.config.repositoryPath,
      };
    }

    // Delete documents for deleted files
    for (const file of deleted) {
      const oldMetadata = this.state.files[file];
      if (oldMetadata?.documentIds) {
        try {
          await this.vectorStorage.deleteDocuments(oldMetadata.documentIds);
        } catch (error) {
          errors.push({
            type: 'storage',
            message: `Failed to delete documents for removed file ${file}`,
            file,
            error: error instanceof Error ? error : undefined,
            timestamp: new Date(),
          });
        }
      }
      // Remove from state
      delete this.state.files[file];
    }

    // Delete old documents for changed files (not added - they have no old docs)
    for (const file of changed) {
      const oldMetadata = this.state.files[file];
      if (oldMetadata?.documentIds) {
        try {
          await this.vectorStorage.deleteDocuments(oldMetadata.documentIds);
        } catch (error) {
          errors.push({
            type: 'storage',
            message: `Failed to delete old documents for ${file}`,
            file,
            error: error instanceof Error ? error : undefined,
            timestamp: new Date(),
          });
        }
      }
    }

    // Scan and index changed + added files
    let documentsExtracted = 0;
    let documentsIndexed = 0;

    if (filesToReindex.length > 0) {
      const scanResult = await scanRepository({
        repoRoot: this.config.repositoryPath,
        include: filesToReindex,
        exclude: this.config.excludePatterns,
        logger: options.logger,
      });

      documentsExtracted = scanResult.documents.length;

      // Index new documents
      const embeddingDocuments = prepareDocumentsForEmbedding(scanResult.documents);
      await this.vectorStorage.addDocuments(embeddingDocuments);
      documentsIndexed = embeddingDocuments.length;

      // Update state with new documents
      await this.updateState(scanResult.documents);
    } else {
      // Only deletions - still need to save state
      await this.saveState();
    }

    const endTime = new Date();
    return {
      filesScanned: filesToReindex.length,
      documentsExtracted,
      documentsIndexed,
      vectorsStored: documentsIndexed,
      duration: endTime.getTime() - startTime.getTime(),
      errors,
      startTime,
      endTime,
      repositoryPath: this.config.repositoryPath,
    };
  }

  /**
   * Search the indexed repository
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.vectorStorage.search(query, options);
  }

  /**
   * Get indexing statistics
   */
  async getStats(): Promise<IndexStats | null> {
    if (!this.state) {
      return null;
    }

    const vectorStats = await this.vectorStorage.getStats();

    return {
      filesScanned: this.state.stats.totalFiles,
      documentsExtracted: this.state.stats.totalDocuments,
      documentsIndexed: this.state.stats.totalDocuments,
      vectorsStored: vectorStats.totalDocuments,
      duration: 0, // Not tracked for overall stats
      errors: [],
      startTime: this.state.lastIndexTime,
      endTime: this.state.lastIndexTime,
      repositoryPath: this.state.repositoryPath,
    };
  }

  /**
   * Close the indexer and cleanup resources
   */
  async close(): Promise<void> {
    await this.vectorStorage.close();
  }

  /**
   * Prepare scanner documents for embedding
   */

  /**
   * Load indexer state from disk
   */
  private async loadState(): Promise<void> {
    try {
      const stateContent = await fs.readFile(this.config.statePath, 'utf-8');
      this.state = JSON.parse(stateContent);

      // Validate state compatibility
      if (this.state && this.state.version !== INDEXER_VERSION) {
        console.warn(
          `Indexer state version mismatch: ${this.state.version} vs ${INDEXER_VERSION}. May need re-indexing.`
        );
      }
    } catch (_error) {
      // State file doesn't exist or is invalid, start fresh
      this.state = null;
    }
  }

  /**
   * Save indexer state to disk
   */
  private async saveState(): Promise<void> {
    if (!this.state) {
      return;
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.config.statePath), { recursive: true });

    // Write state
    await fs.writeFile(this.config.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /**
   * Update state with newly indexed documents
   */
  private async updateState(documents: Document[]): Promise<void> {
    if (!this.state) {
      this.state = {
        version: INDEXER_VERSION,
        embeddingModel: this.config.embeddingModel,
        embeddingDimension: this.config.embeddingDimension,
        repositoryPath: this.config.repositoryPath,
        lastIndexTime: new Date(),
        files: {},
        stats: {
          totalFiles: 0,
          totalDocuments: 0,
          totalVectors: 0,
        },
      };
    }

    // Group documents by file
    const fileMap = new Map<string, Document[]>();
    for (const doc of documents) {
      if (!fileMap.has(doc.metadata.file)) {
        fileMap.set(doc.metadata.file, []);
      }
      fileMap.get(doc.metadata.file)?.push(doc);
    }

    // Update file metadata
    for (const [filePath, docs] of fileMap) {
      const fullPath = path.join(this.config.repositoryPath, filePath);
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      let hash = '';

      try {
        stat = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        hash = crypto.createHash('sha256').update(content).digest('hex');
      } catch {
        // File may not exist or be readable
        continue;
      }

      const metadata: FileMetadata = {
        path: filePath,
        hash,
        lastModified: stat.mtime,
        lastIndexed: new Date(),
        documentIds: docs.map((d) => d.id),
        size: stat.size,
        language: docs[0]?.language || 'unknown',
      };

      this.state.files[filePath] = metadata;
    }

    // Update stats
    this.state.stats.totalFiles = Object.keys(this.state.files).length;
    this.state.stats.totalDocuments = documents.length;
    this.state.stats.totalVectors = documents.length;
    this.state.lastIndexTime = new Date();

    // Save state
    await this.saveState();
  }

  /**
   * Detect files that have changed, been added, or deleted since last index
   */
  private async detectChangedFiles(since?: Date): Promise<{
    changed: string[];
    added: string[];
    deleted: string[];
  }> {
    if (!this.state) {
      return { changed: [], added: [], deleted: [] };
    }

    const changed: string[] = [];
    const deleted: string[] = [];

    // Check existing tracked files for changes or deletion
    for (const [filePath, metadata] of Object.entries(this.state.files)) {
      const fullPath = path.join(this.config.repositoryPath, filePath);

      try {
        const stat = await fs.stat(fullPath);

        // Check if modified after 'since' date
        if (since && stat.mtime <= since) {
          continue;
        }

        // Check if file has changed by comparing hash
        const content = await fs.readFile(fullPath, 'utf-8');
        const currentHash = crypto.createHash('sha256').update(content).digest('hex');

        if (currentHash !== metadata.hash) {
          changed.push(filePath);
        }
      } catch {
        // File no longer exists or not readable - mark as deleted
        deleted.push(filePath);
      }
    }

    // Scan for new files not in state
    const scanResult = await scanRepository({
      repoRoot: this.config.repositoryPath,
      exclude: this.config.excludePatterns,
    });

    const trackedFiles = new Set(Object.keys(this.state.files));
    const added: string[] = [];

    for (const doc of scanResult.documents) {
      const filePath = doc.metadata.file;
      if (!trackedFiles.has(filePath)) {
        added.push(filePath);
      }
    }

    // Deduplicate added files (multiple docs per file)
    const uniqueAdded = [...new Set(added)];

    return { changed, added: uniqueAdded, deleted };
  }

  /**
   * Get file extension for a language
   */
}

export * from './types';
