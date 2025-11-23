# Explorer Subagent - Visual Cortex

**Code pattern discovery and analysis using semantic search**

## Overview

The Explorer Subagent is the "Visual Cortex" of dev-agent, specialized in discovering patterns, finding similar code, mapping relationships, and providing architectural insights. It leverages the Repository Indexer's semantic search capabilities to understand code by meaning, not just text matching.

## Capabilities

- **🔍 Pattern Search** - Find code patterns using natural language queries
- **🔗 Similar Code** - Discover code similar to a reference file
- **🕸️ Relationships** - Map component dependencies and usages  
- **📊 Insights** - Get architectural overview and metrics

## Quick Start

### As a CLI Tool

```bash
# Search for patterns
dev explore pattern "authentication logic"
dev explore pattern "error handling" --limit 5

# Find similar code
dev explore similar src/auth/login.ts
dev explore similar packages/core/index.ts --limit 10

# Get insights
dev explore insights
```

### As an Agent

```typescript
import { ExplorerAgent, ContextManagerImpl } from '@lytics/dev-agent-subagents';
import { RepositoryIndexer } from '@lytics/dev-agent-core';
import { CoordinatorLogger } from '@lytics/dev-agent-subagents';

// Setup
const indexer = new RepositoryIndexer({
  repositoryPath: './my-repo',
  vectorStorePath: './.dev-agent/vectors',
});
await indexer.initialize();

const contextManager = new ContextManagerImpl();
contextManager.setIndexer(indexer);

const logger = new CoordinatorLogger('my-app', 'info');

// Initialize Explorer
const explorer = new ExplorerAgent();
await explorer.initialize({
  agentName: 'explorer',
  contextManager,
  sendMessage: async (msg) => null,
  broadcastMessage: async (msg) => [],
  logger,
});

// Send exploration request
const response = await explorer.handleMessage({
  id: 'req-1',
  type: 'request',
  sender: 'user',
  recipient: 'explorer',
  payload: {
    action: 'pattern',
    query: 'database connection',
    limit: 10,
    threshold: 0.7,
  },
  timestamp: Date.now(),
});

console.log(response?.payload);
```

## Pattern Search

Find code patterns using semantic search - searches by meaning, not exact text.

### Request Format

```typescript
{
  action: 'pattern',
  query: string,           // Natural language query
  limit?: number,          // Max results (default: 10)
  threshold?: number,      // Similarity threshold 0-1 (default: 0.7)
  fileTypes?: string[],    // Filter by extensions (e.g., ['.ts', '.js'])
}
```

### Response Format

```typescript
{
  action: 'pattern',
  query: string,
  results: Array<{
    id: string,
    score: number,         // Similarity score (0-1)
    metadata: {
      path: string,
      type: string,        // 'function', 'class', 'interface', etc.
      name: string,
      language: string,
      startLine?: number,
      endLine?: number,
    }
  }>,
  totalFound: number,
}
```

### Examples

**Find Authentication Code:**

```bash
dev explore pattern "user authentication and login"
```

```typescript
const response = await explorer.handleMessage({
  id: 'auth-search',
  type: 'request',
  sender: 'user',
  recipient: 'explorer',
  payload: {
    action: 'pattern',
    query: 'user authentication and login',
    limit: 5,
    threshold: 0.75,
  },
  timestamp: Date.now(),
});
```

**Filter by File Type:**

```typescript
payload: {
  action: 'pattern',
  query: 'API endpoint handlers',
  fileTypes: ['.ts'],
  limit: 10,
}
```

**Common Queries:**
- "error handling and logging"
- "database connection setup"
- "API endpoint handlers"
- "authentication middleware"
- "data validation logic"
- "unit test patterns"

## Similar Code

Find code files similar to a reference file based on semantic similarity.

### Request Format

```typescript
{
  action: 'similar',
  filePath: string,        // Reference file path
  limit?: number,          // Max results (default: 10)
  threshold?: number,      // Similarity threshold (default: 0.75)
}
```

### Response Format

