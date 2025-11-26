# MCP Server

Model Context Protocol (MCP) server implementation for Dev-Agent, providing context-aware tools to AI assistants through a standardized JSON-RPC 2.0 interface.

## Overview

The MCP server enables AI tools (Claude Desktop, Claude Code, Cursor, etc.) to access Dev-Agent's repository context, semantic search, and GitHub integration capabilities through the [Model Context Protocol](https://modelcontextprotocol.io/).

**Key Features:**
- 🔌 Extensible adapter framework for custom tools
- 🎯 8 Guided workflow prompts (analyze-issue, find-pattern, repo-overview, etc.)
- 🪙 Token cost visibility with accurate estimation (<1% error)
- 📡 Stdio transport for process communication
- ✅ Full MCP protocol support (tools, prompts, resources)
- 🧪 Comprehensive test coverage (246 tests passing)
- 📊 Built-in logging and error handling
- 🚀 Zero-configuration quick start

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      AI Assistant                        │
│              (Claude Desktop, Cursor, etc.)              │
└──────────────────────┬──────────────────────────────────┘
                       │ JSON-RPC 2.0 via stdio
                       ▼
┌─────────────────────────────────────────────────────────┐
│                     MCP Server                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │           Transport Layer (Stdio)                  │ │
│  │  • Message serialization/deserialization           │ │
│  │  • stdin/stdout communication                      │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │          Protocol Handler (JSON-RPC 2.0)           │ │
│  │  • initialize                                      │ │
│  │  • tools/list                                      │ │
│  │  • tools/call                                      │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │           Adapter Registry                         │ │
│  │  • Adapter lifecycle management                    │ │
│  │  • Tool execution routing                          │ │
│  │  • Dynamic adapter registration                    │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌─────────┐  ┌─────────┐   ┌─────────┐
    │ Search  │  │ GitHub  │   │ Custom  │
    │ Adapter │  │ Adapter │   │ Adapter │
    └─────────┘  └─────────┘   └─────────┘
         │             │             │
         ▼             ▼             ▼
    Repository    GitHub API    Your Logic
      Context
```

## Quick Start

### 1. Install Dependencies

```bash
cd packages/mcp-server
pnpm install
pnpm build
```

### 2. Run the Server

```bash
# Start with stdio transport (default)
node dist/index.js

# Or use the dev-agent CLI
dev mcp-server start
```

### 3. Configure AI Tool

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dev-agent": {
      "command": "node",
      "args": ["/path/to/dev-agent/packages/mcp-server/dist/index.js"],
      "env": {
        "REPOSITORY_PATH": "/path/to/your/repo"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "dev-agent": {
    "command": "node /path/to/dev-agent/packages/mcp-server/dist/index.js"
  }
}
```

## Available Tools

The MCP server provides 5 powerful adapters (tools) and 8 guided prompts:

### Tools

1. **`dev_search`** - Semantic code search across repository
   - Natural language queries
   - Type-aware results
   - Configurable relevance thresholds

2. **`dev_status`** - Repository health and indexing status
   - Code index statistics
   - GitHub integration status
   - Health checks

3. **`dev_plan`** - Generate implementation plans from GitHub issues
   - Fetch issue details
   - Find relevant code
   - Break down into tasks

4. **`dev_explore`** - Code pattern discovery and relationships
   - Pattern search
   - Similar code detection
   - Dependency mapping

5. **`dev_gh`** - GitHub issue and PR search
   - Semantic search with filters
   - Full context retrieval
   - Offline operation with cache
   - **Auto-reload**: Automatically picks up new data when `dev gh index` runs

### Auto-Reload Feature

The GitHub adapter automatically reloads index data when it detects changes, eliminating the need to restart the MCP server:

- **How it works**: Monitors GitHub state file modification time
- **When it reloads**: On next query after `dev gh index` updates the data
- **No user action required**: Changes are picked up automatically
- **Efficient**: Only checks file timestamps (no polling)

**Example workflow:**
```bash
# 1. Query GitHub data in Claude Code/Cursor
> Use dev_gh to search for "authentication issues"

# 2. Update the index (in terminal)
$ dev gh index
✓ Indexed 59 documents (32 issues + 27 PRs)

# 3. Query again - new data appears automatically!
> Use dev_gh to search for "authentication issues"
# Results now include newly created issues #58, #59
```

### Prompts (Guided Workflows)

1. **`analyze-issue`** - Full issue analysis with implementation plan
2. **`find-pattern`** - Search codebase for specific patterns
3. **`repo-overview`** - Comprehensive repository health dashboard
4. **`find-similar`** - Find code similar to a file
5. **`search-github`** - Search issues/PRs by topic
6. **`explore-relationships`** - Analyze file dependencies
7. **`create-plan`** - Generate detailed task breakdown
8. **`quick-search`** - Fast semantic code search

