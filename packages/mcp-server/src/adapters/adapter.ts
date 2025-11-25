/**
 * Base Adapter Class
 * All adapters (Tool, Resource, Prompt) extend from this
 *
 * Provides:
 * - Agent dispatch (route requests to subagents)
 * - Context sharing (read/write shared state)
 * - Conversation history access
 */

import type { ContextManager, Message, SubagentCoordinator } from '@lytics/dev-agent-subagents';
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
  // Context Sharing (Phase 3)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the shared context manager (if coordinator available)
   */
  protected getContextManager(): ContextManager | null {
    return this.coordinator?.getContextManager() ?? null;
  }

  /**
   * Store a value in shared context
   * Allows adapters to share state across requests
   * @param key Context key
   * @param value Value to store
   */
  protected setContext(key: string, value: unknown): void {
    const ctx = this.getContextManager();
    if (ctx) {
      ctx.set(key, value);
      this.logger?.debug('Context set', { key });
    }
  }

  /**
   * Get a value from shared context
   * @param key Context key
   * @returns Stored value or undefined
   */
  protected getContext<T = unknown>(key: string): T | undefined {
    const ctx = this.getContextManager();
    return ctx?.get(key) as T | undefined;
  }

  /**
   * Check if a key exists in shared context
   */
  protected hasContext(key: string): boolean {
    const ctx = this.getContextManager();
    return ctx?.has(key) ?? false;
  }

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
