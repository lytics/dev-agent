/**
 * Repository Indexer - Orchestrates scanning, embedding, and storage
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Logger } from '@lytics/kero';
import type { EventBus } from '../events/types.js';
import { buildCodeMetadata } from '../metrics/collector.js';
import type { CodeMetadata } from '../metrics/types.js';
import { scanRepository } from '../scanner';
import type { Document } from '../scanner/types';
import { getCurrentSystemResources, getOptimalConcurrency } from '../utils/concurrency';
import { VectorStorage } from '../vector';
import type { EmbeddingDocument, SearchOptions, SearchResult } from '../vector/types';
import { validateDetailedIndexStats, validateIndexerState } from './schemas/validation.js';
import { StatsAggregator } from './stats-aggregator';
import { mergeStats } from './stats-merger';
import type {
  DetailedIndexStats,
  FileMetadata,
  IndexError,
  IndexerConfig,
  IndexerState,
  IndexOptions,
  IndexStats,
  LanguageStats,
  PackageStats,
  SupportedLanguage,
  UpdateOptions,
} from './types';
import { getExtensionForLanguage, prepareDocumentsForEmbedding } from './utils';
import { aggregateChangeFrequency, calculateChangeFrequency } from './utils/change-frequency.js';

const INDEXER_VERSION = '1.0.0';
const DEFAULT_STATE_PATH = '.dev-agent/indexer-state.json';

/**
 * Repository Indexer
 * Orchestrates repository scanning, embedding generation, and vector storage
 */
export class RepositoryIndexer {
  private readonly config: Required<Omit<IndexerConfig, 'logger'>> & Pick<IndexerConfig, 'logger'>;
  private vectorStorage: VectorStorage;
  private state: IndexerState | null = null;
  private eventBus?: EventBus;
  private logger?: Logger;

  constructor(config: IndexerConfig, eventBus?: EventBus) {
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

    this.eventBus = eventBus;
    this.logger = config.logger;
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
    const _documentsIndexed = 0;

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

      filesScanned = scanResult.stats.filesScanned;
      documentsExtracted = scanResult.documents.length;

      // Aggregate detailed statistics
      const statsAggregator = new StatsAggregator();
      for (const doc of scanResult.documents) {
        statsAggregator.addDocument(doc);
      }

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

      // Process batches in parallel for better performance
      // Similar to TypeScript scanner: process multiple batches concurrently
      const CONCURRENCY = this.getOptimalConcurrency('indexer'); // Configurable concurrency

      // Create batches
      const batches: EmbeddingDocument[][] = [];
      for (let i = 0; i < embeddingDocuments.length; i += batchSize) {
        batches.push(embeddingDocuments.slice(i, i + batchSize));
      }

      // Process batches in parallel groups
      let documentsIndexed = 0;
      const batchGroups: EmbeddingDocument[][][] = [];
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        batchGroups.push(batches.slice(i, i + CONCURRENCY));
      }