All tools include **token cost footers** (🪙) for real-time cost tracking!

## Usage Examples

### Basic Setup

```typescript
import { MCPServer } from '@lytics/dev-agent-mcp';
import { SearchAdapter } from './adapters/SearchAdapter';

const server = new MCPServer({
  serverInfo: {
    name: 'dev-agent',
    version: '1.0.0',
  },
  config: {
    repositoryPath: '/path/to/repo',
    logLevel: 'info',
  },
  transport: 'stdio',
  adapters: [new SearchAdapter()],
});

await server.start();
```

### Creating a Custom Adapter

```typescript
import { ToolAdapter } from '@lytics/dev-agent-mcp';
import type {
  AdapterContext,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
} from '@lytics/dev-agent-mcp';

export class MyAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'my-adapter',
    version: '1.0.0',
    description: 'My custom adapter',
  };

  async initialize(context: AdapterContext): Promise<void> {
    context.logger.info('MyAdapter initialized');
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'my_tool',
      description: 'Does something useful',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
        },
        required: ['query'],
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { query } = args;
    
    // Your logic here
    const results = await this.performSearch(query as string);

    return {
      success: true,
      data: results,
      metadata: {
        executionTime: Date.now() - context.timestamp,
      },
    };
  }

  validate(args: Record<string, unknown>): ValidationResult {
    if (typeof args.query !== 'string' || args.query.length === 0) {
      return {
        valid: false,
        errors: ['query must be a non-empty string'],
      };
    }
    return { valid: true };
  }
}
```

### Runtime Adapter Registration

```typescript
// Register adapter after server start
const newAdapter = new MyAdapter();
server.registerAdapter(newAdapter);

// Unregister adapter
await server.unregisterAdapter('my_tool');
```

## API Reference

### MCPServer

Main server class managing transport, protocol, and adapters.

**Constructor Options:**

```typescript
interface MCPServerConfig {
  serverInfo: ServerInfo;
  config: Config;
  transport: 'stdio' | Transport;
  adapters?: ToolAdapter[];
}
```

**Methods:**

- `async start()`: Start the MCP server
- `async stop()`: Stop the MCP server and cleanup
- `registerAdapter(adapter: ToolAdapter)`: Register new adapter at runtime
- `async unregisterAdapter(toolName: string)`: Unregister adapter
- `getStats()`: Get server statistics

### ToolAdapter (Abstract)

Base class for creating custom tool adapters.

**Required Methods:**

- `metadata: AdapterMetadata`: Adapter name, version, description
- `async initialize(context: AdapterContext)`: Initialize adapter with context
- `getToolDefinition(): ToolDefinition`: Define tool schema
- `async execute(args, context): Promise<ToolResult>`: Execute tool logic

**Optional Methods:**

- `validate(args): ValidationResult`: Validate arguments before execution
- `estimateTokens(args): number`: Estimate token usage for the tool
- `async shutdown()`: Cleanup on adapter shutdown
- `async healthCheck(): Promise<boolean>`: Check adapter health

### AdapterRegistry

Manages adapter lifecycle and tool execution routing.

**Methods:**

- `register(adapter: ToolAdapter)`: Register an adapter
- `async unregister(toolName: string)`: Unregister adapter
- `async initializeAll(context)`: Initialize all registered adapters
- `getToolDefinitions(): ProtocolToolDefinition[]`: Get all tool definitions
- `async executeTool(name, args, context): Promise<ToolResult>`: Execute a tool
- `async shutdownAll()`: Shutdown all adapters

## Testing

**Status:** ✅ 246 tests passing

### Run Tests

```bash
# Run all MCP server tests
pnpm test packages/mcp-server

# Run specific test suite
pnpm test packages/mcp-server/src/formatters
pnpm test packages/mcp-server/src/adapters

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Test Organization

```
tests/
├── server/
│   ├── jsonrpc.test.ts              # JSON-RPC protocol tests (23 tests)
│   └── utils/
│       └── messageHandlers.test.ts  # Message utility tests (25 tests)
├── adapters/
│   ├── AdapterRegistry.test.ts      # Registry tests (23 tests)
│   └── MockAdapter.ts               # Test helper
└── integration/
    └── server.integration.test.ts   # End-to-end tests (9 tests)
