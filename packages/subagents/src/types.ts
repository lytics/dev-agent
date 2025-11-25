/**
 * Core types for the Subagent Coordinator (Central Nervous System)
 * Inspired by human physiology - neurons, synapses, action potentials
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';

/**
 * Message = Action Potential
 * Carries information between agents (neurons)
 */
export interface Message {
  /** Unique message ID (like a neuron firing sequence) */
  id: string;

  /** Message type (neurotransmitter type) */
  type: MessageType;

  /** Who sent this (source neuron) */
  sender: string;

  /** Who should receive this (target neuron) */
  recipient: string;

  /** Correlation ID for request/response matching (synaptic connection) */
  correlationId?: string;

  /** Message payload (signal strength & content) */
  payload: Record<string, unknown>;

  /** Priority (0-10, like signal urgency) */
  priority: number;

  /** When this message was created */
  timestamp: number;

  /** Optional timeout in ms */
  timeout?: number;
}

export type MessageType =
  | 'request' // Ask for action
  | 'response' // Reply to request
  | 'event' // Broadcast information
  | 'error' // Error occurred
  | 'heartbeat'; // Agent health check

/**
 * Agent = Specialized Brain Region
 * Each agent has specific capabilities (like motor cortex, visual cortex)
 */
export interface Agent {
  /** Unique agent name */
  name: string;

  /** What this agent can do (capabilities) */
  capabilities: string[];

  /** Initialize the agent */
  initialize(context: AgentContext): Promise<void>;

  /** Handle incoming messages (receive action potentials) */
  handleMessage(message: Message): Promise<Message | null>;

  /** Check if agent is healthy */
  healthCheck(): Promise<boolean>;

  /** Shutdown the agent */
  shutdown(): Promise<void>;
}

/**
 * Agent Context = Working Memory
 * What an agent needs to function
 */
export interface AgentContext {
  /** Agent's own name */
  agentName: string;

  /** Access to shared context (hippocampus) */
  contextManager: ContextManager;

  /** Send messages to other agents */
  sendMessage: (message: Omit<Message, 'id' | 'timestamp' | 'sender'>) => Promise<Message | null>;

  /** Broadcast to all agents */
  broadcastMessage: (
    message: Omit<Message, 'id' | 'timestamp' | 'sender' | 'recipient'>
  ) => Promise<Message[]>;

  /** Logger for structured logging */
  logger: Logger;
}

/**
 * Context Manager = Hippocampus (Memory Center)
 * Stores and retrieves shared information
 */
export interface ContextManager {
  /** Get repository indexer (long-term memory of code) */
  getIndexer(): RepositoryIndexer;

  /** Get/set shared state */
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  has(key: string): boolean;

  /** Get conversation history */
  getHistory(limit?: number): Message[];

  /** Add to conversation history */
  addToHistory(message: Message): void;
}

/**
 * Task = Motor Command
 * Work to be done by an agent
 */
export interface Task {
  /** Unique task ID */
  id: string;

  /** Task type/action */
  type: string;

  /** Which agent should handle this */
  agentName: string;

  /** Task payload */
  payload: Record<string, unknown>;

  /** Priority (0-10) */
  priority: number;

  /** Status */
  status: TaskStatus;

  /** When created */
  createdAt: number;

  /** When started */
  startedAt?: number;

  /** When completed */
  completedAt?: number;

  /** Result (if completed) */
  result?: unknown;

  /** Error (if failed) */
  error?: Error;

  /** Number of retry attempts */
  retries: number;

  /** Max retries allowed */
  maxRetries: number;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Coordinator Options = Brain Configuration
 */
export interface CoordinatorOptions {
  /** Maximum concurrent tasks (parallel processing) */
  maxConcurrentTasks?: number;

  /** Message timeout in ms (synaptic delay tolerance) */
  defaultMessageTimeout?: number;

  /** Task retry attempts */
  defaultMaxRetries?: number;

  /** Enable health checks */
  healthCheckInterval?: number;

  /** Logger configuration */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Log Level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger = Observability
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  child?(childContext: string): Logger;
}

/**
 * Coordinator Stats = Neural Activity Metrics
 */
export interface CoordinatorStats {
  /** Number of registered agents */
  agentCount: number;

  /** Messages sent/received */
  messagesSent: number;
  messagesReceived: number;
  messageErrors: number;

  /** Task statistics */
  tasksQueued: number;
  tasksRunning: number;
  tasksCompleted: number;
  tasksFailed: number;

  /** Average response time */
  avgResponseTime: number;

  /** Uptime in ms */
  uptime: number;
}
