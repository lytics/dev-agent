# Vector Storage System

Local-first semantic search powered by **LanceDB** and **Transformers.js**.

## Overview

The vector storage system provides semantic search capabilities for code and documentation. It combines:

- **LanceDB**: Embedded vector database with efficient columnar storage
- **Transformers.js**: Local ML model (all-MiniLM-L6-v2) for generating embeddings
- **Zero configuration**: No API keys, servers, or external dependencies
- **Offline-capable**: Models cached locally after first download

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VectorStorage                          │
│  (High-level orchestrator)                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────────┐      ┌──────────────────┐
│ TransformersEmbedder│      │ LanceDBVectorStore│
│  - all-MiniLM-L6-v2 │      │  - Vector search  │
│  - 384 dimensions   │      │  - Metadata       │
│  - Local inference  │      │  - Persistence    │
└───────────────────┘      └──────────────────┘
```

### Key Components

1. **VectorStorage** - Main interface for semantic search
2. **TransformersEmbedder** - Converts text to 384-dim vectors
3. **LanceDBVectorStore** - Stores and searches vectors efficiently

## Usage Examples

### Basic Setup

```typescript
import { VectorStorage } from '@lytics/dev-agent-core';

// Initialize with default settings (all-MiniLM-L6-v2, 384 dimensions)
const storage = new VectorStorage({
  storePath: './vector-data/my-project.lance',
});

await storage.initialize();
```

### Adding Documents

```typescript
import type { EmbeddingDocument } from '@lytics/dev-agent-core';

const documents: EmbeddingDocument[] = [
  {
    id: 'auth-middleware',
    text: 'Authentication middleware that validates JWT tokens and checks user permissions',
    metadata: {
      type: 'function',
      file: 'src/middleware/auth.ts',
      language: 'typescript',
    },
  },
  {
    id: 'user-model',
    text: 'User model with fields for email, password hash, and role',
    metadata: {
      type: 'class',
      file: 'src/models/User.ts',
      language: 'typescript',
    },
  },
  {
    id: 'api-docs',
    text: 'REST API documentation for authentication endpoints including login and logout',
    metadata: {
      type: 'documentation',
      file: 'docs/api/auth.md',
      language: 'markdown',
    },
  },
];

// Embeddings generated automatically
await storage.addDocuments(documents);
```

### Semantic Search

```typescript
// Find relevant code/docs based on natural language query
const results = await storage.search('How do I authenticate users?', {
  limit: 5,
  scoreThreshold: 0.7, // Only return results with >70% similarity
});

for (const result of results) {
  console.log(`ID: ${result.id}`);
  console.log(`Score: ${result.score}`);
  console.log(`File: ${result.metadata.file}`);
  console.log(`Type: ${result.metadata.type}`);
  console.log('---');
}

// Example output:
// ID: auth-middleware
// Score: 0.89
// File: src/middleware/auth.ts
// Type: function
// ---
// ID: api-docs
// Score: 0.84
// File: docs/api/auth.md
// Type: documentation
```

### Batch Operations

```typescript
// Efficiently process large batches
const largeBatch: EmbeddingDocument[] = codeFiles.map((file, i) => ({
  id: `file-${i}`,
  text: file.content,
  metadata: {
    path: file.path,
    language: file.language,
  },
}));

// Embeddings generated in batches of 32 for efficiency
await storage.addDocuments(largeBatch);
```

### Retrieving by ID

```typescript
// Get specific document
const doc = await storage.getDocument('auth-middleware');

if (doc) {
  console.log(doc.text);
  console.log(doc.metadata);
}
```

### Statistics

```typescript
const stats = await storage.getStats();

console.log(`Model: ${stats.modelName}`);
console.log(`Dimensions: ${stats.dimension}`);
console.log(`Total documents: ${stats.totalDocuments}`);
```

## Input/Output Examples

### Input: EmbeddingDocument

```typescript
{
  id: "utils-helper-123",
  text: "Function that formats date objects into ISO 8601 strings for API responses",
  metadata: {
    type: "function",
    file: "src/utils/date.ts",
    language: "typescript",
    startLine: 45,
    endLine: 52
  }
}
```

### Output: SearchResult

```typescript
{
  id: "utils-helper-123",
  score: 0.87,  // Cosine similarity (0-1)
  metadata: {
    type: "function",
    file: "src/utils/date.ts",
    language: "typescript",
    startLine: 45,
    endLine: 52
  }
}
```

## Real-World Example: Repository Indexing

```typescript
import { scanRepository } from '@lytics/dev-agent-core';
import { VectorStorage } from '@lytics/dev-agent-core';

