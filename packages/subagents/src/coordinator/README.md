# Coordinator - The Central Nervous System

The coordinator module orchestrates all agent communication, task execution, and shared resources. Think of it as the **brain** of the dev-agent system.

## Architecture

```
coordinator/
├── coordinator.ts        # Main orchestrator (448 lines)
├── context-manager.ts    # Shared memory (127 lines)
├── task-queue.ts        # Task execution (232 lines)
└── index.ts             # Public exports
```

## Components

### 1. SubagentCoordinator

The main brain that:
- **Registers** agents dynamically
- **Routes** messages between agents
- **Orchestrates** task execution
- **Monitors** system health
- **Manages** lifecycle

#### Initialization

```typescript
import { SubagentCoordinator } from '@lytics/dev-agent-subagents';

const coordinator = new SubagentCoordinator();

await coordinator.initialize({
  repositoryPath: '/path/to/repo',
  vectorStorePath: '/path/to/.dev-agent/vectors',
  maxConcurrentTasks: 5,      // Max tasks running at once
  maxConcurrentAgents: 10,    // Max agents (future use)
  defaultTaskRetries: 3,      // Retry failed tasks
});
```

#### Agent Registration

```typescript
import { 
  PlannerAgent, 
  ExplorerAgent, 
  GitHubAgent,
  PrAgent 
} from '@lytics/dev-agent-subagents';
import { RepositoryIndexer } from '@lytics/dev-agent-core';

// Initialize code indexer (required for Explorer and GitHub agents)
const codeIndexer = new RepositoryIndexer({
  repositoryPath: '/path/to/repo',
  vectorStorePath: '/path/to/.dev-agent/vectors',
});
await codeIndexer.initialize();

// Register agents
coordinator.registerAgent(new PlannerAgent());
coordinator.registerAgent(new ExplorerAgent());
coordinator.registerAgent(new GitHubAgent({
  repositoryPath: '/path/to/repo',
  codeIndexer,
  storagePath: '/path/to/.github-index',
}));
coordinator.registerAgent(new PrAgent());

// Check registered agents
const agents = coordinator.getAgentNames();
// => ['planner', 'explorer', 'github', 'pr']

const githubConfig = coordinator.getAgentConfig('github');
// => { name: 'github', capabilities: ['github-index', 'github-search', 'github-context', 'github-related'] }
```

#### Message Routing

**One-to-One Messages:**

```typescript
const response = await coordinator.sendMessage({
  id: 'msg-001',
  type: 'request',
  sender: 'user',
  recipient: 'planner',
  payload: {
    action: 'create-plan',
    goal: 'Implement user authentication',
  },
  timestamp: Date.now(),
  priority: 8,
  timeout: 30000, // 30s timeout
});

if (response) {
  console.log('Plan:', response.payload);
}
```

**Broadcast Messages:**

```typescript
const responses = await coordinator.broadcastMessage({
  id: 'msg-002',
  type: 'event',
  sender: 'coordinator',
  recipient: 'all',
  payload: {
    event: 'repository-updated',
    files: ['src/auth.ts', 'src/user.ts'],
  },
  timestamp: Date.now(),
});

console.log(`${responses.length} agents responded`);
```

#### System Statistics

```typescript
const stats = coordinator.getStats();

console.log(`
  Agents: ${stats.agentsRegistered}
  Active Tasks: ${stats.activeTasks}
  Completed: ${stats.completedTasks}
  Failed: ${stats.failedTasks}
  Messages: ${stats.messagesProcessed}
  Uptime: ${stats.uptime}s
`);
```

#### Graceful Shutdown

```typescript
// Stop accepting new tasks and wait for running tasks
await coordinator.shutdown();
```

### 2. ContextManager

The **hippocampus** - manages shared memory and resources.

#### State Management

```typescript
import { ContextManagerImpl } from '@lytics/dev-agent-subagents';

const context = new ContextManagerImpl({
  maxHistorySize: 1000, // Keep last 1000 messages
});

// Store/retrieve shared state
context.set('current-phase', 'implementation');
context.set('auth-status', { implemented: false, tested: false });

const phase = context.get('current-phase');
// => 'implementation'

// Check existence
if (context.has('auth-status')) {
  console.log('Auth status tracked');
}

// Delete state
context.delete('temporary-data');

// List all keys
const keys = context.keys();

// Clear all state
context.clear();
```

#### Repository Access

```typescript
import { RepositoryIndexer } from '@lytics/dev-agent-core';

const indexer = new RepositoryIndexer({
  repositoryPath: '/path/to/repo',
  vectorStorePath: '/path/to/vectors',
});

context.setIndexer(indexer);

// Agents can now access the indexer
const results = context.getIndexer().search('authentication logic', {
  limit: 5,
  threshold: 0.7,
});
```

#### Message History

