# @lytics/dev-agent-subagents

**The Central Nervous System** for dev-agent's multi-agent coordination.

## Overview

The subagents package provides a robust, production-ready coordinator system for managing specialized AI agents. Inspired by human physiology, each component mirrors a part of the nervous system:

- **🧠 Coordinator** - The brain, orchestrating all agents
- **🔬 Context Manager** - The hippocampus, managing shared memory
- **⚡ Task Queue** - The motor cortex, controlling execution
- **📊 Logger** - Observability system (future: `@lytics/croak`)

## Architecture

```
packages/subagents/
├── coordinator/           # Central Nervous System
│   ├── coordinator.ts    # Main orchestrator
│   ├── context-manager.ts # Shared state & repository access
│   └── task-queue.ts     # Task execution & concurrency
│
├── logger/               # Structured logging (extractable)
│   └── index.ts         
│
├── planner/              # Planning agent (stub)
├── explorer/             # Code exploration agent (stub)
├── pr/                   # GitHub PR agent (stub)
│
└── types.ts              # Shared interfaces
```

### Self-Contained Design

Each folder is designed to be:
- **Tree-shakable** - Import only what you need
- **Extractable** - Easy to pull out into separate packages
- **Independent** - Minimal cross-dependencies
- **Testable** - Comprehensive test coverage (90%+)

## Core Components

### SubagentCoordinator

The main orchestrator that manages agent lifecycle, message passing, and task execution.

```typescript
import { SubagentCoordinator, PlannerAgent } from '@lytics/dev-agent-subagents';

// Initialize coordinator
const coordinator = new SubagentCoordinator();
await coordinator.initialize({
  repositoryPath: '/path/to/repo',
  vectorStorePath: '/path/to/vectors',
  maxConcurrentTasks: 5,
});

// Register agents
coordinator.registerAgent(new PlannerAgent());

// Send messages
const response = await coordinator.sendMessage({
  id: 'msg-1',
  type: 'request',
  sender: 'user',
  recipient: 'planner',
  payload: { action: 'create-plan', goal: 'Implement authentication' },
  timestamp: Date.now(),
});

// Get stats
const stats = coordinator.getStats();
console.log(`Active agents: ${stats.agentsRegistered}`);
```

### ContextManager

Manages shared state, repository access, and message history.

```typescript
import { ContextManagerImpl } from '@lytics/dev-agent-subagents';

const context = new ContextManagerImpl({ maxHistorySize: 1000 });

// Store shared state
context.set('currentPhase', 'planning');
const phase = context.get('currentPhase');

// Message history
context.addToHistory(message);
const recent = context.getHistory(10); // Last 10 messages

// Repository access
context.setIndexer(repositoryIndexer);
const indexer = context.getIndexer();
```

### TaskQueue

Priority-based task queue with concurrency control and retry logic.

```typescript
import { TaskQueue, CoordinatorLogger } from '@lytics/dev-agent-subagents';

const logger = new CoordinatorLogger('my-app', 'info');
const queue = new TaskQueue(3, logger); // max 3 concurrent

// Enqueue tasks
queue.enqueue({
  id: 'task-1',
  type: 'analyze-code',
  agentName: 'explorer',
  payload: { file: 'src/index.ts' },
  priority: 8, // 0-10, higher = more priority
  status: 'pending',
  createdAt: Date.now(),
  retries: 0,
  maxRetries: 3,
});

// Execute tasks
const next = queue.getNext(); // Highest priority pending task
if (next && queue.canRunMore()) {
  queue.markRunning(next.id);
  // ... execute task ...
  queue.markCompleted(next.id, result);
}

// Retry failed tasks
if (queue.shouldRetry('task-1')) {
  queue.retry('task-1');
}

// Stats
const stats = queue.getStats();
console.log(`Pending: ${stats.pending}, Running: ${stats.running}`);
```

### Logger

Structured logging with context and log levels (future: `@lytics/croak`).

```typescript
import { CoordinatorLogger } from '@lytics/dev-agent-subagents';

const logger = new CoordinatorLogger('my-service', 'info');

logger.info('Service started', { port: 3000 });
logger.warn('High memory usage', { usage: '85%' });
logger.error('Connection failed', error, { retries: 3 });

// Child loggers
const childLogger = logger.child('database');
childLogger.debug('Query executed', { duration: '45ms' });
```

## Message Protocol

All agent communication uses standardized messages:

```typescript
interface Message {
  id: string;              // Unique message ID
  type: 'request' | 'response' | 'event' | 'error';
  sender: string;          // Agent name or 'user'
  recipient: string;       // Target agent name
  payload: Record<string, unknown>;
  timestamp: number;
  correlationId?: string;  // Link responses to requests
  priority?: number;       // 0-10, for task scheduling
  timeout?: number;        // ms, for requests
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}
```

