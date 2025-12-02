# Repository Scanner

Multi-language repository scanner that extracts structured information from codebases for semantic search and AI analysis.

## Overview

The scanner uses a hybrid approach:
- **TypeScript/JavaScript**: Enhanced scanning with `ts-morph` (types, references, JSDoc)
- **Markdown**: Documentation extraction with `remark`
- **Extensible**: Pluggable architecture for adding more languages

## Quick Start

```typescript
import { scanRepository } from '@lytics/dev-agent-core/scanner';

// Scan a repository
const result = await scanRepository({
  repoRoot: '/path/to/repo',
  exclude: ['node_modules', 'dist', '.git'],
});

console.log(`Found ${result.documents.length} documents`);
console.log(`Scanned ${result.stats.filesScanned} files in ${result.stats.duration}ms`);
```

## API

### `scanRepository(options: ScanOptions): Promise<ScanResult>`

Convenience function that creates a default registry and scans a repository.

**Options:**
```typescript
interface ScanOptions {
  repoRoot: string;          // Path to repository root
  exclude?: string[];        // Glob patterns to exclude (default: ['node_modules', 'dist', '.git'])
  include?: string[];        // Glob patterns to include (default: all supported files)
  languages?: string[];      // Limit to specific languages
}
```

**Returns:**
```typescript
interface ScanResult {
  documents: Document[];     // Extracted documents
  stats: ScanStats;         // Scanning statistics
}
```

### `Document`

Represents a single extracted code element or documentation section:

```typescript
interface Document {
  id: string;                // Unique identifier: "file:name:line"
  text: string;              // Text to embed (for vector search)
  type: DocumentType;        // 'function' | 'class' | 'interface' | 'type' | 'method' | 'documentation' | 'variable'
  language: string;          // 'typescript' | 'javascript' | 'markdown'
  
  metadata: {
    file: string;            // Relative path from repo root
    startLine: number;       // 1-based line number
    endLine: number;
    name?: string;           // Symbol name (function/class name)
    signature?: string;      // Full signature
    exported: boolean;       // Is it a public API?
    docstring?: string;      // Documentation comment
    
    // Variable/function metadata (for type: 'variable')
    isArrowFunction?: boolean;  // True for arrow functions
    isHook?: boolean;           // True for React hooks (use* pattern)
    isAsync?: boolean;          // True for async functions
    isConstant?: boolean;       // True for exported constants
    constantKind?: 'object' | 'array' | 'value';  // Kind of constant
  };
}
```

## Examples

### Example 1: Scanning TypeScript Files

**Input:** `src/utils/math.ts`
```typescript
/**
 * Calculates the sum of two numbers
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * User class representing a system user
 */
export class User {
  constructor(public name: string, public email: string) {}
  
  /**
   * Validates the email address
   */
  validateEmail(): boolean {
    return this.email.includes('@');
  }
}
```

**Output:**
```json
[
  {
    "id": "src/utils/math.ts:add:4",
    "text": "function add\nexport function add(a: number, b: number): number\nCalculates the sum of two numbers",
    "type": "function",
    "language": "typescript",
    "metadata": {
      "file": "src/utils/math.ts",
      "startLine": 4,
      "endLine": 6,
      "name": "add",
      "signature": "export function add(a: number, b: number): number",
      "exported": true,
      "docstring": "Calculates the sum of two numbers"
    }
  },
  {
    "id": "src/utils/math.ts:User:11",
    "text": "class User\nclass User\nUser class representing a system user",
    "type": "class",
    "language": "typescript",
    "metadata": {
      "file": "src/utils/math.ts",
      "startLine": 11,
      "endLine": 19,
      "name": "User",
      "signature": "class User",
      "exported": true,
      "docstring": "User class representing a system user"
    }
  },
  {
    "id": "src/utils/math.ts:User.validateEmail:16",
    "text": "method User.validateEmail\nvalidateEmail(): boolean\nValidates the email address",
    "type": "method",
    "language": "typescript",
    "metadata": {
      "file": "src/utils/math.ts",
      "startLine": 16,
      "endLine": 18,
      "name": "User.validateEmail",
      "signature": "validateEmail(): boolean",
      "exported": true,
      "docstring": "Validates the email address"
    }
  }
]
```

### Example 2: Scanning Markdown Files

