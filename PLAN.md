# Dev-Agent Roadmap

> **Mission:** Be the best context provider for AI coding tools. Don't compete with LLMs—empower them.

Dev-agent provides semantic code search, codebase intelligence, and GitHub integration through MCP (Model Context Protocol). The LLM does the reasoning; we provide the context.

---

## Philosophy

**What we are:**
- Best-in-class code indexing (fast, accurate, multi-language)
- Relationship intelligence (call graphs, dependencies, imports)
- Structured data provider (let LLMs synthesize)
- Token-efficient context (progressive disclosure)
- Local-first (no API keys, no cloud dependency)

**What we are NOT:**
- An AI coding assistant (that's Claude/Cursor's job)
- A natural language summarizer (LLMs do this better)
- A task planner (provide context, let LLMs plan)

---

## Completed ✅

### Phase 1: Core Intelligence Layer

| Feature | Status | Package |
|---------|--------|---------|
| TypeScript scanner (ts-morph) | ✅ Done | `@lytics/dev-agent-core` |
| Repository indexer | ✅ Done | `@lytics/dev-agent-core` |
| Vector storage (LanceDB) | ✅ Done | `@lytics/dev-agent-core` |
| Embeddings (@xenova/transformers) | ✅ Done | `@lytics/dev-agent-core` |
| Semantic search | ✅ Done | `@lytics/dev-agent-core` |
| CLI interface | ✅ Done | `@lytics/dev-agent-cli` |
| Centralized logging | ✅ Done | `@lytics/kero` |

### Phase 2: MCP Integration

| Feature | Status | Package |
|---------|--------|---------|
| MCP server architecture | ✅ Done | `@lytics/dev-agent-mcp` |
| Adapter framework | ✅ Done | `@lytics/dev-agent-mcp` |
| `dev_search` - Semantic code search | ✅ Done | MCP adapter |
| `dev_status` - Repository status | ✅ Done | MCP adapter |
| `dev_explore` - Code exploration | ✅ Done | MCP adapter |
| `dev_plan` - Issue planning | ✅ Done | MCP adapter |
| `dev_gh` - GitHub search | ✅ Done | MCP adapter |
| `dev_health` - Health checks | ✅ Done | MCP adapter |
| Cursor integration | ✅ Done | CLI command |
| Claude Code integration | ✅ Done | CLI command |
| Rate limiting (token bucket) | ✅ Done | MCP server |
| Retry logic (exponential backoff) | ✅ Done | MCP server |

### Phase 3: Subagent Infrastructure

| Feature | Status | Package |
|---------|--------|---------|
| Coordinator architecture | ✅ Done | `@lytics/dev-agent-subagents` |
| Context manager | ✅ Done | `@lytics/dev-agent-subagents` |
| Task queue | ✅ Done | `@lytics/dev-agent-subagents` |
| Explorer agent | ✅ Done | `@lytics/dev-agent-subagents` |
| Planner agent | ✅ Done | `@lytics/dev-agent-subagents` |
| GitHub indexer | ✅ Done | `@lytics/dev-agent-subagents` |

### Infrastructure

| Feature | Status |
|---------|--------|
| Monorepo (Turborepo + pnpm) | ✅ Done |
| Test suite (1100+ tests, Vitest) | ✅ Done |
| CI/CD (GitHub Actions) | ✅ Done |
| Linting/formatting (Biome) | ✅ Done |
| Documentation site (Nextra) | ✅ Done |

---

## Completed: Context Quality (v0.3.0) ✅

Released in v0.3.0 - dev-agent now provides *actually useful* context for LLM reasoning.

### Principle: Structured Data Over Summaries

Don't generate prose—provide structured data and let the LLM synthesize.

### Richer Search Results ✅

| Feature | Status |
|---------|--------|
| Code snippets in search results | ✅ Done |
| Import/export context | ✅ Done |
| Callers/callees hints | ✅ Done |
| Token budget management | ✅ Done |
| Progressive disclosure | ✅ Done |

### Relationship Queries (`dev_refs`) ✅

| Feature | Status |
|---------|--------|
| Callee extraction during indexing | ✅ Done |
| `dev_refs` MCP adapter | ✅ Done |
| Bidirectional queries (callers/callees) | ✅ Done |
| Token budget support | ✅ Done |

### Codebase Map (`dev_map`) ✅

| Feature | Status |
|---------|--------|
| Directory tree with component counts | ✅ Done |
| `dev_map` MCP adapter | ✅ Done |
| Configurable depth (1-5) | ✅ Done |
| Focus on specific directories | ✅ Done |
| Export signatures | ✅ Done |
| Hot paths (most referenced files) | ✅ Done |
| Smart depth (adaptive expansion) | ✅ Done |