## Agent Interface

All agents implement the `Agent` interface:

```typescript
interface Agent {
  name: string;
  capabilities: string[];
  
  initialize(context: AgentContext): Promise<void>;
  handleMessage(message: Message): Promise<Message | null>;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
}
```

### Creating a Custom Agent

```typescript
import type { Agent, AgentContext, Message } from '@lytics/dev-agent-subagents';

class MyCustomAgent implements Agent {
  name = 'my-agent';
  capabilities = ['analyze', 'summarize'];
  private context?: AgentContext;

  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
    this.name = context.agentName;
    context.logger.info('Agent initialized');
  }

  async handleMessage(message: Message): Promise<Message | null> {
    if (!this.context) {
      throw new Error('Agent not initialized');
    }

    // Use repository indexer
    const results = await this.context.indexer.search(
      message.payload.query as string,
      { limit: 5 }
    );

    // Return response
    return {
      id: `${message.id}-response`,
      type: 'response',
      sender: this.name,
      recipient: message.sender,
      correlationId: message.id,
      payload: { results },
      timestamp: Date.now(),
    };
  }

  async healthCheck(): Promise<boolean> {
    return !!this.context;
  }

  async shutdown(): Promise<void> {
    this.context?.logger.info('Agent shutting down');
    this.context = undefined;
  }
}
```

## Current Agents

### Planner (Stub)
- **Status**: Basic stub implementation
- **Capabilities**: `['plan', 'break-down-tasks']`
- **Future**: Convert GitHub issues to actionable tasks

### Explorer (Stub)
- **Status**: Basic stub implementation
- **Capabilities**: `['explore', 'analyze-patterns', 'find-similar']`
- **Future**: Semantic code exploration and pattern detection

### PR Agent (Stub)
- **Status**: Basic stub implementation
- **Capabilities**: `['create-pr', 'update-pr', 'manage-issues', 'comment']`
- **Future**: GitHub integration for PRs and issues

## Testing

Comprehensive test suite with 90%+ coverage:

```bash
# Run all subagents tests
pnpm test packages/subagents

# Watch mode
cd packages/subagents && pnpm test:watch

# Coverage report
pnpm vitest run packages/subagents --coverage
```

**Test Coverage:**
- Context Manager: 100% statements, 100% branches
- Task Queue: 97% statements, 89% branches
- Logger: 89% statements, 93% branches

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm -F "@lytics/dev-agent-subagents" build

# Watch mode
pnpm -F "@lytics/dev-agent-subagents" dev

# Lint
pnpm -F "@lytics/dev-agent-subagents" lint

# Type check
pnpm -F "@lytics/dev-agent-subagents" typecheck
```

## Design Principles

### 1. Central Nervous System Metaphor
Every component is named and designed around human physiology:
- **Coordinator** = Brain
- **Context Manager** = Hippocampus (memory)
- **Task Queue** = Motor Cortex (action)
- **Agents** = Specialized neural regions

### 2. Message-Driven Architecture
All communication happens through standardized messages, enabling:
- Async agent execution
- Message correlation and tracking
- Priority-based scheduling
- Timeout handling

### 3. Shared Context
Agents access shared resources through `AgentContext`:
- Repository indexer (semantic search)
- GitHub API (future)
- Shared state
- Message history
- Structured logger

### 4. Graceful Degradation
System remains operational even if:
- Individual agents fail
- Tasks timeout
- Resources are unavailable

## Future Plans

### Logger Extraction (`@lytics/croak`)
The logger is designed to be extracted into a standalone package for use across Lytics projects:

```typescript
// Future: @lytics/croak
import { Croak } from '@lytics/croak';

const logger = new Croak('my-service', {
  level: 'info',
  outputs: ['console', 'file'],
  format: 'json',
});
```

### Agent Implementations
1. **Planner**: GitHub issue → task breakdown
2. **Explorer**: Semantic code exploration
3. **PR Agent**: Automated PR creation and management

### Coordinator Enhancements
- Agent discovery and registration
- Health monitoring and auto-restart
- Metrics and observability
- Persistent task queue

## Contributing

This is an internal Lytics project, but designed with open-source best practices:

1. **TypeScript strict mode** - Type safety first
2. **Comprehensive tests** - 90%+ coverage target
3. **Clear documentation** - READMEs and inline docs
4. **Self-contained modules** - Easy to extract/refactor

## License

MIT © Lytics, Inc.

