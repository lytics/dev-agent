---
"@lytics/dev-agent-core": minor
"@lytics/dev-agent": minor
---

feat(scanner): Extract arrow functions, function expressions, and exported constants

### New Features

**Arrow Function Extraction**
- Extract arrow functions assigned to `const`/`let` variables
- Extract function expressions assigned to variables
- Detect React hooks automatically (`use*` naming pattern)
- Detect async arrow functions

**Exported Constant Extraction**
- Extract exported `const` with object literal initializers (config objects)
- Extract exported `const` with array literal initializers (static lists)
- Extract exported `const` with call expression initializers (factories like `createContext()`)

### API Changes

**New DocumentType value:**
- Added `'variable'` to `DocumentType` union

**New metadata fields:**
- `isArrowFunction?: boolean` - true for arrow functions (vs function expressions)
- `isHook?: boolean` - true if name matches `/^use[A-Z]/` (React convention)
- `isAsync?: boolean` - true for async functions
- `isConstant?: boolean` - true for exported constants
- `constantKind?: 'object' | 'array' | 'value'` - kind of constant initializer

### Examples

Now extracts:
```typescript
export const useAuth = () => { ... }           // Hook (isHook: true)
export const fetchData = async (url) => { ... } // Async (isAsync: true)
const validateEmail = (email: string) => ...   // Utility function
export const API_CONFIG = { baseUrl: '...' }   // Object constant
export const LANGUAGES = ['ts', 'js']          // Array constant
export const AppContext = createContext({})    // Factory constant
```

### Migration

No breaking changes. The new `'variable'` DocumentType is additive. Existing queries for `'function'`, `'class'`, etc. continue to work unchanged.

