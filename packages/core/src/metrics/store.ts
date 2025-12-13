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
import { type Snapshot, type SnapshotQuery, SnapshotQuerySchema } from './types.js';

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
