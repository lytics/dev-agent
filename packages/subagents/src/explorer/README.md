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

The Explorer works seamlessly with the Subagent Coordinator:

```typescript
import { SubagentCoordinator, ExplorerAgent } from '@lytics/dev-agent-subagents';

const coordinator = new SubagentCoordinator();
await coordinator.initialize({
  repositoryPath: './my-repo',
  vectorStorePath: './.dev-agent/vectors',
});

// Register Explorer
coordinator.registerAgent(new ExplorerAgent());

// Send exploration request via coordinator
const response = await coordinator.sendMessage({
  id: 'explore-1',
  type: 'request',
  sender: 'user',
  recipient: 'explorer',
  payload: {
    action: 'pattern',
    query: 'authentication',
  },
  timestamp: Date.now(),
});
```

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

