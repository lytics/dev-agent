import type { Subagent, SubagentMessage, SubagentOptions } from '..';

export interface CoordinatorOptions {
  maxConcurrentTasks?: number;
}

export class SubagentCoordinator {
  private agents: Map<string, Subagent> = new Map();
  private readonly options: CoordinatorOptions;

  constructor(options: CoordinatorOptions = {}) {
    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks || 5,
    };
  }

  registerAgent(name: string, agent: Subagent, options: SubagentOptions): void {
    if (this.agents.has(name)) {
      throw new Error(`Agent with name ${name} is already registered`);
    }

    // Initialize the agent asynchronously
    agent.initialize(options).then((success) => {
      if (!success) {
        console.error(`Failed to initialize agent ${name}`);
        this.agents.delete(name);
      }
    });

    this.agents.set(name, agent);
    console.log(`Agent ${name} registered with capabilities: ${options.capabilities.join(', ')}`);
  }

  async sendMessage(message: SubagentMessage): Promise<SubagentMessage | null> {
    const agent = this.agents.get(message.recipient);

    if (!agent) {
      console.error(`Agent ${message.recipient} not found`);
      return null;
    }

    return agent.handleMessage(message);
  }

  async broadcastMessage(message: SubagentMessage): Promise<Array<SubagentMessage>> {
    const responses: Array<SubagentMessage> = [];

    for (const [name, agent] of this.agents.entries()) {
      if (name !== message.sender) {
        const response = await agent.handleMessage({
          ...message,
          recipient: name,
        });

        if (response) {
          responses.push(response);
        }
      }
    }

    return responses;
  }

  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  async shutdownAll(): Promise<void> {
    for (const [name, agent] of this.agents.entries()) {
      try {
        await agent.shutdown();
        console.log(`Agent ${name} shut down successfully`);
      } catch (error) {
        console.error(`Error shutting down agent ${name}:`, error);
      }
    }

    this.agents.clear();
  }
}
