/**
 * Metrics Store
 *
 * SQLite-based storage for repository metrics and snapshots.
 * Provides automatic persistence via event bus integration.
 */

import * as crypto from 'node:crypto';
import type { Logger } from '@lytics/kero';
import Database from 'better-sqlite3';
import type { DetailedIndexStats } from '../indexer/types.js';
import { initializeDatabase } from './schema.js';
import {
  type CodeMetadata,
  type CodeMetadataQuery,
  type Snapshot,
  type SnapshotQuery,
  SnapshotQuerySchema,
} from './types.js';

/**
 * Metrics Store Class
 *
 * Stores snapshots of repository statistics over time.
 * Designed to work with event bus for automatic persistence.
 */
export class MetricsStore {
  private db: Database.Database;

  constructor(
    dbPath: string,
    private logger?: Logger
  ) {
    try {
      this.db = new Database(dbPath);
      initializeDatabase(this.db);
      this.logger?.info({ dbPath }, 'Metrics store initialized');
    } catch (error) {
      this.logger?.error({ error }, 'Failed to initialize metrics DB');
      throw error;
    }
  }

  /**
   * Record a snapshot
   *
   * @param stats - Repository statistics to record
   * @param trigger - What triggered this snapshot ('index' or 'update')
   * @returns Snapshot ID
   * @throws Error if database write fails
   */
  recordSnapshot(stats: DetailedIndexStats, trigger: 'index' | 'update'): string {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    try {
      this.db
        .prepare(
          `
        INSERT INTO snapshots 
        (id, timestamp, repository_path, stats, trigger, 
         total_files, total_documents, total_vectors, duration_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          id,
          timestamp,
          stats.repositoryPath,
          JSON.stringify(stats),
          trigger,
          stats.filesScanned,
          stats.documentsIndexed,
          stats.vectorsStored,
          stats.duration,
          timestamp
        );

      this.logger?.debug(
        {
          id,
          trigger,
          files: stats.filesScanned,
          documents: stats.documentsIndexed,
        },
        'Recorded snapshot'
      );

      return id;
    } catch (error) {
      this.logger?.error({ error }, 'Failed to record snapshot');
      throw error;
    }
  }

  /**
   * Query snapshots with filters
   *
   * @param query - Query parameters (since, until, limit, etc.)
   * @returns Array of snapshots matching the query
   */
  getSnapshots(query: SnapshotQuery): Snapshot[] {
    // Validate query with Zod
    const validated = SnapshotQuerySchema.parse(query);
    const { since, until, limit, repositoryPath, trigger } = validated;

    let sql = 'SELECT * FROM snapshots WHERE 1=1';
    const params: unknown[] = [];

    if (since) {
      sql += ' AND timestamp >= ?';
      params.push(since.getTime());
    }

    if (until) {
      sql += ' AND timestamp <= ?';
      params.push(until.getTime());
    }

    if (repositoryPath) {
      sql += ' AND repository_path = ?';
      params.push(repositoryPath);
    }

    if (trigger) {
      sql += ' AND trigger = ?';
      params.push(trigger);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      timestamp: number;
      repository_path: string;
      stats: string;
      trigger: 'index' | 'update';
    }>;

    return rows.map((row) => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      repositoryPath: row.repository_path,
      stats: JSON.parse(row.stats) as DetailedIndexStats,
      trigger: row.trigger,
    }));
  }

  /**
   * Get the latest snapshot
   *
   * @param repositoryPath - Optional repository path filter
   * @returns Latest snapshot or null if none exist
   */
  getLatestSnapshot(repositoryPath?: string): Snapshot | null {
    const snapshots = this.getSnapshots({ limit: 1, repositoryPath });
    return snapshots[0] || null;
  }

  /**
   * Get count of snapshots
   *
   * @param repositoryPath - Optional repository path filter
   * @returns Total number of snapshots
   */
  getCount(repositoryPath?: string): number {
    let sql = 'SELECT COUNT(*) as count FROM snapshots';
    const params: unknown[] = [];

    if (repositoryPath) {
      sql += ' WHERE repository_path = ?';
      params.push(repositoryPath);
    }

    const result = this.db.prepare(sql).get(...params) as { count: number };
    return result.count;
  }

  /**
   * Get a specific snapshot by ID
   *
   * @param id - Snapshot ID
   * @returns Snapshot or null if not found
   */
  getSnapshot(id: string): Snapshot | null {
    const row = this.db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as
      | {
          id: string;
          timestamp: number;
          repository_path: string;
          stats: string;
          trigger: 'index' | 'update';
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      repositoryPath: row.repository_path,
      stats: JSON.parse(row.stats) as DetailedIndexStats,
      trigger: row.trigger,
    };
  }

  /**
   * Delete old snapshots based on retention policy
   *
   * @param retentionDays - Number of days to keep
   * @returns Number of snapshots deleted
   */
  pruneOldSnapshots(retentionDays: number): number {
    const cutoff = Date.now() - retentionDays * 86400000;

    const result = this.db.prepare('DELETE FROM snapshots WHERE timestamp < ?').run(cutoff);

    if (result.changes > 0) {
      this.logger?.info(
        {
          deleted: result.changes,
          retentionDays,
        },
        'Pruned old snapshots'
      );
    }

    return result.changes;
  }

  /**
   * Calculate risk score for a file
   * Formula: (commit_count * lines_of_code) / max(author_count, 1)
   *
   * Rationale:
   * - High commit count = frequently changed (more bugs)
   * - High LOC = more complex (harder to maintain)
   * - Low author count = knowledge concentrated (bus factor risk)
   */
  private calculateRiskScore(metadata: CodeMetadata): number {
    const commitCount = metadata.commitCount || 0;
    const authorCount = Math.max(metadata.authorCount || 1, 1);
    const linesOfCode = metadata.linesOfCode;

    return (commitCount * linesOfCode) / authorCount;
  }

  /**
   * Append code metadata for a snapshot
   *
   * @param snapshotId - Snapshot ID to associate metadata with
   * @param metadata - Array of file metadata to store
   * @returns Number of records inserted
   */
  appendCodeMetadata(snapshotId: string, metadata: CodeMetadata[]): number {
    if (metadata.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO code_metadata 
      (snapshot_id, file_path, commit_count, last_modified, author_count, 
       lines_of_code, num_functions, num_imports, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insert = this.db.transaction((items: CodeMetadata[]) => {
      for (const item of items) {
        const riskScore = this.calculateRiskScore(item);
        stmt.run(
          snapshotId,
          item.filePath,
          item.commitCount || null,
          item.lastModified ? item.lastModified.getTime() : null,
          item.authorCount || null,
          item.linesOfCode,
          item.numFunctions,
          item.numImports,
          riskScore
        );
      }
    });

    try {
      insert(metadata);
      this.logger?.debug({ snapshotId, count: metadata.length }, 'Appended code metadata');
      return metadata.length;
    } catch (error) {
      this.logger?.error({ error, snapshotId }, 'Failed to append code metadata');
      throw error;
    }
  }

  /**
   * Get code metadata for a snapshot
   *
   * @param query - Query parameters
   * @returns Array of code metadata
   */
  getCodeMetadata(query: CodeMetadataQuery): CodeMetadata[] {
    let sql = 'SELECT * FROM code_metadata WHERE snapshot_id = ?';
    const params: unknown[] = [query.snapshotId];

    if (query.minRiskScore !== undefined) {
      sql += ' AND risk_score >= ?';
      params.push(query.minRiskScore);
    }

    // Sort order
    const sortBy = query.sortBy || 'risk_desc';
    switch (sortBy) {
      case 'risk_desc':
        sql += ' ORDER BY risk_score DESC';
        break;
      case 'risk_asc':
        sql += ' ORDER BY risk_score ASC';
        break;
      case 'lines_desc':
        sql += ' ORDER BY lines_of_code DESC';
        break;
      case 'commits_desc':
        sql += ' ORDER BY commit_count DESC';
        break;
    }

    sql += ' LIMIT ?';
    params.push(query.limit || 100);

    const rows = this.db.prepare(sql).all(...params) as Array<{
      file_path: string;
      commit_count: number | null;
      last_modified: number | null;
      author_count: number | null;
      lines_of_code: number;
      num_functions: number;
      num_imports: number;
      risk_score: number;
    }>;

    return rows.map((row) => ({
      filePath: row.file_path,
      commitCount: row.commit_count || undefined,
      lastModified: row.last_modified ? new Date(row.last_modified) : undefined,
      authorCount: row.author_count || undefined,
      linesOfCode: row.lines_of_code,
      numFunctions: row.num_functions,
      numImports: row.num_imports,
      riskScore: row.risk_score,
    }));
  }

  /**
   * Get code metadata for a specific file across snapshots
   *
   * @param filePath - File path to query
   * @param limit - Maximum number of snapshots to return (default: 10)
   * @returns Array of code metadata ordered by snapshot timestamp (newest first)
   */
  getCodeMetadataForFile(filePath: string, limit = 10): CodeMetadata[] {
    const sql = `
      SELECT cm.*, s.timestamp 
      FROM code_metadata cm
      JOIN snapshots s ON cm.snapshot_id = s.id
      WHERE cm.file_path = ?
      ORDER BY s.timestamp DESC
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(filePath, limit) as Array<{
      file_path: string;
      commit_count: number | null;
      last_modified: number | null;
      author_count: number | null;
      lines_of_code: number;
      num_functions: number;
      num_imports: number;
      risk_score: number;
    }>;

    return rows.map((row) => ({
      filePath: row.file_path,
      commitCount: row.commit_count || undefined,
      lastModified: row.last_modified ? new Date(row.last_modified) : undefined,
      authorCount: row.author_count || undefined,
      linesOfCode: row.lines_of_code,
      numFunctions: row.num_functions,
      numImports: row.num_imports,
      riskScore: row.risk_score,
    }));
  }

  /**
   * Get count of code metadata records for a snapshot
   *
   * @param snapshotId - Snapshot ID
   * @returns Total number of code metadata records
   */
  getCodeMetadataCount(snapshotId: string): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM code_metadata WHERE snapshot_id = ?')
      .get(snapshotId) as { count: number };
    return result.count;
  }

  /**
   * Close the database connection
   */
  close(): void {
    try {
      this.db?.close();
      this.logger?.debug({}, 'Metrics store closed');
    } catch (error) {
      this.logger?.error({ error }, 'Failed to close metrics store');
    }
  }
}
