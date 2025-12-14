# Observability

Request tracking, structured logging, and metrics for the dev-agent system.

## Overview

The observability module provides tools to understand what's happening in the system:

- **RequestTracker**: Track request lifecycle and calculate metrics
- **ObservableLogger**: Structured logging with request correlation
- **EventBus Integration**: Emit events for real-time monitoring

## Quick Start

```typescript
import {
  createLogger,
  createRequestTracker,
  AsyncEventBus
} from '@lytics/dev-agent-core';

// Create a logger
const logger = createLogger({
  component: 'my-adapter',
  level: 'debug',
  format: 'pretty'  // or 'json'
});

// Log with context
logger.info('Processing request', { tool: 'dev_search', query: 'auth' });

// Track requests
const eventBus = new AsyncEventBus();
const tracker = createRequestTracker({ eventBus });

const ctx = tracker.startRequest('dev_search', { query: 'auth' });
// ... do work ...
tracker.completeRequest(ctx.requestId, tokenEstimate);

// Get metrics
const metrics = tracker.getMetrics();
console.log(`P95 latency: ${metrics.p95Duration}ms`);
```

## ObservableLogger

### Log Levels

```typescript
logger.debug('Detailed info for debugging');
logger.info('Normal operational messages');
logger.warn('Something unexpected but handled');
logger.error('Something failed', error);
```

### Request Correlation

Track logs across a request lifecycle:

```typescript
const scoped = logger.withRequest(requestId);
scoped.info('Starting search');      // [req-abc123] Starting search
scoped.debug('Found 42 results');    // [req-abc123] Found 42 results
scoped.info('Search complete');      // [req-abc123] Search complete
```

### Child Loggers

Create component-specific loggers:

```typescript
const parentLogger = createLogger({ component: 'mcp-server' });
const adapterLogger = parentLogger.child('search-adapter');
// Logs as: [mcp-server:search-adapter]
```

### Timing Operations

```typescript
// Manual timing
const timer = logger.startTimer('database-query');
await db.query(sql);
const duration = timer.stop();  // Logs: "database-query completed (42ms)"

// Auto-timed operations
const result = await logger.time('expensive-operation', async () => {
  return await doExpensiveWork();
});
// Logs: "expensive-operation completed (150ms)"
// On error: "expensive-operation failed (12ms)" + error details
```

### Output Formats

**Pretty (default)** - Human-readable with colors:
```
[14:32:05] INFO  [mcp-server:adapter] (req-abc1) Processing search {"query":"auth"}
```

**JSON** - Machine-readable for log aggregation:
```json
{"timestamp":"2024-01-15T14:32:05.123Z","level":"info","component":"mcp-server:adapter","requestId":"req-abc123","message":"Processing search","data":{"query":"auth"}}
```

## RequestTracker

### Track Request Lifecycle

```typescript
const tracker = createRequestTracker({ eventBus, maxHistory: 1000 });

// Start tracking
const ctx = tracker.startRequest('dev_search', { query: 'auth' });
// ctx = { requestId: 'uuid', startTime: 1234567890, tool: 'dev_search', args: {...} }

// On success
tracker.completeRequest(ctx.requestId, tokenEstimate);

// On failure
tracker.failRequest(ctx.requestId, 'Timeout after 30s');
```

### Nested Requests

Track parent-child relationships:

```typescript
const parent = tracker.startRequest('dev_plan', { issue: 42 });
const child = tracker.startRequest('dev_inspect', { action: 'compare' }, parent.requestId);
// child.parentId === parent.requestId
```

### Metrics

```typescript
const metrics = tracker.getMetrics();
// {
//   total: 1000,
//   success: 980,
//   failed: 20,
//   avgDuration: 145,
//   p50Duration: 120,
//   p95Duration: 350,
//   p99Duration: 890,
//   byTool: {
//     'dev_search': { count: 500, avgDuration: 100 },
//     'dev_inspect': { count: 300, avgDuration: 200 },
//     'dev_plan': { count: 200, avgDuration: 180 }
//   }
// }
```

### Active Requests

```typescript
// Get all active requests
const active = tracker.getActiveRequests();

// Get count
const count = tracker.getActiveCount();

// Get specific request
const ctx = tracker.getRequest(requestId);
```

## Event Integration

The RequestTracker emits events for real-time monitoring:

```typescript
const eventBus = new AsyncEventBus();
const tracker = createRequestTracker({ eventBus });

// Listen to request events
eventBus.on('request.started', (event) => {
  console.log(`Request ${event.requestId} started: ${event.tool}`);
});

eventBus.on('request.completed', (event) => {
  console.log(`Request ${event.requestId} completed in ${event.duration}ms`);
});

eventBus.on('request.failed', (event) => {
  console.error(`Request ${event.requestId} failed: ${event.error}`);
});
```

## API Reference

### createLogger

```typescript
function createLogger(config?: Partial<LoggerConfig>): ObservableLogger;

interface LoggerConfig {
  level: LogLevel;        // 'debug' | 'info' | 'warn' | 'error'
  format: LogFormat;      // 'pretty' | 'json'
  component: string;      // Component name for log prefix
  timestamps?: boolean;   // Include timestamps (default: true)
  colors?: boolean;       // ANSI colors in pretty mode (default: true)
}
```

### createRequestTracker

```typescript
function createRequestTracker(config?: RequestTrackerConfig): RequestTracker;

interface RequestTrackerConfig {
  eventBus?: EventBus;    // Optional event bus for emitting events
  maxHistory?: number;    // Max completed requests to keep (default: 1000)
}
```

### Types

```typescript
interface RequestContext {
  requestId: string;
  startTime: number;
  tool: string;
  args: Record<string, unknown>;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

interface RequestMetrics {
  total: number;
  success: number;
  failed: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  byTool: Record<string, { count: number; avgDuration: number }>;
}
```

## Best Practices

1. **Use request IDs everywhere** - Pass them through the call stack
2. **Log at appropriate levels** - Debug for details, Info for operations, Warn for issues
3. **Include context in logs** - Tool name, query params, durations
4. **Track all requests** - Start/complete/fail for accurate metrics
5. **Clean up history** - Call `clearHistory()` periodically if needed
6. **Use JSON format in production** - Easier to parse and aggregate

