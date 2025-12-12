# TypeScript Standards & Manifesto

> **Our philosophy:** If it's hard to test, it's hard to use. Write code that's obvious to humans and AI.

---

## The Core Rules

### 1. Extract Pure Functions First

**Classes hide complexity. Pure functions expose it.**

❌ **BAD:**
```typescript
class StatsManager {
  private mergeStats(current, incremental) { /* 100 lines */ }
}
// Can't test without instantiating class
```

✅ **GOOD:**
```typescript
// utils/stats-merger.ts
export function mergeStats(current: Stats, incremental: Stats): Stats {
  return { files: current.files + incremental.files, ... };
}
// Direct test: expect(mergeStats(a, b)).toEqual(expected)
```

**When?** If it's >20 lines, pure (no side effects), or reusable → extract it.

---

### 2. No Type Assertions Without Validation

**TypeScript types vanish at runtime. Validate external data.**

❌ **BAD (found in codebase):**
```typescript
const request = message.payload as unknown as ExplorationRequest;
// Runtime bomb waiting to happen
```

✅ **GOOD:**
```typescript
import { z } from 'zod';

const ExplorationRequestSchema = z.object({
  action: z.enum(['pattern', 'similar', 'relationships']),
  query: z.string().min(1),
});

const parsed = ExplorationRequestSchema.safeParse(data);
if (!parsed.success) {
  return { ok: false, error: parsed.error };
}
const request = parsed.data; // Type-safe!
```

**Rule:** Never use `as`, `as unknown as`, or `!` without runtime checks.

---

### 3. Result Types, Not Exceptions

**Exceptions are invisible in type signatures. Result types are explicit.**

❌ **BAD:**
```typescript
async function fetchUser(id: string): Promise<User> {
  if (!valid) throw new Error('Invalid');
  if (!found) throw new Error('Not found');
  return user;
}
// Forces try-catch, unclear what can fail
```

✅ **GOOD:**
```typescript
type Result<T, E = AppError> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchUser(id: string): Promise<Result<User>> {
  if (!valid) return { ok: false, error: { code: 'INVALID_ID' } };
  if (!found) return { ok: false, error: { code: 'NOT_FOUND' } };
  return { ok: true, value: user };
}

// Clean usage
const result = await fetchUser('123');
if (!result.ok) {
  logger.error(result.error);
  return;
}
const user = result.value; // Type-safe
```

**When to throw:** Only for programmer errors (`throw new Error('INVARIANT: ...')`)

---

### 4. Inject Dependencies

**Hard-coded dependencies = untestable code.**

❌ **BAD:**
```typescript
class PlannerAgent {
  async createPlan() {
    const github = new GitHubClient(); // Can't mock
  }
}
```

✅ **GOOD:**
```typescript
interface PlannerDeps {
  github: GitHubClient;
  indexer: RepositoryIndexer;
}

class PlannerAgent {
  constructor(private deps: PlannerDeps) {}
}

// Testing is easy
new PlannerAgent({ github: mockGitHub, indexer: mockIndexer });
```

---

## Size Limits

- **Modules:** < 300 lines → Split by domain
- **Classes:** < 400 lines → Use Strategy pattern
- **Functions:** < 50 lines → Extract helpers

**Current refactoring targets:**
- `explore-adapter.ts` (690 lines)
- `github-adapter.ts` (724 lines)
- `coordinator.ts` (480 lines)

---

## Organization

```
src/
├── utils/              # Pure functions
│   ├── validation.ts   (120 lines, 100% coverage)
│   ├── validation.test.ts
│   ├── formatting.ts   (150 lines, 100% coverage)
│   ├── formatting.test.ts
│   └── index.ts        (barrel export)
└── index.ts            (integration)
```

**Rules:**
- Organize by domain (not "misc")
- Colocate tests with source
- Barrel exports (`index.ts`)
- Each module < 300 lines

---

## Testing Requirements

| Type | Coverage | Why |
|------|----------|-----|
| **Pure utilities** | 100% | Easy to test, no excuses |
| **Integration** | 80%+ | Side effects, mocks needed |
| **CLI/UI** | 60%+ | Harder to test |

**Test factories:**
```typescript
// __tests__/factories.ts
export function createMessage(overrides?: Partial<Message>): Message {
  return { id: randomUUID(), type: 'request', ...overrides };
}

// Use in tests
const msg = createMessage({ type: 'response' });
```

---

## Error Handling

**Standard error format:**
```typescript
interface AppError {
  code: string;           // 'NOT_FOUND', 'VALIDATION_ERROR'
  message: string;        // Human-readable
  details?: unknown;      // Context
  recoverable: boolean;   // Can retry?
  suggestion?: string;    // What to do
}
```

---

## Commit Checklist

Before committing:
- [ ] No `as`, `as unknown as`, or `!`
- [ ] External data validated (Zod)
- [ ] Result types for expected failures
- [ ] Dependencies injected
- [ ] Pure functions extracted
- [ ] 100% coverage on utilities
- [ ] Modules < 300 lines, classes < 400 lines

---

## Real Example: Recent Refactoring

**Before:** 102-line `mergeIncrementalStats()` method with mutations
**After:** 6 pure functions in `stats-merger.ts` (225 lines, 17 tests, 100% coverage)

**Impact:**
- Tests run in <1ms (no setup)
- No side effects to track
- Reusable across packages
- AI can understand each function

See: `docs/REFACTORING_SUMMARY.md`

---

## Tools

```bash
# Runtime validation
pnpm add zod

# Result type
pnpm add neverthrow  # or implement your own

# Property-based testing
pnpm add -D fast-check
```

---

## Resources

- [Zod Documentation](https://zod.dev/)
- [Result Type Pattern](https://github.com/supermacro/neverthrow)
- [FEATURE_TEMPLATE.md](./FEATURE_TEMPLATE.md) - Implementation guide
- [WORKFLOW.md](../WORKFLOW.md) - Git workflow

---

**Questions?** If you're unsure whether to extract something: **extract it.**
