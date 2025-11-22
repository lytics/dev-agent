# Testability Guidelines

This document outlines our approach to writing testable, maintainable code in the dev-agent monorepo.

## Philosophy

> **"If it's hard to test, it's hard to use."**

Testability is not just about code coverage—it's about **designing modular, reusable, and understandable code**.

---

## Core Principles

### 1. **Extract Pure Functions**

❌ **BAD: Inline logic in large classes**
```typescript
class MyService {
  private formatData(data: Data): string {
    // 50 lines of formatting logic
  }
  
  private validateData(data: Data): boolean {
    // 30 lines of validation logic
  }
}
```

✅ **GOOD: Extract to testable utility modules**
```typescript
// utils/formatting.ts
export function formatData(data: Data): string {
  // 50 lines of formatting logic
}

// utils/validation.ts
export function validateData(data: Data): boolean {
  // 30 lines of validation logic
}

// service.ts
import { formatData } from './utils/formatting';
import { validateData } from './utils/validation';

class MyService {
  // Uses utilities, no private implementation
}
```

**Why?**
- ✅ Direct unit tests (no class instantiation needed)
- ✅ Reusable across modules
- ✅ Tree-shakeable for bundlers
- ✅ Easy to understand (SRP)

---

### 2. **Organize by Domain**

❌ **BAD: Monolithic utils file**
```
utils.ts (500 lines)
├── String helpers
├── Date helpers
├── Validation helpers
└── Formatting helpers
```

✅ **GOOD: Domain-specific modules**
```
utils/
├── strings.ts      (50 lines, 10 tests)
├── dates.ts        (60 lines, 12 tests)
├── validation.ts   (80 lines, 15 tests)
├── formatting.ts   (70 lines, 13 tests)
└── index.ts        (barrel export)
```

**Why?**
- ✅ Clear boundaries (SRP)
- ✅ Easy to navigate
- ✅ Isolated testing
- ✅ Parallel development

---

### 3. **100% Coverage on Utilities**

Pure utility modules should have **100% coverage** as they:
- Have no side effects
- Are easy to test
- Form the foundation for integration logic

**Coverage Targets:**
- **Utilities**: 100% statements, 100% functions, >90% branches
- **Integration**: >80% statements, >70% branches
- **CLI/UI**: >60% (harder to test, more mocks)

---

### 4. **No Non-Null Assertions**

❌ **BAD: Using ! assertions**
```typescript
function process(data: Data | undefined) {
  const result = data!.value; // Unsafe!
}
```

✅ **GOOD: Guard clauses or optional chaining**
```typescript
function process(data: Data | undefined) {
  if (!data) {
    throw new Error('Data is required');
  }
  return data.value; // Type-safe
}

// Or use optional chaining
function process(data: Data | undefined): string | undefined {
  return data?.value;
}
```

---

### 5. **Dependency Order in Commits**

When extracting utilities, commit in dependency order:

```
Commit 1: Foundation (no dependencies)
   ↓
Commit 2: Independent utilities
   ↓
Commit 3: Dependent utilities (use foundation)
   ↓
Commit 4: Integration (wire everything together)
```

**Example: Indexer Refactoring**
```bash
1. language.ts       (foundation - no deps)
2. formatting.ts     (independent - no deps)
3. documents.ts      (depends on formatting.ts)
4. Integration       (update imports, remove old code)
```

---

## Practical Checklist

Before merging code, ask:

### ✅ **Extraction Checklist**

- [ ] Are private methods >20 lines? → Extract to utils
- [ ] Is logic reusable? → Extract to utils
- [ ] Can I test this directly? → If no, extract
- [ ] Does this have side effects? → Separate pure/impure
- [ ] Is this module >300 lines? → Split by domain

### ✅ **Testing Checklist**

- [ ] 100% coverage on pure functions
- [ ] No mocks for utility tests
- [ ] Integration tests for side effects
- [ ] Edge cases covered (empty, null, boundary)
- [ ] Error paths tested

### ✅ **Organization Checklist**

- [ ] Utils organized by domain (not "misc")
- [ ] Barrel export (`index.ts`) for clean imports
- [ ] Each module <150 lines
- [ ] Each test file <400 lines
- [ ] Clear dependency relationships

---

## Real-World Example: Explorer Subagent