```typescript
// Add messages to history
context.addToHistory({
  id: 'msg-001',
  type: 'request',
  sender: 'user',
  recipient: 'planner',
  payload: { action: 'plan' },
  timestamp: Date.now(),
});

// Get full history
const allMessages = context.getHistory();

// Get recent messages
const recent = context.getHistory(10); // Last 10 messages

// Clear history
context.clearHistory();
```

#### Statistics

```typescript
const stats = context.getStats();

console.log(`
  State Size: ${stats.stateSize} keys
  History Size: ${stats.historySize} messages
  Max History: ${stats.maxHistorySize}
  Has Indexer: ${stats.hasIndexer}
`);
```

### 3. TaskQueue

The **motor cortex** - controls task execution with priority and concurrency.

#### Task Structure

```typescript
interface Task {
  id: string;              // Unique task ID
  type: string;            // Task type (e.g., 'analyze', 'plan')
  agentName: string;       // Which agent handles this
  payload: Record<string, unknown>;
  priority: number;        // 0-10, higher = more urgent
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: Error;
  retries: number;
  maxRetries: number;
}
```

#### Basic Usage

```typescript
import { TaskQueue, CoordinatorLogger } from '@lytics/dev-agent-subagents';

const logger = new CoordinatorLogger('task-system', 'info');
const queue = new TaskQueue(3, logger); // Max 3 concurrent tasks

// Enqueue a task
queue.enqueue({
  id: 'task-001',
  type: 'analyze-code',
  agentName: 'explorer',
  payload: {
    file: 'src/auth.ts',
    depth: 'deep',
  },
  priority: 8,
  status: 'pending',
  createdAt: Date.now(),
  retries: 0,
  maxRetries: 3,
});
```

#### Task Execution

```typescript
// Get next highest priority task
const next = queue.getNext();

if (next && queue.canRunMore()) {
  // Mark as running
  queue.markRunning(next.id);
  
  try {
    // Execute task
    const result = await executeTask(next);
    
    // Mark as completed
    queue.markCompleted(next.id, result);
  } catch (error) {
    // Mark as failed
    queue.markFailed(next.id, error as Error);
    
    // Retry if possible
    if (queue.shouldRetry(next.id)) {
      queue.retry(next.id);
    }
  }
}
```

#### Priority Scheduling

Tasks are scheduled by:
1. **Priority** (higher number = higher priority)
2. **Age** (older tasks first for same priority)

```typescript
// High priority task (executed first)
queue.enqueue({
  id: 'urgent-task',
  priority: 10,
  // ...
});

// Medium priority
queue.enqueue({
  id: 'normal-task',
  priority: 5,
  // ...
});

// Low priority (executed last)
queue.enqueue({
  id: 'background-task',
  priority: 1,
  // ...
});
```

#### Concurrency Control

```typescript
// Check if we can run more tasks
if (queue.canRunMore()) {
  const next = queue.getNext();
  // ... execute
}

// Get running count
const running = queue.getRunningCount();
console.log(`${running} tasks currently running`);
```

#### Retry Logic

```typescript
// Check if task should be retried
if (queue.shouldRetry('task-001')) {
  // Retry failed task
  queue.retry('task-001');
  
  const task = queue.get('task-001');
  console.log(`Retry attempt ${task.retries}/${task.maxRetries}`);
}
```

#### Task Cancellation

```typescript
// Cancel a pending or running task
queue.cancel('task-001');

const task = queue.get('task-001');
// => { status: 'cancelled', completedAt: 1234567890 }
```

#### Cleanup

```typescript
// Clean up old completed/failed tasks (older than 1 hour)
const cleaned = queue.cleanup(3600000);
console.log(`Cleaned ${cleaned} old tasks`);

// Clean up all completed tasks
queue.cleanup(0);
```

#### Statistics

```typescript
const stats = queue.getStats();

console.log(`
  Total Tasks: ${stats.total}
  Pending: ${stats.pending}
  Running: ${stats.running}
  Completed: ${stats.completed}
  Failed: ${stats.failed}
  Cancelled: ${stats.cancelled}
  Max Concurrent: ${stats.maxConcurrent}
`);
```

## Integration Example

Complete example showing all three components working together:

