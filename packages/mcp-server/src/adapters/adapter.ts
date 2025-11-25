/**
 * Base Adapter Class
 * All adapters (Tool, Resource, Prompt) extend from this
 */

import type { Message, SubagentCoordinator } from '@lytics/dev-agent-subagents';
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
