/**
 * Context Manager = Hippocampus (Memory Center)
 * Manages shared state and repository access for all agents
 *
 * Uses pluggable StorageAdapter for state persistence:
 * - Default: MemoryStorageAdapter (fast, ephemeral)
 * - Can be configured with FileStorageAdapter, etc. for durability
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import type { ContextManager, Message } from '../types';
import { MemoryStorageAdapter, type StorageAdapter } from './storage';
import { CircularBuffer } from './utils/circular-buffer';

/**
 * Options for ContextManager
 */
export interface ContextManagerOptions {
  /** Maximum number of messages to keep in history */
  maxHistorySize?: number;
  /** Storage adapter for session state (default: MemoryStorageAdapter) */
  sessionStorage?: StorageAdapter;
  /** Storage adapter for persistent state (default: MemoryStorageAdapter) */
  persistentStorage?: StorageAdapter;
}

export class ContextManagerImpl implements ContextManager {
  private sessionStorage: StorageAdapter;
  private persistentStorage: StorageAdapter;
  private history: CircularBuffer<Message>;
  private indexer: RepositoryIndexer | null = null;

  constructor(options: ContextManagerOptions = {}) {
    const maxHistorySize = options.maxHistorySize ?? 1000;
    this.history = new CircularBuffer<Message>(maxHistorySize);
    this.sessionStorage = options.sessionStorage ?? new MemoryStorageAdapter();
    this.persistentStorage = options.persistentStorage ?? new MemoryStorageAdapter();
  }

  /**
   * Initialize the context manager and its storage adapters
   */
  async initialize(): Promise<void> {
    await Promise.all([this.sessionStorage.initialize?.(), this.persistentStorage.initialize?.()]);
  }

  /**
   * Shutdown the context manager and flush storage
   */
  async shutdown(): Promise<void> {
    await Promise.all([this.sessionStorage.shutdown?.(), this.persistentStorage.shutdown?.()]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Repository Indexer (Long-term memory of code)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the repository indexer (long-term memory of code)
   */
  setIndexer(indexer: RepositoryIndexer): void {
    this.indexer = indexer;
  }

  /**
   * Get the repository indexer
   */
  getIndexer(): RepositoryIndexer {
    if (!this.indexer) {
      throw new Error('Repository indexer not initialized. Call setIndexer first.');
    }
    return this.indexer;
  }

  /**
   * Check if indexer is available
   */
  hasIndexer(): boolean {
    return this.indexer !== null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Session State (Ephemeral - lives for MCP server lifetime)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get value from session state (synchronous for backwards compatibility)
   * For async access, use getAsync()
   */
  get(key: string): unknown {
    // Synchronous fallback for backwards compatibility
    // MemoryStorageAdapter.get() returns a Promise that resolves immediately
    let result: unknown;
    void this.sessionStorage.get(key).then((v) => {
      result = v;
    });
    return result;
  }

  /**
   * Get value from session state (async)
   */
  async getAsync(key: string): Promise<unknown> {
    return this.sessionStorage.get(key);
  }

  /**
   * Set value in session state (synchronous for backwards compatibility)
   */
  set(key: string, value: unknown): void {
    void this.sessionStorage.set(key, value);
  }

  /**
   * Set value in session state (async)
   */
  async setAsync(key: string, value: unknown): Promise<void> {
    return this.sessionStorage.set(key, value);
  }

  /**
   * Delete value from session state
   */
  delete(key: string): void {
    void this.sessionStorage.delete(key);
  }

  /**
   * Check if key exists in session state
   */
  has(key: string): boolean {
    // Synchronous fallback
    let result = false;
    void this.sessionStorage.has(key).then((v) => {
      result = v;
    });
    return result;
  }

  /**
   * Check if key exists (async)
   */
  async hasAsync(key: string): Promise<boolean> {
    return this.sessionStorage.has(key);
  }

  /**
   * Clear all session state
   */
  clear(): void {
    void this.sessionStorage.clear();
  }

  /**
   * Get all keys from session state
   */
  keys(): string[] {
    // Synchronous fallback
    let result: string[] = [];
    void this.sessionStorage.keys().then((v) => {
      result = v;
    });
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Persistent State (Survives restarts when configured with durable storage)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get value from persistent storage
   */
  async getPersistent<T = unknown>(key: string): Promise<T | undefined> {
    return (await this.persistentStorage.get(key)) as T | undefined;
  }

  /**
   * Set value in persistent storage
   */
  async setPersistent(key: string, value: unknown): Promise<void> {
    return this.persistentStorage.set(key, value);
  }

  /**
   * Delete value from persistent storage
   */
  async deletePersistent(key: string): Promise<boolean> {
    return this.persistentStorage.delete(key);
  }

  /**
   * Check if key exists in persistent storage
   */
  async hasPersistent(key: string): Promise<boolean> {
    return this.persistentStorage.has(key);
  }

  /**
   * Get all keys from persistent storage
   */
  async keysPersistent(prefix?: string): Promise<string[]> {
    return this.persistentStorage.keys(prefix);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Conversation History
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get conversation history
   */
  getHistory(limit?: number): Message[] {
    if (limit) {
      return this.history.getRecent(limit);
    }
    return this.history.getAll();
  }

  /**
   * Add message to history (automatic overflow handling via circular buffer)
   */
  addToHistory(message: Message): void {
    this.history.push(message);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.clear();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Storage Adapter Access (for advanced use cases)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the session storage adapter
   */
  getSessionStorage(): StorageAdapter {
    return this.sessionStorage;
  }

  /**
   * Get the persistent storage adapter
   */
  getPersistentStorage(): StorageAdapter {
    return this.persistentStorage;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get statistics about the context
   */
  async getStats(): Promise<{
    sessionSize: number;
    persistentSize: number;
    historySize: number;
    maxHistorySize: number;
    hasIndexer: boolean;
  }> {
    const [sessionSize, persistentSize] = await Promise.all([
      this.sessionStorage.size(),
      this.persistentStorage.size(),
    ]);

    return {
      sessionSize,
      persistentSize,
      historySize: this.history.size(),
      maxHistorySize: this.history.getMaxSize(),
      hasIndexer: this.hasIndexer(),
    };
  }
}
