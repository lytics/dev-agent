// Subagents package entry point
export * from './coordinator';
export * from './planner';
export * from './explorer';
export * from './pr';

// Shared interfaces
export interface SubagentOptions {
  name: string;
  capabilities: string[];
}

export interface SubagentMessage {
  type: 'request' | 'response' | 'event';
  sender: string;
  recipient: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface Subagent {
  initialize(options: SubagentOptions): Promise<boolean>;
  handleMessage(message: SubagentMessage): Promise<SubagentMessage | null>;
  shutdown(): Promise<void>;
}