```typescript
{
  action: 'similar',
  referenceFile: string,
  similar: Array<{
    id: string,
    score: number,
    metadata: {
      path: string,
      type: string,
      name: string,
      language: string,
    }
  }>,
  totalFound: number,
}
```

### Examples

**Find Files Similar to auth.ts:**

```bash
dev explore similar src/auth.ts
```

```typescript
const response = await explorer.handleMessage({
  id: 'similar-search',
  type: 'request',
  sender: 'user',
  recipient: 'explorer',
  payload: {
    action: 'similar',
    filePath: 'src/auth/login.ts',
    limit: 5,
  },
  timestamp: Date.now(),
});
```

**Use Cases:**
- Find similar implementations for refactoring
- Discover duplicate or near-duplicate code
- Identify patterns across the codebase
- Learn from similar examples

## Relationship Discovery

Map component relationships - imports, exports, dependencies, and usages.

### Request Format

```typescript
{
  action: 'relationships',
  component: string,       // Component name to analyze
  type?: 'imports' | 'exports' | 'dependencies' | 'usages' | 'all',
  limit?: number,          // Max results (default: 50)
}
```

### Response Format

```typescript
{
  action: 'relationships',
  component: string,
  relationships: Array<{
    from: string,          // Source file
    to: string,            // Target component
    type: 'imports' | 'exports' | 'uses' | 'extends' | 'implements',
    location: {
      file: string,
      line: number,
    }
  }>,
  totalFound: number,
}
```

### Examples

**Find All Relationships:**

```typescript
payload: {
  action: 'relationships',
  component: 'AuthService',
  type: 'all',
}
```

**Find Imports Only:**

```typescript
payload: {
  action: 'relationships',
  component: 'UserRepository',
  type: 'imports',
  limit: 20,
}
```

**Find Usages:**

```typescript
payload: {
  action: 'relationships',
  component: 'DatabaseConnection',
  type: 'usages',
}
```

## Architectural Insights

Get high-level overview of the codebase - common patterns, file counts, coverage.

### Request Format

```typescript
{
  action: 'insights',
  type?: 'patterns' | 'complexity' | 'coverage' | 'all',
}
```

### Response Format

```typescript
{
  action: 'insights',
  insights: {
    fileCount: number,
    componentCount: number,
    topPatterns: Array<{
      pattern: string,     // e.g., 'class', 'async', 'export'
      count: number,
      files: string[],     // Top 10 files
    }>,
    coverage?: {
      indexed: number,
      total: number,
      percentage: number,
    },
  }
}
```

### Examples

**Get All Insights:**

```bash
dev explore insights
```

```typescript
const response = await explorer.handleMessage({
  id: 'insights-request',
  type: 'request',
  sender: 'user',
  recipient: 'explorer',
  payload: {
    action: 'insights',
    type: 'all',
  },
  timestamp: Date.now(),
});
```

**Insights Include:**
- Total files and components indexed
- Most common code patterns (class, function, async, etc.)
- Files where patterns appear most
- Indexing coverage percentage

## Integration with Coordinator

The Explorer integrates seamlessly with the Subagent Coordinator, allowing it to work alongside other agents in a coordinated system.

### Complete Integration Example

```typescript
import { 
  SubagentCoordinator, 
  ExplorerAgent, 
  ContextManagerImpl 
} from '@lytics/dev-agent-subagents';
import { RepositoryIndexer } from '@lytics/dev-agent-core';

// 1. Initialize Repository Indexer
const indexer = new RepositoryIndexer({
  repositoryPath: './my-repo',
  vectorStorePath: './.dev-agent/vectors',
});
await indexer.initialize();

// Index the repository
await indexer.index({ force: false });

// 2. Create Coordinator
const coordinator = new SubagentCoordinator({
  maxConcurrentTasks: 5,
  logLevel: 'info',
  healthCheckInterval: 60000, // Health checks every minute
});

// 3. Share Indexer Context
coordinator.getContextManager().setIndexer(indexer);

// 4. Register Explorer Agent
const explorer = new ExplorerAgent();
await coordinator.registerAgent(explorer);

// 5. Start Coordinator
coordinator.start();

// 6. Send Exploration Requests via Coordinator
const response = await coordinator.sendMessage({
  type: 'request',
  sender: 'app',
  recipient: 'explorer',
  payload: {
    action: 'pattern',
    query: 'authentication logic',
    limit: 10,
  },
});

console.log(response?.payload);

// 7. Or Submit Tasks for Async Execution
const taskId = coordinator.submitTask({
  type: 'exploration',
  agentName: 'explorer',
  payload: {
    action: 'similar',
    filePath: 'src/auth/login.ts',
  },
  priority: 8, // Higher priority
});

// Check task status
const task = coordinator.getTask(taskId);
console.log('Task status:', task?.status);

// 8. Monitor Health
setInterval(async () => {
  const stats = coordinator.getStats();
  console.log('Coordinator stats:', stats);
  
  const healthy = await explorer.healthCheck();
  console.log('Explorer healthy:', healthy);
}, 30000);

// 9. Graceful Shutdown
process.on('SIGINT', async () => {
  await coordinator.stop();
  await indexer.close();
  process.exit(0);
});
```