```

### Test Coverage

**Current Coverage:** 80+ tests, 67% statement coverage

- ✅ JSON-RPC protocol: 96% coverage
- ✅ Message handlers: 94% coverage
- ✅ Adapter Registry: 100% coverage
- ✅ Integration: Full lifecycle tested

## Built-in Adapters

### ✅ Production Ready

All adapters are fully tested and production-ready:

- **SearchAdapter** (`dev_search`) - Semantic code search with type-aware understanding
  - Natural language queries
  - Compact and verbose formats
  - Token cost display: 🪙 ~109 tokens (compact)

- **StatusAdapter** (`dev_status`) - Repository health and statistics
  - Code index status
  - GitHub integration status (auto-reloads on change)
  - Health checks and storage metrics

- **PlanAdapter** (`dev_plan`) - Implementation planning from GitHub issues
  - Issue fetching and analysis
  - Semantic code search for relevant files
  - Task breakdown with complexity estimates

- **ExploreAdapter** (`dev_explore`) - Code pattern discovery
  - Pattern search across codebase
  - Similar code detection
  - Relationship mapping

- **GitHubAdapter** (`dev_gh`) - GitHub issue and PR management
  - Semantic search with filters
  - Full context retrieval
  - Works offline with cached data
  - **Auto-reload**: Automatically picks up index updates without restart
  - Token cost display: 🪙 ~36 tokens (compact) to ~462 tokens (verbose)

## Configuration

### Environment Variables

```bash
# Repository path (defaults to cwd)
REPOSITORY_PATH=/path/to/repo

# Log level: debug, info, warn, error (default: info)
LOG_LEVEL=debug

# Custom adapter directory
ADAPTER_DIR=/path/to/adapters
```

### Programmatic Configuration

```typescript
const server = new MCPServer({
  serverInfo: {
    name: 'dev-agent',
    version: '1.0.0',
    capabilities: {
      tools: { dynamicRegistration: true },
      resources: { dynamicRegistration: false },
      prompts: { dynamicRegistration: false },
    },
  },
  config: {
    repositoryPath: process.env.REPOSITORY_PATH || process.cwd(),
    logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
    adapterDir: process.env.ADAPTER_DIR,
  },
  transport: 'stdio',
  adapters: [],
});
```

## Performance

- **Startup Time:** < 100ms
- **Tool Execution:** < 10ms overhead (adapter-dependent)
- **Memory Usage:** ~20MB base + adapter memory
- **Concurrent Requests:** Supported (sequential execution per tool)

## Best Practices

### Adapter Development

1. **Keep adapters focused** - One tool per adapter
2. **Validate inputs** - Implement `validate()` for early error detection
3. **Estimate tokens** - Implement `estimateTokens()` for cost awareness
4. **Handle errors gracefully** - Return structured errors, not exceptions
5. **Log appropriately** - Use context.logger for debugging

### Error Handling

```typescript
async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
  try {
    // Your logic
    return {
      success: true,
      data: results,
    };
  } catch (error) {
    context.logger.error('Tool execution failed', { error });
    return {
      success: false,
      error: {
        code: '-32001',
        message: 'Tool execution failed',
        data: { reason: error.message },
      },
    };
  }
}
```

### Token Optimization

All tools now include **automatic token footers** (🪙) for cost visibility:

```
## GitHub Search Results
...results here...

🪙 ~36 tokens
```

**Token Estimation:**
- Accuracy: <1% error (calibrated against actual usage)
- Formula: 4.5 chars/token for technical content
- Validated: 178 actual vs 179 estimated tokens

**Format Strategy:**
- **Compact**: ~30-150 tokens (summaries, lists)
- **Verbose**: ~150-500 tokens (full details, metadata)
- Choose based on your token budget!

**Best Practices:**
- Use compact format for exploration
- Use verbose only when you need full context
- Monitor token footers to optimize costs
- Implement result formatters (compact vs. verbose)

## Troubleshooting

### Server Not Starting

```bash
# Check if port is already in use (if using HTTP)
lsof -i :3000

# Check logs
LOG_LEVEL=debug node dist/index.js
```

### Adapter Not Registered

```typescript
// Check if adapter was initialized
const stats = server.getStats();
console.log(stats.adapters);

// Verify tool definition
const tools = registry.getToolDefinitions();
console.log(tools);
```

### Tool Execution Fails

- Check adapter logs: `context.logger.debug()`
- Validate input schema matches request
- Check adapter initialization completed
- Verify no circular dependencies

## Limitations & Future Work

**Current Limitations:**
- ⚠️ Stdio transport only (HTTP planned for v2)
- ⚠️ Sequential tool execution (parallel execution planned)
- ⚠️ No built-in authentication (use OS-level permissions)

**Planned Features:**
- HTTP/WebSocket transport (#31)
- Resource and prompt support (#32)
- Adapter marketplace (#33)
- Built-in caching layer
- Streaming responses

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development workflow.

**Adding a New Adapter:**

1. Create adapter class extending `ToolAdapter`
2. Implement required methods
3. Add tests (>80% coverage)
4. Document usage in adapter README
5. Register in default adapters list

## License

MIT - See [LICENSE](../../LICENSE) for details.

## References

- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [JSON-RPC 2.0 Spec](https://www.jsonrpc.org/specification)
- [Dev-Agent Architecture](../../ARCHITECTURE.md)
- [Testability Guidelines](../../docs/TESTABILITY.md)

