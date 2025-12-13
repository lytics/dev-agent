# GitHub Context Subagent

The GitHub Context Subagent indexes GitHub issues, pull requests, and discussions to provide rich context to AI tools. It helps reduce hallucinations by connecting code with its project management context.

## Overview

**Purpose:** Provide searchable GitHub context (issues/PRs/discussions) to AI coding assistants.

**Key Features:**
- 🔍 **Index GitHub Data**: Fetch and store issues, PRs, and discussions
- 🔗 **Link to Code**: Connect GitHub items to relevant code files
- 🧠 **Semantic Search**: Find relevant GitHub context for queries
- 📊 **Relationship Extraction**: Automatically detect issue references, file mentions, and user mentions
- 🎯 **Context Provision**: Provide complete context for specific issues/PRs

## Architecture

```
github/
├── agent.ts             # Agent wrapper implementing Agent interface
├── indexer.ts           # GitHub document indexer and searcher
├── types.ts            # Type definitions
├── utils/
│   ├── fetcher.ts      # GitHub CLI integration (gh api)
│   └── parser.ts       # Content parsing and relationship extraction
└── README.md           # This file
```

## Quick Start

### CLI Usage

```bash
# Index GitHub data (issues, PRs, discussions)
dev github index

# Index with options
dev github index --issues --prs --limit 100

# Search GitHub context
dev github search "rate limiting"

# Get full context for an issue
dev github context 42
```

### Programmatic Usage

```typescript
import { GitHubAgent, GitHubIndexer } from '@lytics/dev-agent-subagents';
import { RepositoryIndexer } from '@lytics/dev-agent-core';

// Initialize code indexer
const codeIndexer = new RepositoryIndexer({
  repositoryPath: '/path/to/repo',
  vectorStorePath: '/path/to/.vectors',
});
await codeIndexer.initialize();

// Initialize GitHub indexer
const githubIndexer = new GitHubIndexer(codeIndexer);

// Index GitHub data
const stats = await githubIndexer.index({
  includeIssues: true,
  includePullRequests: true,
  limit: 100,
});
console.log(`Indexed ${stats.totalDocuments} GitHub items`);

// Search for context
const results = await githubIndexer.search('authentication bug', {
  limit: 5,
});

// Get full context for an issue
const context = await githubIndexer.getContext(42, 'issue');
console.log(context.document);
console.log(context.relatedIssues);
console.log(context.relatedCode);
```

## Agent Integration

The GitHub Agent follows the standard agent pattern and integrates with the Coordinator.

### Registering with Coordinator

```typescript
import { 
  SubagentCoordinator,
  GitHubAgent 
} from '@lytics/dev-agent-subagents';
import { RepositoryIndexer } from '@lytics/dev-agent-core';

// Initialize code indexer
const codeIndexer = new RepositoryIndexer({
  repositoryPath: '/path/to/repo',
  vectorStorePath: '/path/to/.vectors',
});
await codeIndexer.initialize();

// Create coordinator
const coordinator = new SubagentCoordinator();

// Register GitHub agent
const githubAgent = new GitHubAgent({
  repositoryPath: '/path/to/repo',
  codeIndexer,
  storagePath: '/path/to/.github-index',
});

await coordinator.registerAgent(githubAgent);
```

### Sending Messages

The GitHub Agent supports the following actions via messages:

#### Index Action

```typescript
const response = await coordinator.sendMessage({
  type: 'request',
  sender: 'user',
  recipient: 'github',
  payload: {
    action: 'index',
    indexOptions: {
      includeIssues: true,
      includePullRequests: true,
      limit: 100,
    },
  },
});

// Response payload:
// {
//   action: 'index',
//   stats: {
//     totalDocuments: 150,
//     issues: 100,
//     pullRequests: 50,
//     discussions: 0,
//     ...
//   }
// }
```

#### Search Action

```typescript
const response = await coordinator.sendMessage({
  type: 'request',
  sender: 'user',
  recipient: 'github',
  payload: {
    action: 'search',
    query: 'authentication bug',
    searchOptions: {
      limit: 5,
      types: ['issue'],
    },
  },
});

// Response payload:
// {
//   action: 'search',
//   results: [
//     {
//       document: { ... },
//       score: 0.95,
//       matches: ['authentication', 'bug'],
//     },
//     ...
//   ]
// }
```

#### Context Action

```typescript
const response = await coordinator.sendMessage({
  type: 'request',
  sender: 'planner',
  recipient: 'github',
  payload: {
    action: 'context',
    issueNumber: 42,
  },
});

// Response payload:
// {
//   action: 'context',
//   context: {
//     document: { number: 42, title: '...', ... },
//     relatedIssues: [/* related issues */],
//     relatedCode: [/* linked code files */],
//   }
// }
```

#### Related Action