### Refactored Planner → Context Assembler ✅

| Feature | Status |
|---------|--------|
| Removed heuristic task breakdown | ✅ Done |
| Returns `ContextPackage` with raw issue + code | ✅ Done |
| Includes codebase patterns | ✅ Done |
| Related PR/issue history | ✅ Done |

---

## Current: Polish & Stabilize (v0.3.x)

Focus on quality, documentation, and developer experience before adding new features.

### Documentation

| Task | Status | Priority |
|------|--------|----------|
| CLI reference docs | ✅ Done | 🟡 Medium |
| Configuration guide | ✅ Done | 🟡 Medium |
| Troubleshooting guide | ✅ Done | 🟡 Medium |
| Examples for new tools | ✅ Done | 🟢 Low |

### Code Quality

| Task | Status | Priority |
|------|--------|----------|
| Fix lint warnings | ✅ Done | 🔴 High |
| Context assembler tests | ✅ Done | 🟡 Medium |
| Integration tests for new tools | 🔲 Todo | 🟢 Low |

### Issue Cleanup

| Task | Status | Priority |
|------|--------|----------|
| Close completed epics | ✅ Done | 🟡 Medium |
| Update stale issues | ✅ Done | 🟢 Low |

---

## Future: Extended Intelligence (v0.4+)

### Git History Context

| Feature | Priority |
|---------|----------|
| Recent commits affecting file | 🟡 Medium |
| Git blame integration | 🟡 Medium |
| Related PRs for file/function | 🟡 Medium |
| Change frequency analysis | ✅ Done (hot paths) |

### Multi-Language Support

| Language | Status | Priority |
|----------|--------|----------|
| TypeScript/JavaScript | ✅ Done | - |
| Markdown | ✅ Done | - |
| Python | 🔲 Planned | 🟡 Medium |
| Go | 🔲 Planned | 🟢 Low |
| Rust | 🔲 Planned | 🟢 Low |

### Test Coverage Intelligence

| Feature | Priority |
|---------|----------|
| Map tests to source files | 🟢 Low |
| "What tests cover this code?" | 🟢 Low |
| Test file suggestions | 🟢 Low |

### IDE Integrations

| Integration | Status | Priority |
|-------------|--------|----------|
| Cursor (via MCP) | ✅ Done | - |
| Claude Code (via MCP) | ✅ Done | - |
| VS Code extension | 🔲 Planned | 🟢 Low |

---

## Shelved / Reconsidered

These were in the original plan but have been deprioritized or reconsidered:

| Feature | Reason |
|---------|--------|
| LLM integration | Dev-agent provides context, not reasoning. LLM is external. |
| Effort estimation | Heuristics are unreliable. Let LLMs estimate with context. |
| PR description generation | LLM's job, not ours. Provide context instead. |
| Task breakdown logic | Generic tasks aren't useful. Return raw data. |
| Express API server | MCP is the interface. No need for REST API. |

---

## Technology Stack

### Current
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js >= 22 (LTS)
- **Package Manager:** pnpm 8.15.4
- **Build:** Turborepo
- **Linting:** Biome
- **Testing:** Vitest (1350+ tests)
- **Vector Storage:** LanceDB (embedded, no server)
- **Embeddings:** @xenova/transformers (all-MiniLM-L6-v2)
- **AI Integration:** MCP (Model Context Protocol)
- **Code Analysis:** ts-morph (TypeScript Compiler API)

### Considered but Not Adopted
- ChromaDB → LanceDB (embedded is simpler)
- TensorFlow.js → @xenova/transformers (better models)
- Express → MCP (protocol is the interface)

---

## Package Structure

```
packages/
├── core/           # Scanner, indexer, vector storage, utilities
├── cli/            # Command-line interface
├── mcp-server/     # MCP server + adapters
├── subagents/      # Coordinator, explorer, planner, GitHub
├── integrations/   # Claude Code, VS Code (future)
├── logger/         # @lytics/kero logging
└── dev-agent/      # Unified CLI entry point
```

---

## Success Metrics

How we know dev-agent is working:

1. **Search quality:** Relevant results in top 3
2. **Token efficiency:** Context fits in reasonable budget (<5k tokens)
3. **Response time:** Search <100ms, index <5min for 10k files
4. **Daily use:** We actually use it ourselves (dogfooding)
5. **LLM effectiveness:** Claude/Cursor make better suggestions with dev-agent

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

**Quick start:**
```bash
pnpm install
pnpm build
pnpm test
```

---

*Last updated: November 2025*