**Input:** `README.md`
```markdown
# Getting Started

This guide will help you get started with the project.

## Installation

Install dependencies using npm:

\`\`\`bash
npm install
\`\`\`

## Usage

Import and use the library:

\`\`\`typescript
import { MyClass } from './lib';
\`\`\`
```

**Output:**
```json
[
  {
    "id": "README.md:getting-started:1",
    "text": "Getting Started\n\nThis guide will help you get started with the project.",
    "type": "documentation",
    "language": "markdown",
    "metadata": {
      "file": "README.md",
      "startLine": 1,
      "endLine": 3,
      "name": "Getting Started",
      "exported": true,
      "docstring": "This guide will help you get started with the project."
    }
  },
  {
    "id": "README.md:installation:5",
    "text": "Installation\n\nInstall dependencies using npm:\n\n```bash\nnpm install\n```",
    "type": "documentation",
    "language": "markdown",
    "metadata": {
      "file": "README.md",
      "startLine": 5,
      "endLine": 11,
      "name": "Installation",
      "exported": true,
      "docstring": "Install dependencies using npm:\n\n```bash\nnpm install\n```"
    }
  },
  {
    "id": "README.md:usage:13",
    "text": "Usage\n\nImport and use the library:\n\n```typescript\nimport { MyClass } from './lib';\n```",
    "type": "documentation",
    "language": "markdown",
    "metadata": {
      "file": "README.md",
      "startLine": 13,
      "endLine": 19,
      "name": "Usage",
      "exported": true,
      "docstring": "Import and use the library:\n\n```typescript\nimport { MyClass } from './lib';\n```"
    }
  }
]
```

### Example 3: Full Repository Scan

```typescript
import { scanRepository } from '@lytics/dev-agent-core/scanner';

const result = await scanRepository({
  repoRoot: '/path/to/my-project',
  exclude: ['node_modules', 'dist', 'build', '.git', '**/*.test.ts'],
});

console.log('Scan Results:');
console.log('-------------');
console.log(`Files scanned: ${result.stats.filesScanned}`);
console.log(`Documents extracted: ${result.stats.documentsExtracted}`);
console.log(`Duration: ${result.stats.duration}ms`);
console.log(`Errors: ${result.stats.errors.length}`);

// Group documents by type
const byType = result.documents.reduce((acc, doc) => {
  acc[doc.type] = (acc[doc.type] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log('\nDocument Types:');
for (const [type, count] of Object.entries(byType)) {
  console.log(`  ${type}: ${count}`);
}

// Find all exported functions
const exportedFunctions = result.documents.filter(
  d => d.type === 'function' && d.metadata.exported
);

console.log(`\nFound ${exportedFunctions.length} exported functions`);
```

**Output:**
```
Scan Results:
-------------
Files scanned: 45
Documents extracted: 123
Duration: 1250ms
Errors: 0

Document Types:
  function: 32
  class: 15
  interface: 28
  type: 12
  method: 24
  documentation: 12

Found 28 exported functions
```

## Advanced Usage

### Custom Scanner Registry

```typescript
import { ScannerRegistry, TypeScriptScanner, MarkdownScanner } from '@lytics/dev-agent-core/scanner';

// Create custom registry
const registry = new ScannerRegistry();

// Register only TypeScript scanner
registry.register(new TypeScriptScanner());

// Scan with custom registry
const result = await registry.scanRepository({
  repoRoot: '/path/to/repo',
  include: ['src/**/*.ts'],
});
```

### Scanner Capabilities

Check what each scanner can extract:

```typescript
import { createDefaultRegistry } from '@lytics/dev-agent-core/scanner';

const registry = createDefaultRegistry();
const scanners = registry.getAllScanners();

for (const scanner of scanners) {
  console.log(`${scanner.language}:`);
  console.log(`  - Syntax: ${scanner.capabilities.syntax}`);
  console.log(`  - Types: ${scanner.capabilities.types || false}`);
  console.log(`  - References: ${scanner.capabilities.references || false}`);
  console.log(`  - Documentation: ${scanner.capabilities.documentation || false}`);
}
```

**Output:**
```
typescript:
  - Syntax: true
  - Types: true
  - References: true
  - Documentation: true
markdown:
  - Syntax: true
  - Types: false
  - References: false
  - Documentation: true
```

### Filtering Results