      for (let groupIndex = 0; groupIndex < batchGroups.length; groupIndex++) {
        const batchGroup = batchGroups[groupIndex];

        // Process all batches in this group concurrently
        const results = await Promise.allSettled(
          batchGroup.map(async (batch, batchIndexInGroup) => {
            const batchNum = groupIndex * CONCURRENCY + batchIndexInGroup + 1;
            try {
              await this.vectorStorage.addDocuments(batch);
              return { success: true, count: batch.length, batchNum };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              errors.push({
                type: 'storage',
                message: `Failed to store batch ${batchNum}: ${errorMessage}`,
                error: error instanceof Error ? error : undefined,
                timestamp: new Date(),
              });
              logger?.error({ batch: batchNum, error: errorMessage }, 'Batch embedding failed');
              return { success: false, count: 0, batchNum };
            }
          })
        );

        // Update progress after each group
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            documentsIndexed += result.value.count;
          }
        }

        // Log progress with time estimates every 5 batches or on last group
        const currentBatchNum = (groupIndex + 1) * CONCURRENCY;
        if (currentBatchNum % 5 === 0 || groupIndex === batchGroups.length - 1) {
          const elapsed = Date.now() - startTime.getTime();
          const docsPerSecond = documentsIndexed / (elapsed / 1000);
          const remainingDocs = embeddingDocuments.length - documentsIndexed;
          const etaSeconds = Math.ceil(remainingDocs / docsPerSecond);
          const etaMinutes = Math.floor(etaSeconds / 60);
          const etaSecondsRemainder = etaSeconds % 60;

          const etaText =
            etaMinutes > 0 ? `${etaMinutes}m ${etaSecondsRemainder}s` : `${etaSecondsRemainder}s`;

          logger?.info(
            {
              batch: Math.min(currentBatchNum, totalBatches),
              totalBatches,
              documentsIndexed,
              total: embeddingDocuments.length,
              docsPerSecond: Math.round(docsPerSecond * 10) / 10,
              eta: etaText,
            },
            `Embedded ${documentsIndexed}/${embeddingDocuments.length} documents (${Math.round(docsPerSecond)} docs/sec, ETA: ${etaText})`
          );
        }

        // Update progress callback
        onProgress?.({
          phase: 'storing',
          filesProcessed: filesScanned,
          totalFiles: filesScanned,
          documentsIndexed,
          totalDocuments: embeddingDocuments.length,
          percentComplete: 66 + (documentsIndexed / embeddingDocuments.length) * 33,
        });
      }

      logger?.info({ documentsIndexed, errors: errors.length }, 'Embedding complete');

      // Phase 4: Complete
      const endTime = new Date();
      onProgress?.({
        phase: 'complete',
        filesProcessed: filesScanned,
        totalFiles: filesScanned,
        documentsIndexed,
        percentComplete: 100,
      });

      // Get detailed stats from aggregator
      const detailedStats = statsAggregator.getDetailedStats();

      const stats: DetailedIndexStats = {
        filesScanned,
        documentsExtracted,
        documentsIndexed,
        vectorsStored: documentsIndexed,
        duration: endTime.getTime() - startTime.getTime(),
        errors,
        startTime,
        endTime,
        repositoryPath: this.config.repositoryPath,
        ...detailedStats,
        statsMetadata: {
          isIncremental: false,
          lastFullIndex: endTime,
          lastUpdate: endTime,
          incrementalUpdatesSince: 0,
        },
      };

      // Update state with file metadata and detailed stats
      await this.updateState(scanResult.documents, detailedStats);

      // Reset incremental update counter after full index
      if (this.state) {
        this.state.incrementalUpdatesSince = 0;
        this.state.lastUpdate = endTime;
      }

      // Build code metadata for metrics storage
      let codeMetadata: CodeMetadata[] | undefined;
      if (this.eventBus) {
        try {
          codeMetadata = await buildCodeMetadata(this.config.repositoryPath, scanResult.documents);
        } catch (error) {
          // Not critical if metadata collection fails
          this.logger?.warn({ error }, 'Failed to collect code metadata for metrics');
        }
      }

      // Emit index.updated event (fire-and-forget)
      if (this.eventBus) {
        void this.eventBus.emit(
          'index.updated',
          {
            type: 'code',
            documentsCount: documentsIndexed,
            duration: stats.duration,
            path: this.config.repositoryPath,
            stats,
            isIncremental: false,
            codeMetadata,
          },
          { waitForHandlers: false }
        );
      }

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
    let incrementalStats: ReturnType<StatsAggregator['getDetailedStats']> | null = null;
    const affectedLanguages = new Set<string>();
    let scannedDocuments: Document[] = [];

    if (filesToReindex.length > 0) {
      const scanResult = await scanRepository({
        repoRoot: this.config.repositoryPath,
        include: filesToReindex,
        exclude: this.config.excludePatterns,
        logger: options.logger,
      });

      scannedDocuments = scanResult.documents;
      documentsExtracted = scanResult.documents.length;

      // Calculate stats for incremental changes
      const statsAggregator = new StatsAggregator();
      for (const doc of scanResult.documents) {
        statsAggregator.addDocument(doc);
        affectedLanguages.add(doc.language);
      }
      incrementalStats = statsAggregator.getDetailedStats();

      // Index new documents
      const embeddingDocuments = prepareDocumentsForEmbedding(scanResult.documents);
      await this.vectorStorage.addDocuments(embeddingDocuments);
      documentsIndexed = embeddingDocuments.length;

      // Merge incremental stats into state (updates the full repository stats)
      this.applyStatsMerge(deleted, changed, incrementalStats);

      // Update state with new documents
      await this.updateState(scanResult.documents);
    } else {
      // Only deletions - need to update stats by removing deleted file contributions
      if (deleted.length > 0) {
        this.applyStatsMerge(deleted, [], null);
      }
      // Save state
      await this.saveState();
    }

    const endTime = new Date();

    // Update metadata
    const incrementalUpdatesSince = (this.state.incrementalUpdatesSince || 0) + 1;
    if (this.state) {
      this.state.incrementalUpdatesSince = incrementalUpdatesSince;
      this.state.lastUpdate = endTime;
    }

    // Build metadata
    const lastFullIndex = this.state?.lastIndexTime || endTime;
    const warning = this.getStatsWarning(incrementalUpdatesSince);

    // Return incremental stats (what changed) with metadata
    const stats: DetailedIndexStats = {
      filesScanned: filesToReindex.length,
      documentsExtracted,
      documentsIndexed,
      vectorsStored: documentsIndexed,
      duration: endTime.getTime() - startTime.getTime(),
      errors,
      startTime,
      endTime,
      repositoryPath: this.config.repositoryPath,
      // Include incremental stats if we calculated them
      ...(incrementalStats || {}),
      statsMetadata: {
        isIncremental: true,
        lastFullIndex,
        lastUpdate: endTime,
        incrementalUpdatesSince,
        affectedLanguages: Array.from(affectedLanguages) as SupportedLanguage[],
        warning,
      },
    };

    // Build code metadata for metrics storage (only for updated files)
    let codeMetadata: CodeMetadata[] | undefined;
    if (this.eventBus && scannedDocuments.length > 0) {
      try {
        codeMetadata = await buildCodeMetadata(this.config.repositoryPath, scannedDocuments);
      } catch (error) {
        // Not critical if metadata collection fails
        this.logger?.warn({ error }, 'Failed to collect code metadata for metrics during update');
      }
    }

    // Emit index.updated event (fire-and-forget)
    if (this.eventBus) {
      void this.eventBus.emit(
        'index.updated',
        {
          type: 'code',
          documentsCount: documentsIndexed,
          duration: stats.duration,
          path: this.config.repositoryPath,
          stats,
          isIncremental: true,
          codeMetadata,
        },
        { waitForHandlers: false }
      );
    }

    return stats;
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
  async getStats(): Promise<DetailedIndexStats | null> {
    if (!this.state) {
      return null;
    }

    const vectorStats = await this.vectorStorage.getStats();
    const lastFullIndex = this.state.lastIndexTime;
    const lastUpdate = this.state.lastUpdate || lastFullIndex;
    const incrementalUpdatesSince = this.state.incrementalUpdatesSince || 0;
    const warning = this.getStatsWarning(incrementalUpdatesSince);

    // Enrich stats with change frequency (optional, non-blocking)
    const enrichedByLanguage = await this.enrichLanguageStatsWithChangeFrequency(
      this.state.stats.byLanguage
    );
    const enrichedByPackage = await this.enrichPackageStatsWithChangeFrequency(
      this.state.stats.byPackage
    );

    const stats = {
      filesScanned: this.state.stats.totalFiles,
      documentsExtracted: this.state.stats.totalDocuments,
      documentsIndexed: this.state.stats.totalDocuments,
      vectorsStored: vectorStats.totalDocuments,
      duration: 0, // Not tracked for overall stats
      errors: [],
      startTime: this.state.lastIndexTime,
      endTime: this.state.lastIndexTime,
      repositoryPath: this.state.repositoryPath,
      byLanguage: enrichedByLanguage,
      byComponentType: this.state.stats.byComponentType,
      byPackage: enrichedByPackage,
      statsMetadata: {
        isIncremental: false, // getStats returns full picture
        lastFullIndex,
        lastUpdate,
        incrementalUpdatesSince,
        warning,
      },
    };

    // Validate stats before returning (ensures API contract)
    const validation = validateDetailedIndexStats(stats);
    if (!validation.success) {
      console.warn(`Invalid stats detected: ${validation.error}`);
      return null;
    }

    return validation.data;
  }

  /**
   * Enrich language stats with change frequency data
   * Non-blocking: returns original stats if git analysis fails
   */
  private async enrichLanguageStatsWithChangeFrequency(
    byLanguage?: Partial<Record<SupportedLanguage, LanguageStats>>
  ): Promise<Partial<Record<SupportedLanguage, LanguageStats>> | undefined> {
    if (!byLanguage) return byLanguage;

    try {
      // Calculate change frequency for repository
      const changeFreq = await calculateChangeFrequency({
        repositoryPath: this.config.repositoryPath,
        maxCommits: 1000,
      });

      // Enrich each language with aggregate stats
      const enriched: Partial<Record<SupportedLanguage, LanguageStats>> = {};

      for (const [lang, langStats] of Object.entries(byLanguage) as Array<
        [SupportedLanguage, LanguageStats]
      >) {
        // Filter change frequency by file extension for this language
        const langExtensions = this.getExtensionsForLanguage(lang);
        const langFiles = new Map(
          [...changeFreq.entries()].filter(([filePath]) =>
            langExtensions.some((ext) => filePath.endsWith(ext))
          )
        );

        const aggregate = aggregateChangeFrequency(langFiles);

        enriched[lang] = {
          ...langStats,
          avgCommitsPerFile: aggregate.avgCommitsPerFile,
          lastModified: aggregate.lastModified ?? undefined,
        };
      }

      return enriched;
    } catch (error) {
      // Git not available or analysis failed - return original stats without change frequency
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(
        `[indexer] Unable to calculate change frequency for language stats: ${errorMessage}`
      );
      return byLanguage;
    }
  }

  /**
   * Enrich package stats with change frequency data
   * Non-blocking: returns original stats if git analysis fails
   */
  private async enrichPackageStatsWithChangeFrequency(
    byPackage?: Record<string, PackageStats>
  ): Promise<Record<string, PackageStats> | undefined> {
    if (!byPackage) return byPackage;

    try {
      // Calculate change frequency for repository
      const changeFreq = await calculateChangeFrequency({
        repositoryPath: this.config.repositoryPath,
        maxCommits: 1000,
      });

      // Enrich each package with aggregate stats
      const enriched: Record<string, PackageStats> = {};

      for (const [pkgPath, pkgStats] of Object.entries(byPackage)) {
        // Filter change frequency by package path
        const pkgFiles = new Map(
          [...changeFreq.entries()].filter(([filePath]) => filePath.startsWith(pkgPath))
        );

        const aggregate = aggregateChangeFrequency(pkgFiles);

        enriched[pkgPath] = {
          ...pkgStats,
          totalCommits: aggregate.totalCommits,
          lastModified: aggregate.lastModified ?? undefined,
        };
      }

      return enriched;
    } catch (error) {
      // Git not available or analysis failed - return original stats without change frequency
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(
        `[indexer] Unable to calculate change frequency for package stats: ${errorMessage}`
      );
      return byPackage;
    }
  }

  /**
   * Get file extensions for a language
   */
  private getExtensionsForLanguage(language: SupportedLanguage): string[] {
    const extensionMap: Record<SupportedLanguage, string[]> = {
      typescript: ['.ts', '.tsx'],
      javascript: ['.js', '.jsx', '.mjs', '.cjs'],
      go: ['.go'],
      markdown: ['.md', '.markdown'],
    };
    return extensionMap[language] || [];
  }

  /**
   * Apply stat merging using pure functions
   * Wrapper around the pure mergeStats function that updates state
   */
  private applyStatsMerge(
    deleted: string[],
    changed: string[],
    incrementalStats: ReturnType<StatsAggregator['getDetailedStats']> | null
  ): void {
    if (!this.state) {
      return;
    }

    // Prepare file metadata for deleted and changed files
    const deletedFiles = deleted
      .map((path) => ({ path, metadata: this.state?.files[path] }))
      .filter((f) => f.metadata !== undefined);

    const changedFiles = changed
      .map((path) => ({ path, metadata: this.state?.files[path] }))
      .filter((f) => f.metadata !== undefined);

    // Use pure function to compute new stats
    const mergedStats = mergeStats({
      currentStats: {
        byLanguage: this.state.stats.byLanguage || {},
        byComponentType: this.state.stats.byComponentType || {},
        byPackage: this.state.stats.byPackage || {},
      },
      deletedFiles: deletedFiles.filter((f) => f.metadata !== undefined) as Array<{
        path: string;
        metadata: FileMetadata;
      }>,
      changedFiles: changedFiles.filter((f) => f.metadata !== undefined) as Array<{
        path: string;
        metadata: FileMetadata;
      }>,
      incrementalStats,
    });

    // Update state with merged stats
    this.state.stats.byLanguage = mergedStats.byLanguage;
    this.state.stats.byComponentType = mergedStats.byComponentType;
    this.state.stats.byPackage = mergedStats.byPackage;
  }

  /**
   * Get warning message for stale stats
   * Extracted for testability
   */
  private getStatsWarning(incrementalUpdatesSince: number): string | undefined {
    const threshold = 10;
    if (incrementalUpdatesSince > threshold) {
      return "Consider running 'dev index' for most accurate statistics";
    }
    return undefined;
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
      const data = JSON.parse(stateContent);

      // Validate state with Zod schema
      const validation = validateIndexerState(data);
      if (!validation.success) {
        console.warn(`Invalid indexer state (will start fresh): ${validation.error}`);
        this.state = null;
        return;
      }

      this.state = validation.data;

      // Validate state compatibility
      if (this.state.version !== INDEXER_VERSION) {
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

    // Validate state before saving (defensive check)
    const validation = validateIndexerState(this.state);
    if (!validation.success) {
      // Log warning but don't block saving - state was valid when created
      console.warn(`Indexer state validation warning: ${validation.error}`);
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.config.statePath), { recursive: true });

    // Write state
    await fs.writeFile(this.config.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /**
   * Update state with newly indexed documents
   */
  private async updateState(
    documents: Document[],
    detailedStats?: {
      byLanguage?: Record<string, { files: number; components: number; lines: number }>;
      byComponentType?: Partial<Record<string, number>>;
      byPackage?: Record<
        string,
        {
          name: string;
          path: string;
          files: number;
          components: number;
          languages: Partial<Record<string, number>>;
        }
      >;
    }
  ): Promise<void> {
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
    // Query actual vector count from LanceDB (not just current batch size)
    // This ensures totalDocuments reflects reality after both full index and incremental updates
    const vectorStats = await this.vectorStorage.getStats();
    this.state.stats.totalDocuments = vectorStats.totalDocuments;
    this.state.stats.totalVectors = vectorStats.totalDocuments;
    this.state.lastIndexTime = new Date();

    // Save detailed stats if provided
    if (detailedStats) {
      if (detailedStats.byLanguage) {
        this.state.stats.byLanguage = detailedStats.byLanguage;
      }
      if (detailedStats.byComponentType) {
        this.state.stats.byComponentType = detailedStats.byComponentType;
      }
      if (detailedStats.byPackage) {
        this.state.stats.byPackage = detailedStats.byPackage;
      }
    }

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
   * Get optimal concurrency level based on system resources and environment variables
   */
  private getOptimalConcurrency(context: string): number {
    return getOptimalConcurrency({
      context,
      systemResources: getCurrentSystemResources(),
      environmentVariables: process.env,
    });
  }

  /**
   * Get file extension for a language
   */
}

export * from './types';
