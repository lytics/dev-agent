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

## Current: Context Quality (v0.2)

The next phase focuses on making dev-agent's context *actually useful* for LLM reasoning.

### Principle: Structured Data Over Summaries

Don't generate prose—provide structured data and let the LLM synthesize.

### Priority 1: Richer Search Results

**Problem:** Current search returns pointers, not context. LLMs need another round-trip to read files.

**Solution:** Include code snippets and relationship hints in search results.

| Task | Priority | Complexity |
|------|----------|------------|
| Add code snippets to search results | 🔴 High | Low |
| Include import/export context | 🔴 High | Medium |
| Show callers/callees hints | 🟡 Medium | Medium |
| Token budget management | 🟡 Medium | Low |

**Before:**
```
[85%] function: handleAuth (src/auth/handler.ts:45)
```

**After:**
```
[85%] function: handleAuth (src/auth/handler.ts:45-67)
  Snippet: export async function handleAuth(req: Request)...
  Imports: ./service, ../utils/jwt
  Called by: src/routes/api.ts:23
```

### Priority 2: Relationship Queries (`dev_refs`)

**Problem:** "What calls this function?" is unanswerable without reading the whole codebase.

**Solution:** New MCP tool for relationship queries.

| Task | Priority | Complexity |
|------|----------|------------|
| Build call graph during indexing | 🔴 High | High |
| `dev_refs` adapter | 🔴 High | Medium |
| Bidirectional queries (callers/callees) | 🟡 Medium | Medium |
| Cross-file import tracking | 🟡 Medium | Medium |

**Example:**
```typescript
// Input
{ symbol: "handleAuth", direction: "both" }

// Output
{
  "callers": [
    { "file": "src/routes/api.ts", "line": 23, "symbol": "authMiddleware" }
  ],
  "callees": [
    { "file": "src/auth/service.ts", "line": 12, "symbol": "validateToken" }
  ]
}
```

### Priority 3: Codebase Map (`dev_map`)

**Problem:** LLMs don't know the shape of the codebase without reading everything.

**Solution:** Structured skeleton view (inspired by Aider's repo-map).

| Task | Priority | Complexity |
|------|----------|------------|
| Generate codebase skeleton | 🟡 Medium | Medium |
| `dev_map` adapter | 🟡 Medium | Low |
| Configurable depth | 🟢 Low | Low |
| Focus on specific directories | 🟢 Low | Low |

**Example:**
```
src/auth/
  handler.ts
    ├─ handleAuth(req: Request): Promise<Response>
    ├─ validateSession(token: string): boolean
  service.ts
    ├─ class AuthService
    │   ├─ login(credentials): Promise<User>
    │   └─ logout(userId): void
```

### Priority 4: Refactor Planner → Context Assembler

**Problem:** Planner generates heuristic tasks that LLMs could do better with raw data.

**Solution:** Return structured context, not generated plans.

| Task | Priority | Complexity |
|------|----------|------------|
| Remove heuristic task breakdown | 🟡 Medium | Low |
| Return raw issue + relevant code | 🟡 Medium | Low |
| Include codebase patterns | 🟢 Low | Medium |
| Add related PR/issue history | 🟢 Low | Medium |

**Before:** Generic tasks like "Design solution", "Implement", "Test"

**After:** Raw materials for LLM to plan with:
```json
{
  "issue": { "title": "...", "body": "...", "labels": [...] },
  "relevantCode": [{ "file": "...", "snippet": "...", "similarity": 0.85 }],
  "patterns": { "middleware": "Express-style", "testing": "Vitest + __tests__/" },
  "history": [{ "pr": 38, "title": "Similar feature", "files": [...] }]
}
```

---

## Future: Extended Intelligence (v0.3+)

### Git History Context

| Feature | Priority |
|---------|----------|
| Recent commits affecting file | 🟡 Medium |
| Git blame integration | 🟡 Medium |
| Related PRs for file/function | 🟡 Medium |
| Change frequency analysis | 🟢 Low |

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
- **Testing:** Vitest (1100+ tests)
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
