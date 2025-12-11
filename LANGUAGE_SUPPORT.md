# Adding New Language Support to Dev-Agent

This guide explains how to add support for new programming languages to dev-agent's code scanning and indexing capabilities.

## Current Language Support

- **TypeScript/JavaScript**: Full support (TypeScript Compiler API)
- **Go**: Full support (tree-sitter)
- **Other languages**: Not yet supported

## Architecture Overview

Dev-agent supports languages through two mechanisms:

1. **TypeScript Compiler API**: For TypeScript/JavaScript files
2. **Tree-sitter**: For other languages (currently Go only)

## Adding Tree-sitter Language Support

### Prerequisites

- Language grammar available in [tree-sitter-wasms](https://www.npmjs.com/package/tree-sitter-wasms)
- Understanding of the language's syntax and structure

### Step-by-Step Process

#### 1. Update Type Definitions

Edit `packages/core/src/scanner/tree-sitter.ts`:

```typescript
// Add your language to the type
export type TreeSitterLanguage = 'go' | 'python' | 'rust';
```

#### 2. Update WASM Bundling

Edit `packages/dev-agent/scripts/copy-wasm.js`:

```javascript
// Add your language to supported list
const SUPPORTED_LANGUAGES = ['go', 'python', 'rust'];
```

#### 3. Create Language Scanner

Create `packages/core/src/scanner/{language}.ts`:

```typescript
import { parseCode, type ParsedTree } from './tree-sitter';
import type { Document, Scanner } from './types';

export class PythonScanner implements Scanner {
  canHandle(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.py';
  }

  async scan(files: string[], repoRoot: string, logger?: Logger): Promise<Document[]> {
    // Implementation using tree-sitter queries
  }
}
```

#### 4. Add Tree-sitter Queries

Define language-specific tree-sitter queries for extracting:
- Functions/methods
- Classes/structs
- Interfaces/traits
- Type definitions
- Documentation

Example for Python:
```typescript
const PYTHON_QUERIES = {
  functions: `
    (function_definition
      name: (identifier) @name
      parameters: (parameters) @params
      body: (block) @body) @function
  `,
  classes: `
    (class_definition
      name: (identifier) @name
      body: (block) @body) @class
  `
};
```

#### 5. Register Scanner

Edit `packages/core/src/scanner/index.ts`:

```typescript
import { PythonScanner } from './python';

// Add to scanner registration
export const SCANNERS = [
  new TypeScriptScanner(),
  new GoScanner(),
  new PythonScanner(), // Add your scanner
];
```

#### 6. Test Language Support

```bash
# Install dependencies
pnpm install

# Build with new language support
pnpm build

# Test with sample files
dev index ./test-project --languages python
```

## Configuration Options

### Environment Variables

Control scanner behavior:
```bash
# General concurrency
export DEV_AGENT_CONCURRENCY=10

# Language-specific concurrency
export DEV_AGENT_PYTHON_CONCURRENCY=5
```

### Bundle Size Considerations

Each language adds ~200-500KB to the bundle via WASM files. Consider:
- Bundle size impact
- User demand for the language
- Maintenance overhead

## Best Practices

### Scanner Implementation

1. **Error Handling**: Follow the pattern in `GoScanner` for robust error handling
2. **Progress Logging**: Include progress updates for large codebases
3. **Documentation Extraction**: Extract docstrings/comments when available
4. **Performance**: Use efficient tree-sitter queries

### Testing

1. **Unit Tests**: Test scanner with various code samples
2. **Integration Tests**: Test full indexing pipeline
3. **Performance Tests**: Benchmark against large codebases

### Documentation Extraction

Extract meaningful documentation:
```typescript
// Good: Extract function purpose and parameters
const doc = extractDocumentation(node);

// Bad: Extract only raw syntax
const doc = node.text;
```

## Tree-sitter Resources

- [Tree-sitter website](https://tree-sitter.github.io/)
- [Available grammars](https://github.com/tree-sitter)
- [Query syntax guide](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)

## Contributing

1. Open an issue discussing the language addition
2. Implement following the steps above
3. Include tests and documentation
4. Submit a pull request

## Troubleshooting

### Common Issues

**WASM files not found**:
- Ensure `tree-sitter-wasms` contains your language
- Check `copy-wasm.js` configuration

**Parser initialization fails**:
- Verify tree-sitter grammar compatibility
- Check for syntax errors in queries

**Performance issues**:
- Profile tree-sitter queries
- Consider reducing query complexity
- Adjust concurrency settings

For help, see existing scanners in `packages/core/src/scanner/` or open an issue.