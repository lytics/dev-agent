# dev-agent Architecture

## Overview

Personal tool combining deep code intelligence with specialized AI subagents. CLI-first approach with optional integrations later.

**Core capabilities:**
- Multi-language code analysis (TypeScript, Go, Python, Rust)
- Semantic + structural search
- Specialized agents (Planner, Explorer, PR Manager)
- GitHub integration

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              CLI Interface                  │
│   (Beautiful output, JSON mode)             │
└────────────────┬────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼──────┐    ┌────────▼─────────┐
│ Intelligence│    │    Subagents    │
│   Layer    │◄───┤     Layer       │
│            │    │                 │
│ • Scanner  │    │ • Coordinator   │
│ • Embedder │    │ • Planner       │
│ • Vectors  │    │ • Explorer      │
│ • Indexer  │    │ • PR Manager    │
└────────────┘    └─────────────────┘
```

**Key insight:** Subagents use the intelligence layer to be smart about code.

---

## Technical Decisions

### Why Tree-sitter + ts-morph?

**Problem:** Need multi-language support with varying depth.

**Solution:** Hybrid approach
- **tree-sitter**: Universal parser (Go, Python, Rust) - syntax-level
- **ts-morph**: Enhanced TypeScript scanner - types, references
- **remark**: Markdown documentation

**Trade-off:** More complexity, but gets us real multi-language support.

### Why @xenova/transformers?

**Problem:** Need embeddings, but want local-first.

**Options considered:**
- TensorFlow.js: Older, limited models
- OpenAI API: Best quality but requires API key
- @xenova/transformers: Modern, all-MiniLM-L6-v2

**Choice:** @xenova/transformers
- Local (no API keys)
- Good quality (384 dims)
- Active development

### Why LanceDB?

**Problem:** Need vector storage without running a server.

**Options considered:**
- ChromaDB: Requires server process
- FAISS: Python-focused
- In-memory: Doesn't persist
- LanceDB: Embedded, TypeScript-native

**Choice:** LanceDB (embedded, no server)

### Why CLI-first?

**Problem:** MCP is only 1 month old, uncertain adoption.

**Solution:** Build CLI core, add integrations later
- CLI works immediately
- Can add MCP/VS Code/API when mature
- JSON output enables scripting

---

## Component Design

### Scanner System (Issue #3)

```typescript
interface Scanner {
  readonly language: string;
  readonly capabilities: ScannerCapabilities;
  scan(files: string[]): Promise<Document[]>;
}

interface ScannerCapabilities {
  syntax: boolean;        // All scanners
  types?: boolean;        // TypeScript only (for now)
  references?: boolean;   // Cross-file refs
  documentation?: boolean; // Doc comments
}

