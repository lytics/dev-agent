/**
 * Event Bus Module
 *
 * Provides event-driven communication for the dev-agent system.
 * Built on Node.js EventEmitter with async support.
 *
 * @example
 * ```typescript
 * import { AsyncEventBus, createTypedEventBus, SystemEventMap } from '@lytics/dev-agent-core';
 *
 * // Basic usage
 * const bus = new AsyncEventBus();
 * bus.on('my.event', (payload) => console.log(payload));
 * await bus.emit('my.event', { data: 'hello' });
 *
 * // Type-safe usage with system events
 * const typedBus = createTypedEventBus<SystemEventMap>();
 * typedBus.on('index.updated', (event) => {
 *   // event is typed as IndexUpdatedEvent
 *   console.log(`Indexed ${event.documentsCount} documents`);
 * });
 * ```
 */

export type { AsyncEventBusOptions, TypedEventBus } from './event-bus';
export { AsyncEventBus, createTypedEventBus } from './event-bus';
export type {
  // System events
  AgentRegisteredEvent,
  AgentUnregisteredEvent,
  // Core types
  EmitOptions,
  EventBus,
  EventEnvelope,
  EventHandler,
  EventMeta,
  HealthChangedEvent,
  HealthStatus,
  IndexErrorEvent,
  IndexUpdatedEvent,
  RequestCompletedEvent,
  RequestFailedEvent,
  RequestStartedEvent,
  SubscriptionOptions,
  SystemEventMap,
  SystemEventName,
  SystemShuttingDownEvent,
  SystemStartedEvent,
  Unsubscribe,
} from './types';
