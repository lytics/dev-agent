/**
 * Context Manager = Hippocampus (Memory Center)
 * Manages shared state and repository access for all agents
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import type { ContextManager, Message } from '../types';

export class ContextManagerImpl implements ContextManager {
  private state: Map<string, unknown> = new Map();
  private history: Message[] = [];
  private indexer: RepositoryIndexer | null = null;
  private readonly maxHistorySize: number;

  constructor(options: { maxHistorySize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize || 1000;
  }

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

  /**
   * Get value from shared state
   */
  get(key: string): unknown {
    return this.state.get(key);
  }

  /**
   * Set value in shared state
   */
  set(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  /**
   * Delete value from shared state
   */
  delete(key: string): void {
    this.state.delete(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.state.clear();
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.state.keys());
  }

  /**
   * Get conversation history
   */
  getHistory(limit?: number): Message[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Add message to history
   */
  addToHistory(message: Message): void {
    this.history.push(message);

    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get statistics about the context
   */
  getStats() {
    return {
      stateSize: this.state.size,
      historySize: this.history.length,
      maxHistorySize: this.maxHistorySize,
      hasIndexer: this.hasIndexer(),
    };
  }
}
