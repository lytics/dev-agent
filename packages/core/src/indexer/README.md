# Repository Indexer

Orchestrates repository scanning, embedding generation, and vector storage for semantic code search.

## Overview

The Repository Indexer is the integration layer that ties together:
- **Scanner** - Extracts code structure and documentation
- **Embedder** - Generates semantic embeddings from code
- **Vector Store** - Efficiently stores and searches vectors

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   RepositoryIndexer                      │
│      Full pipeline orchestrator with state management    │
└────────────────────┬───────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
  ┌─────────┐  ┌──────────┐  ┌─────────┐
  │ Scanner │  │ Embedder │  │  Vector │
  │Registry │  │(Transf.) │  │  Store  │
  └─────────┘  └──────────┘  └─────────┘
```

### Data Flow

```
1. Scan → Extract documents from repository
2. Prepare → Format documents for embedding  
3. Embed → Generate vectors (batched)
4. Store → Save to vector database
5. Track → Update state for incremental updates
```

## Usage Examples

### Basic Indexing

```typescript
import { RepositoryIndexer } from '@lytics/dev-agent-core';

// Initialize indexer
const indexer = new RepositoryIndexer({
  repositoryPath: '/path/to/repo',
  vectorStorePath: './.dev-agent/vectors.lance',
});

await indexer.initialize();

// Index the repository
const stats = await indexer.index();

console.log(`Indexed ${stats.filesScanned} files`);
console.log(`Generated ${stats.documentsIndexed} embeddings`);
console.log(`Completed in ${stats.duration}ms`);

// Search indexed content
const results = await indexer.search('authentication logic', {
  limit: 10,
  scoreThreshold: 0.7,
});

for (const result of results) {
  console.log(`${result.metadata.path} (score: ${result.score.toFixed(2)})`);
}

await indexer.close();
```

### Progress Tracking

```typescript
const stats = await indexer.index({
  onProgress: (progress) => {
    console.log(`Phase: ${progress.phase}`);
    console.log(`Progress: ${progress.filesProcessed}/${progress.totalFiles}`);
    console.log(`${progress.percentComplete.toFixed(0)}% complete`);
    
    if (progress.currentFile) {
      console.log(`Processing: ${progress.currentFile}`);
    }
  },
});
```

### Incremental Updates

```typescript
// Initial index
await indexer.index();

// ... time passes, files change ...

// Update only changed files
const updateStats = await indexer.update();

console.log(`Reindexed ${updateStats.filesScanned} changed files`);
console.log(`Updated ${updateStats.documentsIndexed} documents`);
```

### Custom Configuration

```typescript
const indexer = new RepositoryIndexer({
  repositoryPath: './my-repo',
  vectorStorePath: './.vectors/my-repo.lance',
  
  // Custom embedding model
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  embeddingDimension: 384,
  
  // Batch size for embedding generation
  batchSize: 32,
  
  // Exclude patterns
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.test.ts',
  ],
  
  // Limit to specific languages
  languages: ['typescript', 'javascript', 'markdown'],
  
  // Custom state path
  statePath: './.dev-agent/custom-state.json',
});
```

### Language Filtering

```typescript
// Index only TypeScript files
await indexer.index({
  languages: ['typescript'],
});

// Index TypeScript and Markdown
await indexer.index({
  languages: ['typescript', 'markdown'],
});
```

### Error Handling

```typescript
const stats = await indexer.index();

if (stats.errors.length > 0) {
  console.log('Errors encountered during indexing:');
  for (const error of stats.errors) {
    console.log(`[${error.type}] ${error.message}`);
    if (error.file) {
      console.log(`  File: ${error.file}`);
    }
  }
}
```

## Input/Output Examples

### Configuration Input

```typescript
{
  repositoryPath: '/Users/dev/my-project',
  vectorStorePath: './.dev-agent/vectors.lance',
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  embeddingDimension: 384,
  batchSize: 32,
  excludePatterns: ['**/node_modules/**'],
  languages: ['typescript', 'javascript']
}
```

### IndexStats Output

```typescript
{
  filesScanned: 45,
  documentsExtracted: 152,
  documentsIndexed: 152,
  vectorsStored: 152,
  duration: 8432,  // milliseconds
  errors: [],
  startTime: Date('2025-11-22T10:00:00.000Z'),
  endTime: Date('2025-11-22T10:00:08.432Z'),
  repositoryPath: '/Users/dev/my-project'
}
```

### SearchResult Output

```typescript
[
  {
    id: 'src/auth/middleware.ts:AuthMiddleware:15',
    score: 0.89,
    metadata: {
      path: 'src/auth/middleware.ts',
      type: 'class',
      language: 'typescript',
      name: 'AuthMiddleware',
      startLine: 15,
      endLine: 42,
      exported: true,
      signature: 'export class AuthMiddleware {...}'
    }
  },
  {
    id: 'src/auth/jwt.ts:verifyToken:5',
    score: 0.84,
    metadata: {
      path: 'src/auth/jwt.ts',
      type: 'function',
      language: 'typescript',
      name: 'verifyToken',
      startLine: 5,
      endLine: 12,
      exported: true
    }
  }
]
```

## Real-World Example: Indexing a Full Repository

```typescript
import { RepositoryIndexer } from '@lytics/dev-agent-core';
import * as path from 'path';

