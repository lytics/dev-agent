# Feature Template

Use this template when adding new features to ensure testability and maintainability.

## 📁 Recommended Structure

```
packages/[package]/src/[feature]/
├── index.ts              # Main feature implementation
├── types.ts              # Type definitions
├── [feature].test.ts     # Integration tests
├── utils/                # Testable utilities
│   ├── [domain1].ts      # Pure functions (foundation)
│   ├── [domain1].test.ts # Unit tests (100% coverage)
│   ├── [domain2].ts      # Pure functions (independent)
│   ├── [domain2].test.ts # Unit tests (100% coverage)
│   ├── [domain3].ts      # Dependent functions
│   ├── [domain3].test.ts # Unit tests (100% coverage)
│   └── index.ts          # Barrel export
└── README.md             # Feature documentation
```

---

## 📝 Step-by-Step Guide

### 1. Define Types First

```typescript
// types.ts
export interface MyFeatureConfig {
  option1: string;
  option2?: number;
}

export interface MyFeatureResult {
  data: string[];
  count: number;
}

export type MyFeatureAction = 'create' | 'update' | 'delete';
```

### 2. Extract Pure Utilities

Identify reusable, testable logic:

```typescript
// utils/validation.ts (foundation - no dependencies)
export function validateConfig(config: MyFeatureConfig): boolean {
  return config.option1.length > 0;
}

export function isValidAction(action: string): action is MyFeatureAction {
  return ['create', 'update', 'delete'].includes(action);
}
```

```typescript
// utils/validation.test.ts
import { describe, expect, it } from 'vitest';
import { validateConfig, isValidAction } from './validation';

describe('Validation Utilities', () => {
  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      expect(validateConfig({ option1: 'test' })).toBe(true);
    });

    it('should return false for empty option1', () => {
      expect(validateConfig({ option1: '' })).toBe(false);
    });
  });

  describe('isValidAction', () => {
    it('should return true for valid actions', () => {
      expect(isValidAction('create')).toBe(true);
      expect(isValidAction('update')).toBe(true);
      expect(isValidAction('delete')).toBe(true);
    });

    it('should return false for invalid actions', () => {
      expect(isValidAction('invalid')).toBe(false);
    });
  });
});
```

### 3. More Utilities (Dependent)

```typescript
// utils/transformation.ts (depends on validation)
import { isValidAction } from './validation';
import type { MyFeatureAction } from '../types';

export function normalizeAction(action: string): MyFeatureAction | null {
  if (!isValidAction(action)) {
    return null;
  }
  return action;
}

export function transformData(data: string[]): string {
  return data.join(', ');
}
```

### 4. Barrel Export

```typescript
// utils/index.ts
export { isValidAction, validateConfig } from './validation';
export { normalizeAction, transformData } from './transformation';
```

### 5. Main Implementation

```typescript
// index.ts
import type { MyFeatureConfig, MyFeatureResult } from './types';
import { normalizeAction, transformData, validateConfig } from './utils';

export class MyFeature {
  constructor(private config: MyFeatureConfig) {
    if (!validateConfig(config)) {
      throw new Error('Invalid configuration');
    }
  }

  async execute(action: string, data: string[]): Promise<MyFeatureResult> {
    // Guard clause using utility
    const validAction = normalizeAction(action);
    if (!validAction) {
      throw new Error(`Invalid action: ${action}`);
    }

    // Use utility for transformation
    const transformed = transformData(data);

    // Integration logic (impure, side effects)
    // ...

    return {
      data: [transformed],
      count: data.length,
    };
  }
}

// Re-export types
export type * from './types';

// Re-export utilities for consumers
export * from './utils';
```

### 6. Integration Tests

```typescript
// [feature].test.ts
import { describe, expect, it } from 'vitest';
import { MyFeature } from './index';

describe('MyFeature', () => {
  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const feature = new MyFeature({ option1: 'test' });
      expect(feature).toBeDefined();
    });

    it('should throw for invalid config', () => {
      expect(() => new MyFeature({ option1: '' })).toThrow('Invalid configuration');
    });
  });

  describe('execute', () => {
    it('should execute valid action', async () => {
      const feature = new MyFeature({ option1: 'test' });
      const result = await feature.execute('create', ['a', 'b']);

      expect(result.data).toEqual(['a, b']);
      expect(result.count).toBe(2);
    });

    it('should reject invalid action', async () => {
      const feature = new MyFeature({ option1: 'test' });
      await expect(feature.execute('invalid', [])).rejects.toThrow('Invalid action');
    });
  });
});
```

### 7. Documentation

```markdown
# My Feature

Brief description of what this feature does.

## Usage

\`\`\`typescript
import { MyFeature } from '@lytics/dev-agent-[package]/[feature]';

const feature = new MyFeature({ option1: 'value' });
const result = await feature.execute('create', ['data']);
\`\`\`

## API

### `MyFeature`

Main class for...

### Utilities

- `validateConfig()` - Validates configuration
- `isValidAction()` - Type guard for actions
- `normalizeAction()` - Normalizes action strings
- `transformData()` - Transforms data array

## Testing

\`\`\`bash
pnpm vitest run packages/[package]/src/[feature] --coverage
\`\`\`

Target: 100% coverage on utilities, >80% on integration.
```

---

## ✅ Checklist

Before submitting your feature:

### Code Organization
- [ ] Types defined in `types.ts`
- [ ] Pure functions in `utils/[domain].ts`
- [ ] Each utility module <150 lines
- [ ] Barrel export `utils/index.ts`
- [ ] Main implementation in `index.ts`

### Testing
- [ ] Unit tests for all utilities (100% coverage)
- [ ] Integration tests for main implementation (>80%)
- [ ] Edge cases covered (empty, null, errors)
- [ ] No mocks in utility tests

### Code Quality
- [ ] No `!` non-null assertions
- [ ] Guard clauses for validation
- [ ] JSDoc on public functions
- [ ] No console.log (use logger)

### Commits
- [ ] Atomic commits (each builds independently)
- [ ] Conventional commit messages
- [ ] Dependency order: foundation → dependent → integration

---

## 📚 Examples & Resources

**Real implementations:**
1. `packages/subagents/src/explorer/` - 99 tests, 100% on utilities
2. `packages/core/src/indexer/stats-merger.ts` - 17 tests, pure functions
3. `packages/cli/src/utils/date-utils.ts` - 18 tests, 100% coverage

**Documentation:**
- [TYPESCRIPT_STANDARDS.md](./TYPESCRIPT_STANDARDS.md) - Our coding manifesto
- [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) - Recent refactoring example

---

## ❓ FAQs

**Q: How do I know what to extract?**  
A: If it's >20 lines, pure (no side effects), or reusable → extract it.

**Q: Should everything be 100% coverage?**  
A: Only pure utilities. Integration can be 80%, CLI/UI can be 60%.

**Q: Can I use `!` for "impossible" cases?**  
A: No. Use guard clauses or optional chaining. It's safer and more testable.

**Q: What if my util module gets >200 lines?**  
A: Split by domain. Example: `utils/strings.ts` and `utils/arrays.ts` instead of `utils/helpers.ts`.

---

**Happy coding!** 🚀