### **Before Refactoring:**
```typescript
// explorer/index.ts (380 lines)
class ExplorerAgent {
  private extractMetadata(result: SearchResult) { /* ... */ }
  private matchesFileType(result: SearchResult, types: string[]) { /* ... */ }
  private isDuplicate(rels: Rel[], file: string, line: number) { /* ... */ }
  // 15+ helper methods inline
}
```

**Problems:**
- ❌ Can't test helpers directly
- ❌ 57% function coverage
- ❌ Hard to reuse logic

### **After Refactoring:**
```typescript
// explorer/utils/
// ├── metadata.ts      (54 lines, 8 tests, 100% coverage)
// ├── filters.ts       (42 lines, 15 tests, 100% coverage)
// ├── relationships.ts (63 lines, 16 tests, 100% coverage)
// ├── analysis.ts      (64 lines, 27 tests, 100% coverage)
// └── index.ts         (barrel)

// explorer/index.ts (now 360 lines, cleaner)
import { extractMetadata, matchesFileType } from './utils';

class ExplorerAgent {
  // Uses utilities, no inline helpers
}
```

**Benefits:**
- ✅ 99 unit tests (vs. 33 integration only)
- ✅ 100% coverage on utilities
- ✅ 80% function coverage overall
- ✅ Logic reusable in CLI

---

## When NOT to Extract

Don't extract everything blindly. Keep logic inline when:

1. **Tightly coupled to class state** (uses multiple `this.*`)
2. **Very short** (<10 lines, simple)
3. **Used once** and not complex
4. **Side effects required** (file I/O, network, state mutation)

**Example of OK inline logic:**
```typescript
class Service {
  private isInitialized(): boolean {
    return this.state !== null; // Simple, uses this.state
  }
}
```

---

## Tooling & Automation

### **1. Pre-commit Hooks**
```bash
# Already configured in .husky/pre-commit
- Biome linting (catches unused code)
- TypeScript type checking
- Test runs (optional, for speed)
```

### **2. CI Coverage Enforcement**
```yaml
# .github/workflows/ci.yml
- name: Check Coverage
  run: |
    pnpm vitest run --coverage
    # Enforce thresholds:
    # - Utils: 100%
    # - Integration: 80%
```

### **3. Code Review Checklist**
Use this in PR descriptions:

```markdown
## Testability Checklist
- [ ] Utilities extracted where appropriate
- [ ] 100% coverage on pure functions
- [ ] No non-null assertions (!)
- [ ] Domain-specific organization
- [ ] Atomic commits with clear dependencies
```

---

## Migration Guide

### **Step 1: Identify Candidates**
```bash
# Find large files with low coverage
pnpm vitest run --coverage

# Look for:
# - Files >300 lines
# - Coverage <80%
# - Many private methods
```

### **Step 2: Extract Utilities**
```bash
# 1. Create utils/ directory
mkdir -p src/myfeature/utils

# 2. Extract by domain (foundation first)
# 3. Write tests (aim for 100%)
# 4. Update imports
# 5. Remove old code
```

### **Step 3: Commit Strategy**
```bash
# Commit 1: Foundation utilities
git commit -m "feat(feature): add [foundation] utilities"

# Commit 2: Dependent utilities
git commit -m "feat(feature): add [dependent] utilities"

# Commit 3: Integration
git commit -m "refactor(feature): integrate modular utils"
```

---

## Success Metrics

Track these over time:

| Metric | Target | Current |
|--------|--------|---------|
| **Utils Coverage** | 100% | 100% ✅ |
| **Integration Coverage** | >80% | 76% 🟡 |
| **Avg Module Size** | <200 lines | ~180 ✅ |
| **Test/Code Ratio** | >1.5 | 1.7 ✅ |

---

## References

- **Example:** `packages/subagents/src/explorer/utils/` (99 tests, 100% coverage)
- **Example:** `packages/core/src/indexer/utils/` (87 tests, 100% coverage)
- **Style Guide:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Questions?

- **"Should I extract this?"** → If you're asking, probably yes.
- **"How small is too small?"** → <10 lines inline is OK.
- **"100% coverage is too hard"** → Only for pure utilities. Integration can be 80%.
- **"This feels like over-engineering"** → Testability = usability. If it's easy to test, it's easy to use.

---

**Remember:** Future you (and your teammates) will thank you for writing testable code! 🙏

