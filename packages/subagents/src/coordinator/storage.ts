/**
 * Storage Adapter Interface
 *
 * Pluggable persistence strategy for the ContextManager.
 * Default implementation is in-memory (ephemeral).
 * Can be extended for file, Redis, SQLite, cloud storage, etc.
 *
 * Design Principles:
 * - Async-first (even MemoryAdapter returns Promises for interface consistency)
 * - Simple key-value semantics
 * - Lifecycle hooks for initialization/cleanup
 */

/**
 * Storage adapter interface
 * All storage implementations must implement this interface
 */
export interface StorageAdapter {
  /**
   * Get a value by key
   * @returns The stored value, or undefined if not found
   */
  get(key: string): Promise<unknown | undefined>;

  /**
   * Set a value by key
   * @param key Storage key
   * @param value Value to store (must be JSON-serializable for persistent adapters)
   */
  set(key: string, value: unknown): Promise<void>;

  /**
   * Delete a value by key
   * @returns true if the key existed and was deleted
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Get all keys (optionally filtered by prefix)
   * @param prefix Optional prefix to filter keys
   */
  keys(prefix?: string): Promise<string[]>;

  /**
   * Clear all stored values (optionally filtered by prefix)
   * @param prefix Optional prefix to filter which keys to clear
   */
  clear(prefix?: string): Promise<void>;

  /**
   * Get the number of stored items
   */
  size(): Promise<number>;

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the storage adapter
   * Called once when the adapter is first used
   */
  initialize?(): Promise<void>;

  /**
   * Shutdown the storage adapter
   * Called when the coordinator is stopping
   * Persistent adapters should flush any pending writes here
   */
  shutdown?(): Promise<void>;
}

/**
 * In-Memory Storage Adapter
 *
 * Default implementation - fast, ephemeral.
 * Good for:
 * - Session state ("last query", "current context")
 * - Caching expensive computations
 * - Testing
 *
 * Not suitable for:
 * - Data that should survive restarts
 * - User preferences
 * - Learning/adaptation data
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, unknown>();

  async get(key: string): Promise<unknown | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    if (prefix) {
      return allKeys.filter((k) => k.startsWith(prefix));
    }
    return allKeys;
  }

  async clear(prefix?: string): Promise<void> {
    if (prefix) {
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) {
          this.store.delete(key);
        }
      }
    } else {
      this.store.clear();
    }
  }

  async size(): Promise<number> {
    return this.store.size;
  }

  // No-op lifecycle methods for in-memory storage
  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

/**
 * Composite Storage Adapter
 *
 * Combines multiple storage adapters with different purposes:
 * - session: Fast, ephemeral (MemoryStorageAdapter)
 * - persistent: Durable, survives restarts (FileStorageAdapter, etc.)
 *
 * Keys are namespaced by storage type:
 * - "session:lastQuery" → session storage
 * - "persistent:userPrefs" → persistent storage
 * - "lastQuery" (no prefix) → defaults to session
 */
export class CompositeStorageAdapter implements StorageAdapter {
  private session: StorageAdapter;
  private persistent: StorageAdapter;

  constructor(options: { session?: StorageAdapter; persistent?: StorageAdapter } = {}) {
    this.session = options.session ?? new MemoryStorageAdapter();
    this.persistent = options.persistent ?? new MemoryStorageAdapter();
  }

  private getAdapter(key: string): { adapter: StorageAdapter; cleanKey: string } {
    if (key.startsWith('persistent:')) {
      return { adapter: this.persistent, cleanKey: key.slice(11) };
    }
    if (key.startsWith('session:')) {
      return { adapter: this.session, cleanKey: key.slice(8) };
    }
    // Default to session storage
    return { adapter: this.session, cleanKey: key };
  }

  async get(key: string): Promise<unknown | undefined> {
    const { adapter, cleanKey } = this.getAdapter(key);
    return adapter.get(cleanKey);
  }

  async set(key: string, value: unknown): Promise<void> {
    const { adapter, cleanKey } = this.getAdapter(key);
    return adapter.set(cleanKey, value);
  }

  async delete(key: string): Promise<boolean> {
    const { adapter, cleanKey } = this.getAdapter(key);
    return adapter.delete(cleanKey);
  }

  async has(key: string): Promise<boolean> {
    const { adapter, cleanKey } = this.getAdapter(key);
    return adapter.has(cleanKey);
  }

  async keys(prefix?: string): Promise<string[]> {
    // Get keys from both adapters with their prefixes
    const sessionKeys = (await this.session.keys(prefix)).map((k) => `session:${k}`);
    const persistentKeys = (await this.persistent.keys(prefix)).map((k) => `persistent:${k}`);
    return [...sessionKeys, ...persistentKeys];
  }

  async clear(prefix?: string): Promise<void> {
    await Promise.all([this.session.clear(prefix), this.persistent.clear(prefix)]);
  }

  async size(): Promise<number> {
    const [sessionSize, persistentSize] = await Promise.all([
      this.session.size(),
      this.persistent.size(),
    ]);
    return sessionSize + persistentSize;
  }

  async initialize(): Promise<void> {
    await Promise.all([this.session.initialize?.(), this.persistent.initialize?.()]);
  }

  async shutdown(): Promise<void> {
    await Promise.all([this.session.shutdown?.(), this.persistent.shutdown?.()]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Direct access to underlying adapters (for advanced use cases)
  // ─────────────────────────────────────────────────────────────────────────

  getSessionAdapter(): StorageAdapter {
    return this.session;
  }

  getPersistentAdapter(): StorageAdapter {
    return this.persistent;
  }
}