### Benefits of Coordinator Integration

✅ **Shared Context** - Indexer and other resources shared across agents
✅ **Task Queue** - Async execution with priority and retries
✅ **Health Monitoring** - Automated health checks
✅ **Error Handling** - Centralized error responses
✅ **Message Routing** - Automatic routing to correct agents
✅ **Statistics** - Track message counts, response times, task status

### Task-Based Exploration

Submit exploration tasks for async execution:

```typescript
// Pattern search task
const taskId1 = coordinator.submitTask({
  type: 'pattern-search',
  agentName: 'explorer',
  payload: {
    action: 'pattern',
    query: 'error handling',
  },
  priority: 10,      // High priority
  maxRetries: 3,     // Retry on failure
});

// Similar code task
const taskId2 = coordinator.submitTask({
  type: 'similar-code',
  agentName: 'explorer',
  payload: {
    action: 'similar',
    filePath: 'src/handlers/api.ts',
  },
  priority: 5,
});

// Check task completion
const task = coordinator.getTask(taskId1);
if (task?.status === 'completed') {
  console.log('Results:', task.result);
}
```

### Coordinator Statistics

Monitor system health and performance:

```typescript
const stats = coordinator.getStats();

console.log({
  agentCount: stats.agentCount,           // Number of registered agents
  messagesSent: stats.messagesSent,       // Total messages sent
  messagesReceived: stats.messagesReceived,
  messageErrors: stats.messageErrors,
  tasksCompleted: stats.tasksCompleted,
  tasksFailed: stats.tasksFailed,
  avgResponseTime: stats.avgResponseTime, // In milliseconds
  uptime: stats.uptime,                   // In milliseconds
});
```

### Multi-Agent Coordination

Explorer works with other agents:

```typescript
// Register multiple agents
await coordinator.registerAgent(new ExplorerAgent());
await coordinator.registerAgent(new PlannerAgent());
await coordinator.registerAgent(new PrAgent());

// Explorer can send messages to other agents
const response = await coordinator.sendMessage({
  type: 'request',
  sender: 'explorer',
  recipient: 'planner',
  payload: {
    action: 'analyze',
    codePatterns: explorerResults,
  },
});
```

### Coordinator Health Checks

The coordinator automatically performs health checks:

```typescript
const coordinator = new SubagentCoordinator({
  healthCheckInterval: 60000, // Check every minute
});

// Health checks run automatically
// Logs warnings if agents become unhealthy

// Manual health check
const healthy = await explorer.healthCheck();
```

### Integration Tests

The Coordinator→Explorer integration is fully tested:

```bash
# Run integration tests
pnpm test packages/subagents/src/coordinator/coordinator.integration.test.ts
```

**Test Coverage:**
- ✅ Agent registration and initialization
- ✅ Message routing (pattern, similar, relationships, insights)
- ✅ Task execution via task queue
- ✅ Health checks and monitoring
- ✅ Context sharing (indexer access)
- ✅ Error handling and edge cases
- ✅ Graceful shutdown

## Error Handling

The Explorer returns error responses for invalid requests:

