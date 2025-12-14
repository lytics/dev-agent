---
"@lytics/dev-agent-mcp": patch
"@lytics/dev-agent": patch
"@lytics/dev-agent-cli": patch
---

Refactor: Rename dev_explore → dev_inspect with focused actions

**BREAKING CHANGES:**

- `dev_explore` renamed to `dev_inspect`
- Actions changed from `['pattern', 'similar', 'relationships']` to `['compare', 'validate']`
- Removed `action: "pattern"` → Use `dev_search` instead
- Removed `action: "relationships"` → Use `dev_refs` instead  
- Renamed `action: "similar"` → `action: "compare"`

**What's New:**

- `dev_inspect` with `action: "compare"` finds similar code implementations
- `dev_inspect` with `action: "validate"` checks pattern consistency (placeholder for future)
- Clearer tool boundaries: search vs. inspect vs. refs
- File-focused analysis (always takes file path, not search query)

**Migration Guide:**

```typescript
// Before
dev_explore { action: "similar", query: "src/auth.ts" }
dev_explore { action: "pattern", query: "error handling" }
dev_explore { action: "relationships", query: "src/auth.ts" }

// After
dev_inspect { action: "compare", query: "src/auth.ts" }
dev_search { query: "error handling" }
dev_refs { name: "authenticateUser" }
```

**Why:**

- Eliminate tool duplication (`pattern` duplicated `dev_search`)
- Clear single responsibility (file analysis only)
- Better naming (`inspect` = deep file examination)
- Reserve `dev_explore` for future external context (standards, examples, docs)

