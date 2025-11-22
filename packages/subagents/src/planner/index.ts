/**
 * Planner Subagent = Prefrontal Cortex
 * Plans and breaks down complex tasks (future implementation)
 */

import type { Agent, AgentContext, Message } from '../types';

export class PlannerAgent implements Agent {
  name: string = 'planner';
  capabilities: string[] = ['plan', 'break-down-tasks'];

  private context?: AgentContext;

  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
    this.name = context.agentName;
    context.logger.info('Planner agent initialized');
  }

  async handleMessage(message: Message): Promise<Message | null> {
    if (!this.context) {
      throw new Error('Planner not initialized');
    }

    // TODO: Implement actual planning logic (ticket #8)
    // For now, just acknowledge
    this.context.logger.debug('Received message', { type: message.type });

    if (message.type === 'request') {
      return {
        id: `${message.id}-response`,
        type: 'response',
        sender: this.name,
        recipient: message.sender,
        correlationId: message.id,
        payload: {
          status: 'stub',
          message: 'Planner stub - implementation pending',
        },
        priority: message.priority,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  async healthCheck(): Promise<boolean> {
    return !!this.context;
  }

  async shutdown(): Promise<void> {
    this.context?.logger.info('Planner agent shutting down');
    this.context = undefined;
  }
}
