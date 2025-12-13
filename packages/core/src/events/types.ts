/**
 * Event Bus Types
 *
 * Type definitions for the event-driven communication system.
 * Designed for Node.js async patterns.
 */

import type { DetailedIndexStats } from '../indexer/types.js';
import type { CodeMetadata } from '../metrics/types.js';

/**
 * Event handler function type
 * All handlers are async to support non-blocking operations
 */
export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * Unsubscribe function returned when subscribing to events
 */
export type Unsubscribe = () => void;

/**
 * Event subscription options
 */
export interface SubscriptionOptions {
  /** Only trigger once, then auto-unsubscribe */
  once?: boolean;
  /** Priority for handler execution order (higher = first, default: 0) */
  priority?: number;
}

/**
 * Event emission options
 */
export interface EmitOptions {
  /** Wait for all handlers to complete before resolving */
  waitForHandlers?: boolean;
  /** Timeout for waiting (ms), only applies if waitForHandlers is true */
  timeout?: number;
}

/**
 * Event metadata attached to every event
 */
export interface EventMeta {
  /** Unique event ID */
  eventId: string;
  /** Timestamp when event was emitted */
  timestamp: number;
  /** Source component that emitted the event */
  source?: string;
}

/**
 * Full event envelope (payload + metadata)
 */
export interface EventEnvelope<T = unknown> {
  /** Event name */
  name: string;
  /** Event payload */
  payload: T;
  /** Event metadata */
  meta: EventMeta;
}

/**
 * Event Bus interface
 *
 * Provides pub/sub communication between components.
 * All operations are async-friendly.
 */
export interface EventBus {
  /**
   * Subscribe to an event
   * @param eventName Event name to subscribe to
   * @param handler Handler function to call when event is emitted
   * @param options Subscription options
   * @returns Unsubscribe function
   */
  on<T = unknown>(
    eventName: string,
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Unsubscribe;

  /**
   * Subscribe to an event once (auto-unsubscribes after first trigger)
   * @param eventName Event name to subscribe to
   * @param handler Handler function to call when event is emitted
   * @returns Unsubscribe function
   */
  once<T = unknown>(eventName: string, handler: EventHandler<T>): Unsubscribe;

  /**
   * Unsubscribe from an event
   * @param eventName Event name to unsubscribe from
   * @param handler Handler function to remove
   */
  off<T = unknown>(eventName: string, handler: EventHandler<T>): void;

  /**
   * Emit an event
   * @param eventName Event name to emit
   * @param payload Event payload
   * @param options Emission options
   */
  emit<T = unknown>(eventName: string, payload: T, options?: EmitOptions): Promise<void>;

  /**
   * Wait for an event to occur
   * @param eventName Event name to wait for
   * @param timeout Timeout in ms (default: 30000)
   * @returns Promise that resolves with the event payload
   */
  waitFor<T = unknown>(eventName: string, timeout?: number): Promise<T>;

  /**
   * Get the number of listeners for an event
   * @param eventName Event name to check
   */
  listenerCount(eventName: string): number;

  /**
   * Get all registered event names
   */
  eventNames(): string[];

  /**
   * Remove all listeners for an event, or all events if no name provided
   * @param eventName Optional event name to clear
   */
  removeAllListeners(eventName?: string): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard System Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Index-related events
 */
export interface IndexUpdatedEvent {
  type: 'code' | 'github';
  documentsCount: number;
  duration: number;
  path: string;
  /** Full statistics snapshot */
  stats: DetailedIndexStats;
  /** Whether this was an incremental update (vs full index) */
  isIncremental?: boolean;
  /** Per-file code metadata for metrics storage */
  codeMetadata?: CodeMetadata[];
  /** Per-file author contributions for ownership tracking */
  authorContributions?: Map<
    string,
    Array<{ authorEmail: string; commitCount: number; lastCommit: Date | null }>
  >;
}

export interface IndexErrorEvent {
  type: 'code' | 'github';
  error: string;
  recoverable: boolean;
}

/**
 * Health-related events
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthChangedEvent {
  component: string;
  previousStatus: HealthStatus;
  currentStatus: HealthStatus;
  reason?: string;
}

/**
 * Agent lifecycle events
 */
export interface AgentRegisteredEvent {
  name: string;
  capabilities: string[];
}

export interface AgentUnregisteredEvent {
  name: string;
  reason?: string;
}

/**
 * Request lifecycle events
 */
export interface RequestStartedEvent {
  requestId: string;
  tool: string;
  args: Record<string, unknown>;
  timestamp: number;
}

export interface RequestCompletedEvent {
  requestId: string;
  tool: string;
  duration: number;
  success: boolean;
  tokenEstimate?: number;
}

export interface RequestFailedEvent {
  requestId: string;
  tool: string;
  error: string;
  duration: number;
}

/**
 * System events
 */
export interface SystemStartedEvent {
  version: string;
  components: string[];
}

export interface SystemShuttingDownEvent {
  reason: 'user' | 'error' | 'signal';
  gracePeriod: number;
}

/**
 * Map of standard event names to their payload types
 * Use this for type-safe event handling
 */
export interface SystemEventMap {
  // Index events
  'index.updated': IndexUpdatedEvent;
  'index.error': IndexErrorEvent;

  // Health events
  'health.changed': HealthChangedEvent;

  // Agent events
  'agent.registered': AgentRegisteredEvent;
  'agent.unregistered': AgentUnregisteredEvent;

  // Request events
  'request.started': RequestStartedEvent;
  'request.completed': RequestCompletedEvent;
  'request.failed': RequestFailedEvent;

  // System events
  'system.started': SystemStartedEvent;
  'system.shuttingDown': SystemShuttingDownEvent;
}

/**
 * Type-safe event names
 */
export type SystemEventName = keyof SystemEventMap;