```typescript
// Unknown action
const response = await explorer.handleMessage({
  id: 'bad-request',
  type: 'request',
  sender: 'user',
  recipient: 'explorer',
  payload: {
    action: 'unknown-action',
  },
  timestamp: Date.now(),
});

// response.payload will contain: { action: 'pattern', error: 'Unknown action: unknown-action' }
```

## Health Check

Check if the Explorer is healthy and has indexed data:

```typescript
const healthy = await explorer.healthCheck();

if (!healthy) {
  console.log('Explorer not ready - index the repository first');
}
```

**Health Check Criteria:**
- Explorer is initialized
- Indexer is available
- Repository has indexed vectors (vectorsStored > 0)

## Performance Tips

### 1. Adjust Thresholds

Lower thresholds find more results but with less relevance:

```typescript
// Strict matching (fewer, more relevant results)
{ threshold: 0.8 }

// Relaxed matching (more results, less relevant)
{ threshold: 0.6 }
```

### 2. Limit Results

Use `limit` to control response size:

```typescript
{ limit: 5 }  // Quick exploration
{ limit: 20 } // Comprehensive search
```

### 3. Filter by File Type

Narrow search scope for faster results:

```typescript
{
  action: 'pattern',
  query: 'API handlers',
  fileTypes: ['.ts'],  // Only TypeScript
}
```

### 4. Use Specific Queries

More specific queries yield better results:

```
❌ "code"
✅ "authentication middleware"

❌ "function"
✅ "database connection pooling"
```

## Testing

The Explorer has comprehensive test coverage (20 tests):

```bash
# Run Explorer tests
pnpm vitest run packages/subagents/src/explorer

# Watch mode
cd packages/subagents && pnpm test:watch src/explorer
```

**Test Coverage:**
- Initialization and capabilities
- Pattern search with filters
- Similar code discovery
- Relationship mapping
- Insights gathering
- Error handling
- Health checks
- Shutdown procedures

## Real-World Use Cases

### 1. Code Review

Find similar patterns before implementing:

```bash
dev explore pattern "file upload handling"
dev explore similar src/uploads/handler.ts
```

### 2. Refactoring

Identify code that should be consolidated:

```bash
dev explore pattern "database query execution"
# Review results, identify duplicates
```

### 3. Learning Codebase

Understand architecture quickly:

```bash
dev explore insights
dev explore pattern "main entry point"
dev explore relationships "Application"
```

### 4. Impact Analysis

See what depends on a component before changing it:

```bash
dev explore relationships "UserService" --type usages
```

### 5. Finding Examples

Learn by finding existing implementations:

```bash
dev explore pattern "websocket connection handling"
dev explore similar tests/integration/websocket.test.ts
```

## Limitations

1. **Requires Indexed Repository** - Run `dev index` first
2. **Semantic Search Quality** - Depends on embedding model quality
3. **No Real-Time Updates** - Reindex after significant changes
4. **Memory Usage** - Large repositories require more RAM for vectors
5. **Language Support** - Best for TypeScript/JavaScript, Markdown

## Future Enhancements

- Real-time code analysis without full reindex
- Support for more languages (Python, Rust, Go)
- Complexity metrics and code quality scores
- Visual relationship graphs
- Integration with IDE hover tooltips
- Code smell detection
- Refactoring suggestions

## API Reference

### ExplorerAgent

```typescript
class ExplorerAgent implements Agent {
  name: string = 'explorer';
  capabilities: string[];
  
  async initialize(context: AgentContext): Promise<void>
  async handleMessage(message: Message): Promise<Message | null>
  async healthCheck(): Promise<boolean>
  async shutdown(): Promise<void>
}
```

### Exported Types

```typescript
export type {
  ExplorationAction,
  ExplorationRequest,
  ExplorationResult,
  PatternSearchRequest,
  PatternResult,
  SimilarCodeRequest,
  SimilarCodeResult,
  RelationshipRequest,
  RelationshipResult,
  InsightsRequest,
  InsightsResult,
  CodeRelationship,
  CodeInsights,
  PatternFrequency,
  ExplorationError,
};
```

## License

MIT © Lytics, Inc.

