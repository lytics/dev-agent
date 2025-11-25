/**
 * Base Adapter Class
 * All adapters (Tool, Resource, Prompt) extend from this
 *
 * Provides:
 * - Agent dispatch (route requests to subagents)
 * - Session context (ephemeral, lives for MCP server lifetime)
 * - Persistent storage (survives restarts when configured)
 * - Conversation history access
 */

import type {
  ContextManager,
  ContextManagerImpl,
  Message,
  SubagentCoordinator,
} from '@lytics/dev-agent-subagents';
import type { AdapterContext, AdapterMetadata, Logger } from './types';

export abstract class Adapter {
  /**
   * Adapter metadata (name, version, description)
   */
  abstract readonly metadata: AdapterMetadata;

  /**
   * Coordinator for routing to subagents (optional)
   */
  protected coordinator?: SubagentCoordinator;

  /**
   * Logger for adapter operations
   */
  protected logger?: Logger;

  /**
   * Initialize the adapter with context
   * Called once when adapter is registered
   */
  abstract initialize(context: AdapterContext): Promise<void>;

  /**
   * Base initialization - stores coordinator and logger
   * Subclasses should call this via super.initialize(context)
   */
  protected initializeBase(context: AdapterContext): void {
    this.coordinator = context.coordinator;
    this.logger = context.logger;
  }

  /**
   * Check if coordinator is available for agent routing
   */
  protected hasCoordinator(): boolean {
    return !!this.coordinator;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Dispatch
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dispatch a request to a subagent via the coordinator
   * @param agentName Target agent name (e.g., 'explorer', 'planner')
   * @param payload Request payload
   * @returns Agent response or null if no coordinator
   */
  protected async dispatchToAgent(
    agentName: string,
    payload: Record<string, unknown>
  ): Promise<Message | null> {
    if (!this.coordinator) {
      this.logger?.debug('No coordinator available, cannot dispatch to agent', { agentName });
      return null;
    }

    this.logger?.debug('Dispatching to agent', { agentName, payload });

    const response = await this.coordinator.sendMessage({
      type: 'request',
      sender: `adapter:${this.metadata.name}`,
      recipient: agentName,
      payload,
      priority: 5,
    });

    return response;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Session Context (Ephemeral - lives for MCP server lifetime)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the shared context manager (if coordinator available)
   */
  protected getContextManager(): ContextManager | null {
    return this.coordinator?.getContextManager() ?? null;
  }

  /**
   * Store a value in session context (ephemeral)
   * Use for: last query, current results, temporary state
   * @param key Context key
   * @param value Value to store
   */
  protected setContext(key: string, value: unknown): void {
    const ctx = this.getContextManager();
    if (ctx) {
      ctx.set(key, value);
      this.logger?.debug('Session context set', { key });
    }
  }

  /**
   * Get a value from session context
   * @param key Context key
   * @returns Stored value or undefined
   */
  protected getContext<T = unknown>(key: string): T | undefined {
    const ctx = this.getContextManager();
    return ctx?.get(key) as T | undefined;
  }

  /**
   * Check if a key exists in session context
   */
  protected hasContext(key: string): boolean {
    const ctx = this.getContextManager();
    return ctx?.has(key) ?? false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Persistent Storage (Survives restarts when configured)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the context manager implementation (for persistent storage)
   * Returns null if coordinator not available or not ContextManagerImpl
   */
  private getContextManagerImpl(): ContextManagerImpl | null {
    const ctx = this.coordinator?.getContextManager();
    // Check if it has the persistent methods (duck typing)
    if (ctx && 'getPersistent' in ctx) {
      return ctx as unknown as ContextManagerImpl;
    }
    return null;
  }

  /**
   * Store a value in persistent storage (survives restarts)
   * Use for: user preferences, learning data, cached computations
   * @param key Storage key (recommend namespacing: "adapter:key")
   * @param value Value to store (must be JSON-serializable)
   */
  protected async setPersistent(key: string, value: unknown): Promise<void> {
    const ctx = this.getContextManagerImpl();
    if (ctx) {
      await ctx.setPersistent(key, value);
      this.logger?.debug('Persistent storage set', { key });
    }
  }

  /**
   * Get a value from persistent storage
   * @param key Storage key
   * @returns Stored value or undefined
   */
  protected async getPersistent<T = unknown>(key: string): Promise<T | undefined> {
    const ctx = this.getContextManagerImpl();
    if (ctx) {
      return ctx.getPersistent<T>(key);
    }
    return undefined;
  }

  /**
   * Check if a key exists in persistent storage
   */
  protected async hasPersistent(key: string): Promise<boolean> {
    const ctx = this.getContextManagerImpl();
    if (ctx) {
      return ctx.hasPersistent(key);
    }
    return false;
  }

  /**
   * Delete a value from persistent storage
   */
  protected async deletePersistent(key: string): Promise<boolean> {
    const ctx = this.getContextManagerImpl();
    if (ctx) {
      return ctx.deletePersistent(key);
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Conversation History
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get recent conversation history
   * Useful for understanding request patterns
   * @param limit Max messages to return (default: 10)
   */
  protected getHistory(limit: number = 10): Message[] {
    const ctx = this.getContextManager();
    return ctx?.getHistory(limit) ?? [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Optional: Cleanup when adapter is unregistered or server stops
   */
  shutdown?(): Promise<void>;

  /**
   * Optional: Health check for adapter
   * @returns true if healthy, false otherwise
   */
  healthCheck?(): Promise<boolean>;
}