```typescript
import {
  SubagentCoordinator,
  PlannerAgent,
  ExplorerAgent,
  GitHubAgent,
  CoordinatorLogger,
} from '@lytics/dev-agent-subagents';
import { RepositoryIndexer } from '@lytics/dev-agent-core';

async function main() {
  // 1. Initialize logger
  const logger = new CoordinatorLogger('dev-agent', 'info');
  
  // 2. Initialize code indexer
  const codeIndexer = new RepositoryIndexer({
    repositoryPath: '/path/to/repo',
    vectorStorePath: '/path/to/.dev-agent/vectors',
  });
  await codeIndexer.initialize();
  
  // 3. Initialize coordinator
  const coordinator = new SubagentCoordinator();
  
  // 4. Register agents
  coordinator.registerAgent(new PlannerAgent());
  coordinator.registerAgent(new ExplorerAgent());
  coordinator.registerAgent(new GitHubAgent({
    repositoryPath: '/path/to/repo',
    codeIndexer,
    storagePath: '/path/to/.github-index',
  }));
  
  logger.info('Coordinator ready', {
    agents: coordinator.getAgentNames(),
  });
  
  // 4. Send a planning request
  const planResponse = await coordinator.sendMessage({
    id: 'plan-001',
    type: 'request',
    sender: 'user',
    recipient: 'planner',
    payload: {
      action: 'create-plan',
      goal: 'Add rate limiting to API endpoints',
    },
    timestamp: Date.now(),
    priority: 9,
    timeout: 30000,
  });
  
  if (planResponse?.payload.tasks) {
    logger.info('Plan created', {
      tasks: planResponse.payload.tasks,
    });
    
    // 5. Execute exploration tasks
    for (const task of planResponse.payload.tasks) {
      await coordinator.sendMessage({
        id: `explore-${task.id}`,
        type: 'request',
        sender: 'planner',
        recipient: 'explorer',
        payload: {
          action: 'analyze',
          file: task.file,
        },
        timestamp: Date.now(),
        correlationId: 'plan-001',
      });
    }
  }
  
  // 6. Search GitHub for related context
  const githubResponse = await coordinator.sendMessage({
    id: 'github-001',
    type: 'request',
    sender: 'user',
    recipient: 'github',
    payload: {
      action: 'search',
      query: 'rate limiting implementation',
      searchOptions: { limit: 5 },
    },
    timestamp: Date.now(),
    priority: 7,
  });
  
  if (githubResponse?.payload.results) {
    logger.info('GitHub context found', {
      count: githubResponse.payload.results.length,
      results: githubResponse.payload.results,
    });
  }
  
  // 7. Check system stats
  const stats = coordinator.getStats();
  logger.info('System stats', stats);
  
  // 8. Shutdown gracefully
  await coordinator.stop();
  await codeIndexer.close();
}

main().catch(console.error);
```

## Error Handling

The coordinator is designed for resilience:

```typescript
try {
  const response = await coordinator.sendMessage({
    id: 'msg-001',
    type: 'request',
    sender: 'user',
    recipient: 'non-existent-agent',
    payload: {},
    timestamp: Date.now(),
  });
} catch (error) {
  // Agent not found
  console.error('Message delivery failed:', error.message);
}

// Tasks automatically retry on failure
queue.enqueue({
  id: 'task-001',
  // ...
  maxRetries: 3, // Will retry up to 3 times
});

// Check health of registered agents
for (const agentName of coordinator.getAgentNames()) {
  const agent = coordinator.getAgent(agentName);
  const healthy = await agent.healthCheck();
  if (!healthy) {
    logger.warn('Agent unhealthy', { agent: agentName });
  }
}
```

## Testing

All coordinator components have comprehensive test coverage:

```bash
# Run coordinator tests
cd packages/subagents
pnpm test src/coordinator

# Watch mode
pnpm test:watch src/coordinator
```

**Coverage:**
- `coordinator.ts`: Ready for tests
- `context-manager.ts`: **100%** statements, **100%** branches
- `task-queue.ts`: **97%** statements, **89%** branches

## Design Decisions

### 1. Message-Based Architecture
All agent communication uses messages instead of direct function calls, enabling:
- Async execution
- Message correlation
- Priority scheduling
- Timeout handling
- History tracking

### 2. Shared Context
Instead of passing dependencies to each agent individually, we use a shared `AgentContext`:
- Easier to add new shared resources
- Consistent access patterns
- Better testability

### 3. Priority-Based Scheduling
Tasks are prioritized (0-10) allowing urgent tasks to jump the queue:
- Critical bugs: priority 10
- User requests: priority 7-9
- Background tasks: priority 1-3

### 4. Graceful Degradation
System continues operating even if:
- Individual agents fail (isolated)
- Tasks timeout (marked as failed)
- Resources unavailable (agents handle gracefully)

## Performance Considerations

### Concurrency Control
```typescript
// Balance throughput vs resource usage
const coordinator = new SubagentCoordinator();
await coordinator.initialize({
  maxConcurrentTasks: 5, // Tune based on CPU/memory
});
```

### Message History Limits
```typescript
// Prevent unbounded memory growth
const context = new ContextManagerImpl({
  maxHistorySize: 1000, // Adjust based on needs
});
```

### Task Cleanup
```typescript
// Regularly clean up old tasks
setInterval(() => {
  const cleaned = queue.cleanup(3600000); // 1 hour
  if (cleaned > 0) {
    logger.debug('Tasks cleaned', { count: cleaned });
  }
}, 300000); // Every 5 minutes
```

## Future Enhancements

1. **Persistent Task Queue** - Survive restarts
2. **Agent Discovery** - Auto-register agents
3. **Health Monitoring** - Auto-restart failed agents
4. **Metrics** - Prometheus/StatsD integration
5. **Distributed** - Multi-machine coordination

## License

MIT © Lytics, Inc.