```typescript
const result = await scanRepository({
  repoRoot: '/path/to/repo',
});

// Get only exported classes
const publicClasses = result.documents.filter(
  d => d.type === 'class' && d.metadata.exported
);

// Get all documentation
const docs = result.documents.filter(
  d => d.type === 'documentation'
);

// Get functions with specific name pattern
const authFunctions = result.documents.filter(
  d => d.type === 'function' && d.metadata.name?.includes('auth')
);

// Get all items from a specific file
const utilDocs = result.documents.filter(
  d => d.metadata.file.startsWith('src/utils/')
);
```

## Supported Languages

| Language | Scanner | Extracts | Status |
|----------|---------|----------|--------|
| TypeScript | `TypeScriptScanner` | Functions, classes, methods, interfaces, types, arrow functions, exported constants, JSDoc | ✅ Implemented |
| JavaScript | `TypeScriptScanner` | Functions, classes, methods, arrow functions, exported constants, JSDoc | ✅ Implemented (via .ts scanner) |
| Markdown | `MarkdownScanner` | Documentation sections, code blocks | ✅ Implemented |
| Go | - | Functions, structs, interfaces | 🔄 Planned (tree-sitter) |
| Python | - | Functions, classes, docstrings | 🔄 Planned (tree-sitter) |
| Rust | - | Functions, structs, traits | 🔄 Planned (tree-sitter) |

## Performance

**Typical performance** (measured on dev-agent codebase):
- ~40-50 files/second for TypeScript
- ~100-150 files/second for Markdown
- Memory usage: ~50-100MB for typical projects

**Optimization tips:**
- Use `exclude` patterns aggressively (node_modules, dist, etc.)
- Limit `include` patterns to relevant directories
- For very large repos, scan incrementally (track file hashes)

## Error Handling

```typescript
const result = await scanRepository({
  repoRoot: '/path/to/repo',
});

if (result.stats.errors.length > 0) {
  console.error('Scanning errors:');
  for (const error of result.stats.errors) {
    console.error(`  ${error.file}: ${error.error}`);
    if (error.line) {
      console.error(`    at line ${error.line}`);
    }
  }
}
```

Errors are non-fatal - the scanner will continue and return partial results.

## Testing

Run the scanner tests:

```bash
pnpm test packages/core/src/scanner
```

Test on a custom repository:

```typescript
// test-scanner.ts
import { scanRepository } from '@lytics/dev-agent-core/scanner';

async function test() {
  const result = await scanRepository({
    repoRoot: process.cwd(),
    exclude: ['node_modules', 'dist'],
  });
  
  console.log(JSON.stringify(result, null, 2));
}

test();
```

## Architecture

### Scanner Interface

All scanners implement the `Scanner` interface:

```typescript
interface Scanner {
  readonly language: string;
  readonly capabilities: ScannerCapabilities;
  
  scan(files: string[], repoRoot: string): Promise<Document[]>;
  canHandle(filePath: string): boolean;
}
```

### Adding a New Scanner

```typescript
import type { Scanner, Document, ScannerCapabilities } from './types';

class GoScanner implements Scanner {
  readonly language = 'go';
  readonly capabilities: ScannerCapabilities = {
    syntax: true,
    types: true,
  };
  
  canHandle(filePath: string): boolean {
    return filePath.endsWith('.go');
  }
  
  async scan(files: string[], repoRoot: string): Promise<Document[]> {
    // Implementation using tree-sitter or go/parser
    const documents: Document[] = [];
    
    for (const file of files) {
      // Parse file and extract documents
    }
    
    return documents;
  }
}

// Register
const registry = new ScannerRegistry();
registry.register(new GoScanner());
```

## Roadmap

- [x] TypeScript scanner with ts-morph
- [x] Markdown scanner with remark
- [x] Scanner registry and auto-detection
- [ ] Tree-sitter integration for Go, Python, Rust
- [ ] Enhanced JavaScript support (JSX, Flow)
- [ ] Configuration file support
- [ ] Incremental scanning (hash-based)
- [ ] Progress callbacks for large repos
- [ ] Parallel scanning

## Contributing

When adding new scanners:
1. Implement the `Scanner` interface
2. Add comprehensive tests
3. Update this README with examples
4. Register in `createDefaultRegistry()`

## License

MIT