interface Document {
  id: string;           // file:name:line
  text: string;         // Text to embed
  type: 'function' | 'class' | 'interface' | 'doc';
  language: string;
  metadata: {
    file: string;
    startLine: number;
    endLine: number;
    name?: string;
    signature?: string;
    exported: boolean;
  };
}
```

**Implementations:**
- `TreeSitterScanner` - Base for Go, Python, Rust
- `TypeScriptScanner` - Enhanced with ts-morph
- `MarkdownScanner` - Documentation via remark

### Vector Storage (Issue #4)

```typescript
interface EmbeddingProvider {
  getDimension(): number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

interface VectorStore {
  initialize(): Promise<void>;
  upsert(items: VectorItem[]): Promise<void>;
  search(query: number[], options: SearchOptions): Promise<SearchResult[]>;
}
```

**Why pluggable?** Technology changes fast. Easy to swap:
- Embedders: transformers → OpenAI → Ollama
- Stores: LanceDB → ChromaDB → in-memory (testing)

### Repository Indexer (Issue #12)

```typescript
interface RepositoryIndexer {
  index(path: string): Promise<IndexStats>;
  update(path: string): Promise<IndexStats>; // Incremental
  search(query: string): Promise<SearchResult[]>;
}
```

**Flow:**
1. Walk file tree
2. Detect language → select scanner
3. Extract Documents
4. Batch embed → store vectors
5. Track metadata for incremental updates

### Subagents (Issues #7-10)

```typescript
interface Subagent {
  initialize(options: SubagentOptions): Promise<void>;
  handleMessage(message: SubagentMessage): Promise<SubagentMessage | null>;
}

// Coordinator manages agent lifecycle
interface SubagentCoordinator {
  registerAgent(agent: Subagent): void;
  allocateTask(task: Task): Promise<string>;
  routeMessage(message: SubagentMessage): Promise<void>;
}
```

**Learns from claude-flow:**
- Message passing patterns
- Error handling
- Task allocation

**Our specialization:**
- Code-specific task types
- Enriches messages with code context
- GitHub-aware coordination

---

## CLI Design

### Command Structure

```bash
dev-agent index                    # Index current repo
dev-agent search "query"           # Semantic search
dev-agent scan                     # Show structure

dev-agent plan --issue 42          # Planner subagent
dev-agent explore "patterns"       # Explorer subagent
dev-agent pr create                # PR subagent

dev-agent search "query" --json    # JSON output
```

### Output Principles

**Inspired by:** gh, ripgrep, eza, claude CLI

1. **Fast feedback** - Show progress for long operations
2. **Clear output** - Colors, icons, formatting
3. **Helpful errors** - Suggest fixes, not just error codes
4. **Discoverable** - Good `--help` and examples

### Libraries

- `commander.js` - Command parsing
- `chalk` - Terminal colors
- `ora` - Elegant spinners
- `cli-table3` - Pretty tables
- `boxen` - Styled boxes

---

## Technology Stack

### Core
- TypeScript (strict mode)
- Node.js >= 22 LTS
- pnpm 8.15.4
- Turborepo

### Intelligence
- tree-sitter (multi-language parsing)
- ts-morph (TypeScript analysis)
- remark (Markdown)
- @xenova/transformers (embeddings)
- LanceDB (vector storage)
- GitHub CLI (GitHub operations)

### CLI
- Commander.js + chalk/ora/cli-table3

### Quality
- Biome (linting/formatting)
- Vitest (testing)
- GitHub Actions (CI/CD)

---

## Implementation Order

### Phase 1: Intelligence Layer (Weeks 1-8)
**Goal:** Can index and search codebases

1. **Issue #3: Scanner** (2 weeks)
   - Tree-sitter base scanner
   - TypeScript scanner (ts-morph)
   - Markdown scanner (remark)
   - Scanner registry

2. **Issue #4: Vector Storage** (2 weeks)
   - TransformersEmbedder (all-MiniLM-L6-v2)
   - LanceDBVectorStore
   - InMemoryVectorStore (testing)

3. **Issue #12: Indexer** (2 weeks)
   - Wire scanner + embedder + storage
   - Incremental indexing (file hashes)
   - Batch processing

4. **Issue #6: CLI** (2 weeks)
   - Command structure
   - Beautiful output (colors, spinners, tables)
   - JSON mode
   - Help text

**Deliverable:** `dev-agent index` and `dev-agent search` work beautifully

### Phase 2: Subagent Layer (Weeks 9-14)
**Goal:** Add specialized agents

5. **Issue #7: Coordinator** (1 week)
   - Agent registry
   - Message passing
   - Task allocation

6. **Issue #8: Planner** (2 weeks)
   - GitHub issue analysis
   - Task breakdown using code context
   - Plan output

7. **Issue #9: Explorer** (2 weeks)
   - Pattern discovery
   - Relationship mapping
   - Similar code identification

8. **Issue #10: PR Manager** (1 week)
   - Branch management
   - PR creation with AI descriptions
   - GitHub CLI integration

**Deliverable:** `dev-agent plan`, `dev-agent explore`, `dev-agent pr` work

### Phase 3: Integrations (Optional, Later)
**Goal:** If CLI proves useful, add integrations

- MCP Server (when protocol matures)
- VS Code Extension (for better UX)
- REST API (for custom tooling)

**Don't build until Phase 1 & 2 prove valuable!**

---

## Configuration

### Default Config (`.dev-agent/config.json`)

```json
{
  "embedder": "transformers",
  "vectorStore": {
    "type": "lancedb",
    "path": ".dev-agent/vectors"
  },
  "exclude": [
    "node_modules",
    "dist",
    "build",
    ".git"
  ],
  "languages": ["typescript", "javascript", "go", "python", "rust", "markdown"]
}
```

### Storage Structure

```
.dev-agent/
├── config.json           # User configuration
├── vectors/              # LanceDB storage
├── cache/                # Model cache
└── logs/                 # Debug logs
```

---

## Design Principles

1. **Local-first** - Works offline, no API keys required
2. **Pluggable** - Swap embedders, scanners, stores easily
3. **Multi-language** - Go, Python, Rust, not just TypeScript
4. **CLI-first** - Beautiful terminal UX
5. **Fast** - Search <100ms, index efficiently
6. **Build for daily use** - If you don't use it, it's not worth building

---

## Testing Strategy

### Unit Tests
- Scanner implementations (tree-sitter, ts-morph)
- Embedder implementations
- Vector store implementations

### Integration Tests
- End-to-end indexing flow
- Search quality tests
- Subagent coordination

### Manual Testing
- Use on dev-agent itself (dogfooding)
- Test on real multi-language repos
- CLI UX testing (is it actually nice to use?)

### Coverage Target
- Core logic: >80%
- CLI commands: >60%
- Integration tests: Critical paths only

---

## Performance Targets

- **Indexing:** 10k files in <5 minutes
- **Search:** <100ms for repos <1k files, <500ms for larger
- **Memory:** <500MB for typical repos
- **Startup:** CLI responds in <200ms

---

## Future Enhancements

**If the tool proves useful:**

### Enhanced Language Support
- Go: Add type analysis (go/types)
- Python: Type hints via mypy
- Rust: Trait/ownership analysis

### Additional Subagents
- Reviewer: Code review suggestions
- Migrator: Help with refactors
- Documenter: Generate docs
- Tester: Suggest test cases

### Integrations
- MCP Server: For Claude Code/Cursor
- VS Code Extension: Native IDE experience
- REST API: For custom tooling

**Build these only if needed!**