// 1. Scan repository for code components
const scanResult = await scanRepository('/path/to/repo', {
  include: ['src/**/*.ts', 'docs/**/*.md'],
});

// 2. Convert scanned documents to embedding documents
const documents = scanResult.documents.map((doc) => ({
  id: doc.id,
  text: `${doc.name}: ${doc.content}`, // Combine name and content for better context
  metadata: {
    type: doc.type,
    path: doc.path,
    language: doc.language,
    ...doc.metadata,
  },
}));

// 3. Initialize vector storage
const storage = new VectorStorage({
  storePath: './vector-data/my-repo.lance',
});
await storage.initialize();

// 4. Index all documents
console.log(`Indexing ${documents.length} documents...`);
await storage.addDocuments(documents);

// 5. Semantic search
const query = 'Find authentication and authorization logic';
const results = await storage.search(query, { limit: 10 });

console.log(`Found ${results.length} relevant results:`);
for (const result of results) {
  console.log(`- ${result.metadata.path} (score: ${result.score.toFixed(2)})`);
}

// 6. Cleanup
await storage.close();
```

## Performance Characteristics

### Embedding Generation

- **Cold start**: ~1-2 seconds (loading model)
- **Single embed**: ~5-10ms per document
- **Batch embed**: ~10-20ms per document (batches of 32)
- **Large batch (100 docs)**: ~2-3 seconds total

### Vector Search

- **Query latency**: ~10-20ms (includes embedding query)
- **Storage**: ~1.5KB per document (384 float32 + metadata)
- **Scalability**: Efficient for millions of vectors (columnar format)

### Comparison to Alternatives

| Feature | Our Approach (LanceDB) | Hash-based (claude-flow) |
|---------|------------------------|--------------------------|
| **Search Type** | Semantic similarity | Lexical pattern matching |
| **Query Time** | ~10-20ms | <1ms |
| **Quality** | Finds conceptually similar code | Requires lexical overlap |
| **Setup** | Download 50MB model once | Zero setup |
| **Use Case** | Code intelligence, RAG | Pattern cache, exact match |
| **Offline** | ✅ Full offline after download | ✅ Always offline |

**Why LanceDB for Code Intelligence?**

```typescript
// Semantic search finds these as related even with different words:
Query: "authentication flow"
Finds:
- OAuth2 token validation middleware
- JWT verification utility
- User session management
// Even though they don't contain "authentication flow"

// Hash-based would only find exact/similar text patterns
```

## API Reference

### VectorStorage

```typescript
class VectorStorage {
  constructor(config: VectorStorageConfig)
  
  // Initialize embedder and store
  initialize(): Promise<void>
  
  // Add documents (embeddings generated automatically)
  addDocuments(documents: EmbeddingDocument[]): Promise<void>
  
  // Semantic search
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  
  // Get document by ID
  getDocument(id: string): Promise<EmbeddingDocument | null>
  
  // Delete documents (not yet implemented for LanceDB)
  deleteDocuments(ids: string[]): Promise<void>
  
  // Get statistics
  getStats(): Promise<VectorStats>
  
  // Close connections
  close(): Promise<void>
}
```

### Types

```typescript
interface VectorStorageConfig {
  storePath: string;           // Path to LanceDB store
  embeddingModel?: string;     // Default: 'Xenova/all-MiniLM-L6-v2'
  dimension?: number;          // Default: 384
}

