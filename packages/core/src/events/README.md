# Event Bus

Event-driven communication infrastructure for the dev-agent system.

## Overview

The Event Bus provides pub/sub messaging between components, enabling loose coupling and reactive architectures. Built on Node.js `EventEmitter` with async handler support.

## Quick Start

```typescript
import { AsyncEventBus, createTypedEventBus, SystemEventMap } from '@lytics/dev-agent-core';

// Basic usage
const bus = new AsyncEventBus();

// Subscribe to events
bus.on('my.event', async (payload) => {
  console.log('Received:', payload);
});

// Emit events
await bus.emit('my.event', { data: 'hello' });

// Type-safe usage with system events
const typedBus = createTypedEventBus<SystemEventMap>();
typedBus.on('index.updated', (event) => {
  // event is typed as IndexUpdatedEvent
  console.log(`Indexed ${event.documentsCount} documents`);
});
```

## Features

### Async Handlers

All handlers can be async. Errors in one handler don't crash others.

```typescript
bus.on('data.received', async (payload) => {
  await processData(payload);
  await saveToDatabase(payload);
});
```

### Priority-Based Ordering

Handlers execute in priority order (higher first).

```typescript
bus.on('event', () => console.log('second'), { priority: 1 });
bus.on('event', () => console.log('first'), { priority: 10 });
bus.on('event', () => console.log('third'), { priority: 0 });

await bus.emit('event', {}, { waitForHandlers: true });
// Output: first, second, third
```

### Once Subscriptions

Auto-unsubscribe after first trigger.

```typescript
bus.once('startup.complete', () => {
  console.log('System started');
});
```

### Wait for Events

Promise-based event waiting with timeout.

```typescript
// Wait for an event to occur
const result = await bus.waitFor('data.ready', 5000);
console.log('Data received:', result);
```

### Fire-and-Forget vs Wait

```typescript
// Fire and forget (default)
await bus.emit('notification', { message: 'Hello' });

// Wait for all handlers to complete
await bus.emit('critical.operation', data, { waitForHandlers: true });
```

## Standard System Events

The system defines standard events for common operations:

### Index Events

| Event | Payload | Description |
|-------|---------|-------------|
| `index.updated` | `{ type, documentsCount, duration, path }` | Index scan completed |
| `index.error` | `{ type, error, recoverable }` | Index operation failed |

### Health Events

| Event | Payload | Description |
|-------|---------|-------------|
| `health.changed` | `{ component, previousStatus, currentStatus, reason }` | Component health changed |

### Agent Events

| Event | Payload | Description |
|-------|---------|-------------|
| `agent.registered` | `{ name, capabilities }` | Agent registered with coordinator |
| `agent.unregistered` | `{ name, reason }` | Agent unregistered |

### Request Events

| Event | Payload | Description |
|-------|---------|-------------|
| `request.started` | `{ requestId, tool, args, timestamp }` | MCP request started |
| `request.completed` | `{ requestId, tool, duration, success, tokenEstimate }` | Request completed |
| `request.failed` | `{ requestId, tool, duration, error }` | Request failed |

### System Events

| Event | Payload | Description |
|-------|---------|-------------|
| `system.started` | `{ version, components }` | System startup complete |
| `system.shuttingDown` | `{ reason, gracePeriod }` | System shutting down |

## API Reference

### AsyncEventBus

```typescript
class AsyncEventBus implements EventBus {
  // Subscribe to events
  on<T>(eventName: string, handler: EventHandler<T>, options?: SubscriptionOptions): Unsubscribe;
  once<T>(eventName: string, handler: EventHandler<T>): Unsubscribe;
  off<T>(eventName: string, handler: EventHandler<T>): void;

  // Emit events
  emit<T>(eventName: string, payload: T, options?: EmitOptions): Promise<void>;

  // Wait for events
  waitFor<T>(eventName: string, timeout?: number): Promise<T>;

  // Inspection
  listenerCount(eventName: string): number;
  eventNames(): string[];
  removeAllListeners(eventName?: string): void;
}
```

### Options

```typescript
interface SubscriptionOptions {
  once?: boolean;      // Auto-unsubscribe after first trigger
  priority?: number;   // Handler execution order (higher = first)
}

interface EmitOptions {
  waitForHandlers?: boolean;  // Wait for all handlers to complete
  timeout?: number;           // Timeout for waiting (ms)
}
```

## Integration with Coordinator

The `SubagentCoordinator` creates and manages an EventBus instance:

```typescript
const coordinator = new SubagentCoordinator();
const eventBus = coordinator.getEventBus();

// Subscribe to agent lifecycle events
eventBus.on('agent.registered', (event) => {
  console.log(`Agent ${event.name} is ready`);
});

// Register an agent (emits event)
await coordinator.registerAgent(myAgent);
```

## Best Practices

1. **Use descriptive event names** with dot notation: `domain.action`
2. **Keep payloads serializable** for logging and debugging
3. **Handle errors in handlers** - don't let them crash the bus
4. **Use `waitForHandlers` sparingly** - it blocks the emitter
5. **Clean up subscriptions** when components are destroyed

