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

  -- Code metadata table (per-file metrics for hotspot detection)
  CREATE TABLE IF NOT EXISTS code_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    
    -- Data we have or can easily get:
    commit_count INTEGER,           -- From change frequency
    last_modified INTEGER,          -- From change frequency (timestamp)
    author_count INTEGER,           -- From change frequency
    lines_of_code INTEGER,          -- Count lines during scan
    num_functions INTEGER,          -- From document count
    num_imports INTEGER,            -- From DocumentMetadata.imports
    
    -- Calculated risk score
    risk_score REAL,                -- (commit_count * lines_of_code) / max(author_count, 1)
    
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
    UNIQUE (snapshot_id, file_path)
  );

  -- Index for querying by snapshot
  CREATE INDEX IF NOT EXISTS idx_code_metadata_snapshot 
    ON code_metadata(snapshot_id);
    
  -- Index for finding hotspots (highest risk files)
  CREATE INDEX IF NOT EXISTS idx_code_metadata_risk 
    ON code_metadata(risk_score DESC);
    
  -- Index for file-specific queries
  CREATE INDEX IF NOT EXISTS idx_code_metadata_file 
    ON code_metadata(file_path);

  -- File authors table (per-file author breakdown)
  CREATE TABLE IF NOT EXISTS file_authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    author_email TEXT NOT NULL,
    commit_count INTEGER NOT NULL,
    last_commit INTEGER,  -- Timestamp of last commit by this author
    
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
    UNIQUE (snapshot_id, file_path, author_email)
  );

  -- Index for querying by snapshot
  CREATE INDEX IF NOT EXISTS idx_file_authors_snapshot 
    ON file_authors(snapshot_id);
    
  -- Index for querying by file
  CREATE INDEX IF NOT EXISTS idx_file_authors_file 
    ON file_authors(snapshot_id, file_path);
    
  -- Index for querying by author
  CREATE INDEX IF NOT EXISTS idx_file_authors_author 
    ON file_authors(author_email);
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