async function indexRepository(repoPath: string) {
  console.log(`Indexing repository: ${repoPath}`);
  
  // Create indexer
  const indexer = new RepositoryIndexer({
    repositoryPath: repoPath,
    vectorStorePath: path.join(repoPath, '.dev-agent', 'vectors.lance'),
    batchSize: 32,
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/coverage/**',
    ],
  });

  try {
    // Initialize
    await indexer.initialize();
    console.log('Indexer initialized');

    // Index with progress tracking
    const stats = await indexer.index({
      onProgress: (progress) => {
        const percent = progress.percentComplete.toFixed(0);
        process.stdout.write(`\r[${percent}%] ${progress.phase}: ${progress.filesProcessed}/${progress.totalFiles} files`);
      },
    });

    // Print results
    console.log('\n\nIndexing Complete!');
    console.log('──────────────────────');
    console.log(`Files scanned:      ${stats.filesScanned}`);
    console.log(`Documents extracted: ${stats.documentsExtracted}`);
    console.log(`Vectors stored:     ${stats.vectorsStored}`);
    console.log(`Duration:           ${(stats.duration / 1000).toFixed(2)}s`);
    
    if (stats.errors.length > 0) {
      console.log(`\nErrors: ${stats.errors.length}`);
      for (const error of stats.errors.slice(0, 5)) {
        console.log(`  • ${error.message}`);
      }
    }

    // Example searches
    console.log('\n\nExample Searches:');
    console.log('─────────────────');
    
    const queries = [
      'authentication and authorization',
      'database connection setup',
      'API endpoint handlers',
    ];

    for (const query of queries) {
      const results = await indexer.search(query, { limit: 3 });
      console.log(`\nQuery: "${query}"`);
      for (const result of results) {
        console.log(`  ${result.score.toFixed(2)} - ${result.metadata.path}`);
      }
    }

  } finally {
    await indexer.close();
  }
}

// Run
indexRepository(process.argv[2] || '.');
```

## State Management

The indexer maintains state for incremental updates:

### State File Location

```
<repository>/.dev-agent/indexer-state.json
```

### State Structure

```typescript
{
  version: "1.0.0",
  embeddingModel: "Xenova/all-MiniLM-L6-v2",
  embeddingDimension: 384,
  repositoryPath: "/path/to/repo",
  lastIndexTime: "2025-11-22T10:00:00.000Z",
  files: {
    "src/auth.ts": {
      path: "src/auth.ts",
      hash: "a1b2c3d4...",
      lastModified: "2025-11-22T09:00:00.000Z",
      lastIndexed: "2025-11-22T10:00:00.000Z",
      documentIds: ["src/auth.ts:authenticate:10", "src/auth.ts:logout:25"],
      size: 1024,
      language: "typescript"
    }
  },
  stats: {
    totalFiles: 45,
    totalDocuments: 152,
    totalVectors: 152
  }
}
```

## Performance Characteristics

### Indexing Speed

| Repository Size | Files | Documents | Duration | Speed |
|----------------|-------|-----------|----------|-------|
| Small | 10-50 | 50-200 | 5-15s | ~10-15 docs/s |
| Medium | 100-500 | 500-2K | 1-3min | ~15-20 docs/s |
| Large | 1K-5K | 5K-20K | 5-15min | ~20-25 docs/s |

### Memory Usage

- **Base**: ~100MB (embedder model)
- **Per 1K docs**: ~2-5MB (vectors + metadata)
- **Batch processing**: Controlled by `batchSize` parameter

### Storage

- **Vector data**: ~1.5KB per document (384 float32 + metadata)
- **State file**: ~1KB per file tracked
- **1K documents**: ~1.5-2MB total

## API Reference

### RepositoryIndexer

```typescript
class RepositoryIndexer {
  constructor(config: IndexerConfig)
  
  // Initialize embedder and vector store
  initialize(): Promise<void>
  
  // Full repository indexing
  index(options?: IndexOptions): Promise<IndexStats>
  
  // Incremental update (only changed files)
  update(options?: UpdateOptions): Promise<IndexStats>
  
  // Search indexed content
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  
  // Get current indexing statistics
  getStats(): Promise<IndexStats | null>
  
  // Close and cleanup
  close(): Promise<void>
}
```

### Types

```typescript
interface IndexerConfig {
  repositoryPath: string;
  vectorStorePath: string;
  statePath?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  batchSize?: number;
  excludePatterns?: string[];
  languages?: string[];
}

interface IndexOptions {
  batchSize?: number;
  excludePatterns?: string[];
  languages?: string[];
  force?: boolean;
  onProgress?: (progress: IndexProgress) => void;
}

interface IndexStats {
  filesScanned: number;
  documentsExtracted: number;
  documentsIndexed: number;
  vectorsStored: number;
  duration: number;
  errors: IndexError[];
  startTime: Date;
  endTime: Date;
  repositoryPath: string;
}

interface IndexProgress {
  phase: 'scanning' | 'embedding' | 'storing' | 'complete';
  filesProcessed: number;
  totalFiles: number;
  documentsIndexed: number;
  currentFile?: string;
  percentComplete: number;
}
```

## Best Practices

### 1. Start with Default Settings

```typescript
// Simple setup works great for most repos
const indexer = new RepositoryIndexer({
  repositoryPath: './my-repo',
  vectorStorePath: './.dev-agent/vectors.lance',
});
```

### 2. Use Incremental Updates

```typescript
// Initial index (slow)
await indexer.index();

// Later updates (fast, only changed files)
await indexer.update();
```

### 3. Monitor Progress for Large Repos

```typescript
let lastProgress = 0;
await indexer.index({
  onProgress: (progress) => {
    if (progress.percentComplete - lastProgress >= 10) {
      console.log(`${progress.percentComplete}% - ${progress.phase}`);
      lastProgress = progress.percentComplete;
    }
  },
});
```

### 4. Handle Errors Gracefully

```typescript
const stats = await indexer.index();

if (stats.errors.length > 0) {
  console.warn(`Completed with ${stats.errors.length} errors`);
  // Continue - partial results are still useful
}
```

### 5. Close When Done

```typescript
try {
  await indexer.initialize();
  await indexer.index();
  await indexer.search('query');
} finally {
  await indexer.close();  // Always cleanup
}
```

## Limitations & Future Work

### Current Limitations

1. **File Detection**: May not detect all file changes (relies on content hash)
2. **Large Files**: Very large files (>1MB) may be slow to process
3. **Delete Operation**: Vector store delete not yet implemented (affects incremental updates)
4. **Language Support**: Limited to languages with registered scanners

### Future Enhancements

- [ ] Watch mode for real-time indexing
- [ ] Parallel file processing for faster indexing
- [ ] Smart batching based on document size
- [ ] Compression for state files
- [ ] Metadata-based search filters
- [ ] Multi-repository indexing
- [ ] Index versioning and rollback

## Testing

The indexer has **16 comprehensive tests** with **75.2% statement coverage** and **100% function coverage**:

```bash
# Run tests
pnpm test packages/core/src/indexer

# Run with coverage
npx vitest run packages/core/src/indexer --coverage
```

## Troubleshooting

### No Files Being Scanned

```typescript
// Check default exclusions aren't too broad
const stats = await indexer.index({
  excludePatterns: [],  // Start with no exclusions
});

// Or be explicit about what to include
const stats = await indexer.index({
  languages: ['typescript'],
});
```

### Slow Indexing

```typescript
// Increase batch size (uses more memory)
const indexer = new RepositoryIndexer({
  repositoryPath: './repo',
  vectorStorePath: './vectors.lance',
  batchSize: 64,  // Default is 32
});
```

### High Memory Usage

```typescript
// Decrease batch size
const indexer = new RepositoryIndexer({
  repositoryPath: './repo',
  vectorStorePath: './vectors.lance',
  batchSize: 16,  // Lower batch size
});
```

### State File Corruption

```bash
# Remove state file to start fresh
rm -rf .dev-agent/indexer-state.json

# Then reindex
await indexer.index({ force: true });
```

## License

MIT

