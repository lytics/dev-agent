# Pattern Analysis Fixtures

This directory contains realistic code examples for testing pattern detection.

## Files

### `modern-typescript.ts`
**Pattern characteristics:**
- ✅ ESM imports (`import` statements)
- ✅ Result<T> error handling
- ✅ Full type annotations
- ✅ Explicit return types
- ✅ Has test file (`modern-typescript.test.ts`)

**Use for testing:**
- Import style detection (ESM)
- Error handling detection (Result<T>)
- Type annotation coverage (full)
- Test coverage (present)

---

### `react-component.tsx`
**Pattern characteristics:**
- ✅ ESM imports
- ✅ TypeScript interfaces for props
- ✅ React hooks in proper order
- ✅ Full type annotations
- ✅ Throws exceptions (try/catch pattern)
- ❌ No test file

**Use for testing:**
- React hook detection
- Error handling (throw in async functions)
- Type annotation (full)
- Test coverage (missing)

---

### `legacy-javascript.js`
**Pattern characteristics:**
- ❌ CommonJS (`require`, `module.exports`)
- ❌ Throw-based error handling
- ❌ No type annotations
- ❌ No test file

**Use for testing:**
- Import style detection (CJS)
- Error handling (throw)
- Type annotation coverage (none)
- Older codebase patterns

---

### `mixed-patterns.ts`
**Pattern characteristics:**
- ⚠️ Mixed ESM and CJS (`import` + `require`)
- ⚠️ Mixed error handling (throw + Result<T>)
- ⚠️ Partial type annotations
- ❌ No test file

**Use for testing:**
- Inconsistency detection
- Mixed pattern analysis
- What to flag for review

---

### `go-service.go`
**Pattern characteristics:**
- ✅ Go error returns (`(T, error)`)
- ✅ Exported naming (PascalCase)
- ✅ Standard library imports
- ✅ Error wrapping with `fmt.Errorf`

**Use for testing:**
- Go-specific patterns
- Error return detection
- Multi-language support

---

## Usage in Tests

```typescript
import { PatternAnalysisService } from '../pattern-analysis-service';

const service = new PatternAnalysisService({
  repositoryPath: path.join(__dirname, '../__fixtures__')
});

// Analyze modern TypeScript file
const patterns = await service.analyzeFile('modern-typescript.ts');
expect(patterns.importStyle.style).toBe('esm');
expect(patterns.errorHandling.style).toBe('result');
expect(patterns.typeAnnotations.coverage).toBe('full');
expect(patterns.testing.hasTest).toBe(true);

// Compare against legacy code
const comparison = await service.comparePatterns(
  'modern-typescript.ts',
  ['legacy-javascript.js']
);
expect(comparison.importStyle.common).toBe('cjs');
```

## Adding New Fixtures

When adding new fixtures:
1. Use realistic code examples
2. Document pattern characteristics
3. Add test file if demonstrating test coverage
4. Update this README