interface EmbeddingDocument {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

interface SearchOptions {
  limit?: number;              // Default: 10
  scoreThreshold?: number;     // Default: 0 (return all)
}

interface SearchResult {
  id: string;
  score: number;               // 0-1 (cosine similarity)
  metadata: Record<string, unknown>;
}

interface VectorStats {
  modelName: string;
  dimension: number;
  totalDocuments: number;
}
```

## Advanced Usage

### Custom Embedding Model

```typescript
const storage = new VectorStorage({
  storePath: './data.lance',
  embeddingModel: 'Xenova/all-MiniLM-L12-v2', // Larger model
  dimension: 384,
});
```

### Low-level Components

For more control, use the components directly:

```typescript
import { TransformersEmbedder, LanceDBVectorStore } from '@lytics/dev-agent-core';

// 1. Create embedder
const embedder = new TransformersEmbedder();
await embedder.initialize();

// 2. Generate embeddings
const texts = ['First text', 'Second text'];
const embeddings = await embedder.embedBatch(texts);

// 3. Create store
const store = new LanceDBVectorStore('./data.lance');
await store.initialize();

// 4. Store vectors
await store.add(
  [
    { id: '1', text: texts[0], metadata: {} },
    { id: '2', text: texts[1], metadata: {} },
  ],
  embeddings
);

// 5. Search
const queryEmbedding = await embedder.embed('search query');
const results = await store.search(queryEmbedding, { limit: 5 });
```

### Batch Size Tuning

```typescript
const embedder = new TransformersEmbedder();
await embedder.initialize();

// Default is 32, adjust based on memory constraints
embedder.setBatchSize(16); // Lower for memory-constrained environments
embedder.setBatchSize(64); // Higher for more parallel processing
```

## Best Practices

### 1. Meaningful Text Content

```typescript
// ❌ Poor: Just the function name
{
  id: 'func1',
  text: 'getUserById',
  metadata: {}
}

// ✅ Good: Name + description + context
{
  id: 'func1',
  text: 'getUserById: Retrieves user from database by ID, includes validation and error handling',
  metadata: { type: 'function', file: 'users.ts' }
}
```

### 2. Rich Metadata

```typescript
// Store queryable information in metadata
{
  id: 'component-123',
  text: 'React component for user authentication form',
  metadata: {
    type: 'component',
    framework: 'react',
    file: 'src/components/AuthForm.tsx',
    dependencies: ['useState', 'useEffect'],
    exports: ['AuthForm'],
    tags: ['auth', 'form', 'ui'],
  }
}
```

### 3. Incremental Indexing

```typescript
// Index new files as they're added
async function indexNewFile(filePath: string) {
  const content = await readFile(filePath);
  const doc = {
    id: filePath,
    text: content,
    metadata: { path: filePath, indexed: Date.now() },
  };
  
  await storage.addDocuments([doc]);
}
```

### 4. Query Optimization

```typescript
// Use specific queries for better results
❌ const results = await storage.search('code');
✅ const results = await storage.search('authentication middleware with JWT validation');

// Use score threshold to filter low-quality matches
✅ const results = await storage.search(query, { scoreThreshold: 0.7 });
```

## Limitations & Future Work

### Current Limitations

1. **Delete operation**: Not yet implemented for LanceDB (requires API update)
2. **Model size**: 50MB download on first run (cached thereafter)
3. **Context length**: Model supports ~512 tokens (use summaries for long docs)
4. **Multi-language**: Single model for all languages (language-specific models possible)

### Future Enhancements

- [ ] Implement delete operation when LanceDB API stabilizes
- [ ] Add support for larger embedding models (768, 1024 dimensions)
- [ ] Implement hybrid search (semantic + keyword)
- [ ] Add re-ranking for improved precision
- [ ] Support for incremental updates (modify existing documents)
- [ ] Metadata filtering in search queries
- [ ] Multi-modal embeddings (code + documentation together)

## Testing

The vector storage system has **85.6% test coverage** with **40 comprehensive tests**:

```bash
# Run tests
pnpm test packages/core/src/vector

# Run with coverage
npx vitest run packages/core/src/vector --coverage
```

**Coverage breakdown:**
- ✅ 100% function coverage
- ✅ 85.6% statement coverage
- ✅ 89.2% line coverage

## Troubleshooting

### Model Download Issues

```typescript
// Models are cached in .dev-agent/models/
// If download fails, check network and retry:
await storage.initialize(); // Will re-attempt download
```

### Memory Issues

```typescript
// Reduce batch size for memory-constrained environments
const embedder = new TransformersEmbedder();
embedder.setBatchSize(8); // Lower batch size
```

### Slow Performance

```typescript
// Ensure model is initialized once and reused
const storage = new VectorStorage({ storePath: './data.lance' });
await storage.initialize(); // Do this once

// Reuse for multiple operations
await storage.addDocuments(batch1);
await storage.addDocuments(batch2);
await storage.search(query1);
await storage.search(query2);
```

## License

MIT

