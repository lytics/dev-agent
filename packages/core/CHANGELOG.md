# @lytics/dev-agent-core

## 0.5.0

### Minor Changes

- d0481b4: feat(scanner): Extract arrow functions, function expressions, and exported constants

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

## 0.4.0

### Minor Changes

- c42f5ba: feat: Intelligent Git History (v0.4.0)

  New capabilities for understanding codebase history:

  **`dev_history` tool** - Semantic search over git commits

  - Search commit messages by meaning (e.g., "authentication token fix")
  - Get file history with rename tracking
  - Token-budgeted output

  **`dev_map` enhancements** - Change frequency indicators

  - 🔥 Hot directories (5+ commits in 30 days)
  - ✏️ Active directories (1-4 commits in 30 days)
  - 📝 Recent activity (commits in 90 days)

  **`dev_plan` enhancements** - Git context in planning

  - Related commits shown alongside code snippets
  - Issue/PR references extracted from commits
  - Helps understand prior work on similar features

  **Core infrastructure:**

  - `GitIndexer` for semantic commit search
  - `LocalGitExtractor` for git operations
  - Extensible architecture for future git features

## 0.3.0

### Minor Changes

- afa8adb: feat: Context Quality release (v0.3.0)

  This release significantly enhances dev-agent's ability to provide rich, actionable context to AI assistants.

  ## New Tools

  ### `dev_refs` - Relationship Queries

  Query code relationships to understand what calls what:

  - Find all callers of a function
  - Find all callees (what a function calls)
  - Includes file paths, line numbers, and snippets

  ### `dev_map` - Codebase Overview

  Get a high-level view of repository structure:

  - Directory tree with component counts
  - **Hot Paths**: Most referenced files in the codebase
  - **Smart Depth**: Adaptive expansion based on information density
  - **Signatures**: Function/class signatures in export listings
  - Configurable depth and focus directory

  ## Enhanced Tools

  ### `dev_plan` - Context Assembler (Breaking Change)

  Completely refactored from heuristic task breakdown to context assembly:

  - Returns rich context package instead of task lists
  - Includes issue details with comments
  - Includes relevant code snippets from semantic search
  - Includes detected codebase patterns
  - Let LLMs do the reasoning with better data

  **Migration:** The old task breakdown output is removed. The new output provides strictly more information for LLMs to create their own plans.

  ### `dev_search` - Richer Results (from v0.2.0)

  - Code snippets included in results
  - Import statements for context
  - Caller/callee hints
  - Progressive disclosure based on token budget

  ## Philosophy

  This release embraces the principle: **Provide structured data, let LLMs reason.**

  Instead of trying to be smart with heuristics, dev-agent now focuses on assembling comprehensive context that AI assistants can use effectively.

## 0.2.0

### Minor Changes

- ce7390b: feat: Richer search results with code snippets, imports, and token budget management

  **Core Scanner:**

  - Extract code snippets during indexing (truncated to 50 lines)
  - Parse and store import statements using ts-morph
  - Extended DocumentMetadata with `snippet` and `imports` fields

  **MCP Formatters:**

  - CompactFormatter and VerboseFormatter now render snippets and imports
  - Progressive disclosure: full → signature → minimal detail levels
  - Token budget management (500-10000 tokens, configurable per-search)
  - Improved token estimation for code-heavy text

  **Search Adapter:**

  - New `tokenBudget` parameter for dev_search tool
  - Enables snippets and imports by default

  The `dev_search` tool now returns actionable context instead of just pointers, making it significantly more useful for AI assistants to understand code without additional file reads.