```typescript
const response = await coordinator.sendMessage({
  type: 'request',
  sender: 'explorer',
  recipient: 'github',
  payload: {
    action: 'related',
    issueNumber: 42,
  },
});

// Response payload:
// {
//   action: 'related',
//   related: [
//     { number: 43, title: '...', relevance: 0.8 },
//     ...
//   ]
// }
```

## Data Model

### GitHubDocument

Core document structure for all GitHub items:

```typescript
interface GitHubDocument {
  // Core identification
  type: 'issue' | 'pull_request' | 'discussion';
  number: number;
  id: string;
  
  // Content
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  
  // Metadata
  author: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  labels: string[];
  assignees: string[];
  
  // Relationships
  references: GitHubReference[];
  files: GitHubFileReference[];
  mentions: GitHubMention[];
  urls: GitHubUrl[];
  keywords: GitHubKeyword[];
  
  // Additional data
  comments?: GitHubCommentData[];
  reviews?: GitHubReviewData[];  // For PRs
  
  // PR-specific
  baseBranch?: string;
  headBranch?: string;
  mergedAt?: string;
  changedFiles?: number;
  additions?: number;
  deletions?: number;
}
```

### Relationship Types

The parser automatically extracts various relationships:

**Issue References:** `#123`, `GH-456`, `owner/repo#789`
**File Paths:** `src/auth/login.ts`, `packages/core/src/index.ts`
**Mentions:** `@username`
**URLs:** GitHub issue/PR URLs
**Keywords:** Important terms from title/body

## Implementation Details

### Fetching Strategy

Uses `gh` CLI for authenticated API access:

```bash
# Issues
gh api repos/{owner}/{repo}/issues --paginate

# Pull Requests
gh api repos/{owner}/{repo}/pulls --paginate

# Single issue with comments
gh api repos/{owner}/{repo}/issues/42
gh api repos/{owner}/{repo}/issues/42/comments
```

### Storage Strategy

**MVP (Current):** In-memory `Map` with simple text search
**Future:** Integration with VectorStorage for semantic embeddings

### Search Algorithm

1. **Text matching:** Title, body, and comments
2. **Relevance scoring:**
   - Title match: +5 per occurrence
   - Body match: +2 per occurrence
   - Label match: +3
   - Comment match: +1
3. **Filtering:** By type, state, labels
4. **Ranking:** Descending by relevance score

### Code Linking

When a GitHub document mentions a file path:

1. Parse file path from body/comments
2. Query `RepositoryIndexer` for matching file
3. Store bidirectional link
4. Include in context results

This enables:
- "Show me the code mentioned in issue #42"
- "Find issues discussing this file"

## Testing

### Unit Tests

```bash
# All parser utilities (100% coverage)
pnpm test packages/subagents/src/github/utils/parser.test.ts

# All fetcher utilities
pnpm test packages/subagents/src/github/utils/fetcher.test.ts
```

### Integration Tests

```bash
# GitHub Agent + Coordinator integration
pnpm test packages/subagents/src/coordinator/github-coordinator.integration.test.ts
```

**Coverage:**
- ✅ **Parser utilities:** 100% (47 tests)
- ✅ **Fetcher utilities:** 100% (23 tests)
- ✅ **Indexer:** 100% (9 tests)
- ✅ **Coordinator integration:** 100% (14 tests)
- ✅ **Total:** 79 tests, all passing

## Examples

### Use Case 1: Context for Planning

```typescript
// Planner agent requests GitHub context for an issue
const context = await coordinator.sendMessage({
  type: 'request',
  sender: 'planner',
  recipient: 'github',
  payload: {
    action: 'context',
    issueNumber: 10,
  },
});

// Use context to create informed plan
const plan = createPlanWithContext(
  context.payload.context.document,
  context.payload.context.relatedCode,
);
```

### Use Case 2: Finding Related Issues

```typescript
// When exploring a code file, find related GitHub discussions
const related = await coordinator.sendMessage({
  type: 'request',
  sender: 'explorer',
  recipient: 'github',
  payload: {
    action: 'search',
    query: 'vector store implementation',
    searchOptions: { types: ['issue', 'pull_request'] },
  },
});
```

### Use Case 3: Bulk Indexing

```typescript
// Index all open issues and recent PRs
await githubIndexer.index({
  includeIssues: true,
  includePullRequests: true,
  includeDiscussions: false,
  state: 'open',
  limit: 500,
});

// Get stats
const stats = await githubIndexer.getStats();
console.log(`Indexed ${stats.totalDocuments} items`);
console.log(`Issues: ${stats.issues}, PRs: ${stats.pullRequests}`);
```

## Configuration

### GitHubAgentConfig

```typescript
interface GitHubAgentConfig {
  repositoryPath: string;       // Path to git repository
  codeIndexer: RepositoryIndexer; // Code indexer instance
  storagePath?: string;          // Optional: custom storage path
}
```

