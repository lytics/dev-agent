/**
 * Metrics Database Schema
 *
 * SQLite schema definitions for metrics storage.
 */

import type Database from 'better-sqlite3';

/**
 * Schema version 1: Core snapshots table
 *
 * Design philosophy:
 * - Single table for MVP (snapshots)
 * - JSON storage for flexibility (no schema migrations needed)
 * - Denormalized fields for fast queries
 * - Future tables can be added without breaking this
 */
export const METRICS_SCHEMA_V1 = `
  -- Core snapshots table
  CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    repository_path TEXT NOT NULL,
    stats TEXT NOT NULL,  -- JSON serialized DetailedIndexStats
    
    -- Denormalized for fast queries (avoid parsing JSON)
    trigger TEXT CHECK(trigger IN ('index', 'update')),
    total_files INTEGER,
    total_documents INTEGER,
    total_vectors INTEGER,
    duration_ms INTEGER,
    
    created_at INTEGER NOT NULL
  );

  -- Index for time-based queries (most common)
  CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp 
    ON snapshots(timestamp DESC);
    
  -- Index for repository-specific queries
  CREATE INDEX IF NOT EXISTS idx_snapshots_repo 
    ON snapshots(repository_path, timestamp DESC);
    
  -- Index for filtering by trigger type
  CREATE INDEX IF NOT EXISTS idx_snapshots_trigger 
    ON snapshots(trigger, timestamp DESC);
`;

/**
 * Initialize database with schema and optimizations
 */
export function initializeDatabase(db: Database.Database): void {
  // Enable WAL (Write-Ahead Logging) mode for better concurrency
  // This allows readers and writers to operate concurrently
  db.pragma('journal_mode = WAL');

  // Use NORMAL synchronous mode for better performance
  // Still safe with WAL mode enabled
  db.pragma('synchronous = NORMAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create schema
  db.exec(METRICS_SCHEMA_V1);
}