### GitHubIndexOptions

```typescript
interface GitHubIndexOptions {
  includeIssues?: boolean;         // Default: true
  includePullRequests?: boolean;   // Default: true
  includeDiscussions?: boolean;    // Default: false
  state?: 'open' | 'closed' | 'all'; // Default: 'all'
  limit?: number;                  // Default: 500 (reduced from 1000 to prevent buffer overflow)
  repository?: string;             // Default: current repo
}
```

**Limit Recommendations:**
- **Default (500):** Works for most repositories
- **Large repos (200+ issues/PRs):** Use 100-200 to prevent ENOBUFS errors
- **Very active repos (500+ issues/PRs):** Start with 50-100
- **Small repos (<50 issues/PRs):** Can use higher limits (1000+)

## Error Handling

The agent handles errors gracefully and returns structured error responses:

```typescript
// Missing gh CLI
{
  action: 'index',
  error: 'GitHub CLI (gh) is not installed',
  code: 'GH_CLI_NOT_FOUND',
}

// Invalid issue number
{
  action: 'context',
  error: 'Issue #999 not found',
  code: 'ISSUE_NOT_FOUND',
}

// Buffer overflow (ENOBUFS)
{
  action: 'index',
  error: 'Failed to fetch issues: Output too large. Try using --gh-limit with a lower value (e.g., --gh-limit 100)',
  code: 'BUFFER_OVERFLOW',
}

// Network/API errors
{
  action: 'index',
  error: 'Failed to fetch issues: API rate limit exceeded',
  code: 'API_ERROR',
  details: '...',
}
```

**Buffer Management:**
- Uses 50MB maxBuffer for issue/PR fetching (up from default 1MB)
- Uses 10MB maxBuffer for repository metadata
- Provides helpful error messages suggesting --gh-limit flag on overflow
- Default limit of 500 prevents most buffer issues

## Performance Considerations

### Indexing Performance

- **Time:** ~1-2 seconds per 10 items (depends on API rate limits)
- **Memory:** ~5KB per document (in-memory storage)
- **Recommended batch size:** 500 items (default)
- **Buffer size:** 50MB for large payloads, 10MB for metadata

### Search Performance

- **Text search:** O(n) linear scan (MVP implementation)
- **Future semantic search:** O(log n) with vector index

### Optimization Tips

1. **Incremental indexing:** Only fetch new/updated items
2. **Filtering:** Use `state` and `types` to reduce dataset
3. **Caching:** Store frequently accessed contexts
4. **Batch processing:** For very large repos, index in batches with lower limits
   ```bash
   # Example: Index open items separately
   dev github index --state open --limit 500
   dev github index --state closed --limit 100
   ```

## Future Enhancements

- [ ] **Vector embeddings:** Semantic search with Transformers.js
- [ ] **Incremental updates:** Track last indexed timestamp
- [ ] **Persistent storage:** SQLite or LevelDB backend
- [ ] **Discussion support:** Full GitHub Discussions API integration
- [ ] **Smart linking:** AI-powered code-to-issue matching
- [ ] **Trend analysis:** Issue/PR patterns over time

## Troubleshooting

### `gh` CLI not found

```bash
# Install GitHub CLI
brew install gh  # macOS
# or visit https://cli.github.com/

# Authenticate
gh auth login
```

### ENOBUFS error during indexing

**Error:** `Failed to fetch issues: spawnSync /bin/sh ENOBUFS`

**Solution:**
```bash
# Use lower limit
dev github index --limit 100

# Or for very large repos
dev github index --limit 50

# Alternative: Index by state separately
dev github index --state open --limit 500
dev github index --state closed --limit 100
```

**Cause:** Buffer overflow when fetching many issues/PRs with large bodies. Default limit of 500 works for most repos, but very active repositories may need lower limits.

### No results when searching

1. Check if data is indexed: `dev github index`
2. Verify search query matches content
3. Check `state` filter (default: 'all')

### Missing code links

Ensure code files are indexed first:

```bash
dev index /path/to/repo
```

Then re-index GitHub data to rebuild links.

## Contributing

When adding features to the GitHub agent:

1. **Add utilities first:** Pure functions in `utils/`
2. **Write unit tests:** Aim for 100% coverage
3. **Update types:** Extend interfaces in `types.ts`
4. **Test integration:** Add coordinator integration tests
5. **Document:** Update this README

See [TESTABILITY.md](/docs/TESTABILITY.md) for detailed testing guidelines.

## See Also

- [Explorer Subagent](../explorer/README.md) - Code pattern discovery
- [Planner Subagent](../planner/README.md) - Task planning from GitHub issues
- [Coordinator](../coordinator/README.md) - Multi-agent orchestration

