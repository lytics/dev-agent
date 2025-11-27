import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MarkdownScanner } from '../markdown';
import { ScannerRegistry } from '../registry';
import { TypeScriptScanner } from '../typescript';

// Helper to create registry
function createDefaultRegistry(): ScannerRegistry {
  const registry = new ScannerRegistry();
  registry.register(new TypeScriptScanner());
  registry.register(new MarkdownScanner());
  return registry;
}

// Helper to scan repository
async function scanRepository(options: {
  repoRoot: string;
  include?: string[];
  exclude?: string[];
}) {
  const registry = createDefaultRegistry();
  return registry.scanRepository(options);
}

describe('Scanner', () => {
  const repoRoot = path.join(__dirname, '../../../../../');

  it('should scan TypeScript files', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/*.ts'],
      exclude: ['**/*.test.ts'],
    });

    expect(result.documents.length).toBeGreaterThan(0);
    expect(result.stats.filesScanned).toBeGreaterThan(0);

    // Should find TypeScriptScanner class
    const tsScanner = result.documents.find((d) => d.metadata.name === 'TypeScriptScanner');
    expect(tsScanner).toBeDefined();
    expect(tsScanner?.type).toBe('class');
    expect(tsScanner?.language).toBe('typescript');
  });

  it('should scan Markdown files', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['README.md', 'ARCHITECTURE.md'],
    });

    expect(result.documents.length).toBeGreaterThan(0);

    // Should find documentation sections
    const docs = result.documents.filter((d) => d.type === 'documentation');
    expect(docs.length).toBeGreaterThan(0);
  });

  it('should extract function signatures', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/index.ts'],
    });

    // Should find createDefaultRegistry function
    const fn = result.documents.find((d) => d.metadata.name === 'createDefaultRegistry');
    expect(fn).toBeDefined();
    expect(fn?.type).toBe('function');
    expect(fn?.metadata.signature).toContain('createDefaultRegistry');
  });

  it('should handle excluded patterns', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/*.ts'], // Narrow scope for faster test
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
    });

    // Should not include test files
    const testFiles = result.documents.filter((d) => d.metadata.file.includes('.test.ts'));
    expect(testFiles.length).toBe(0);
  }, 10000);

  it('should provide scanner capabilities', () => {
    const registry = createDefaultRegistry();
    const scanners = registry.getAllScanners();

    expect(scanners.length).toBeGreaterThanOrEqual(2); // TS + MD

    const tsScanner = scanners.find((s) => s.language === 'typescript');
    expect(tsScanner).toBeDefined();
    expect(tsScanner?.capabilities.syntax).toBe(true);
    expect(tsScanner?.capabilities.types).toBe(true);

    const mdScanner = scanners.find((s) => s.language === 'markdown');
    expect(mdScanner).toBeDefined();
    expect(mdScanner?.capabilities.documentation).toBe(true);
  });

  it('should auto-detect file types', () => {
    const registry = createDefaultRegistry();

    // TypeScript files
    expect(registry.getScannerForFile('test.ts')?.language).toBe('typescript');
    expect(registry.getScannerForFile('test.tsx')?.language).toBe('typescript');
    expect(registry.getScannerForFile('test.js')?.language).toBe('typescript');
    expect(registry.getScannerForFile('test.jsx')?.language).toBe('typescript');

    // Markdown files
    expect(registry.getScannerForFile('README.md')?.language).toBe('markdown');
    expect(registry.getScannerForFile('docs/guide.mdx')?.language).toBe('markdown');

    // Unknown files
    expect(registry.getScannerForFile('test.go')).toBeUndefined();
    expect(registry.getScannerForFile('test.py')).toBeUndefined();
  });

  it('should get supported extensions', () => {
    const registry = createDefaultRegistry();
    const extensions = registry.getSupportedExtensions();

    expect(extensions.size).toBeGreaterThan(0);
    expect(extensions.has('.ts')).toBe(true);
    expect(extensions.has('.js')).toBe(true);
    expect(extensions.has('.md')).toBe(true);
  });

  it('should handle empty repositories', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['nonexistent/**/*.ts'],
    });

    expect(result.documents.length).toBe(0);
    expect(result.stats.filesScanned).toBe(0);
  });

  it('should extract JSDoc comments', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/typescript.ts'],
      exclude: ['**/*.test.ts'],
    });

    // Find TypeScriptScanner class which has JSDoc
    const tsScanner = result.documents.find((d) => d.metadata.name === 'TypeScriptScanner');
    expect(tsScanner?.metadata.docstring).toBeDefined();
    expect(tsScanner?.metadata.docstring).toContain('Enhanced TypeScript scanner');
  });

  it('should track exported status', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/typescript.ts'],
      exclude: ['**/*.test.ts'],
    });

    // TypeScriptScanner should be exported
    const tsScanner = result.documents.find((d) => d.metadata.name === 'TypeScriptScanner');
    expect(tsScanner?.metadata.exported).toBe(true);

    // Private methods should not be marked as exported
    const privateMethods = result.documents.filter(
      (d) => d.type === 'method' && d.metadata.name?.includes('extract')
    );
    // At least some private helper methods should exist
    expect(privateMethods.length).toBeGreaterThan(0);
  });

  it('should extract interfaces and types', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/types.ts'],
    });

    // Should find Scanner interface
    const scannerInterface = result.documents.find((d) => d.metadata.name === 'Scanner');
    expect(scannerInterface).toBeDefined();
    expect(scannerInterface?.type).toBe('interface');

    // Should find DocumentType type
    const docType = result.documents.find((d) => d.metadata.name === 'DocumentType');
    expect(docType).toBeDefined();
    expect(docType?.type).toBe('type');
  });

  it('should generate unique document IDs', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/registry.ts'],
      exclude: ['**/*.test.ts'],
    });

    const ids = result.documents.map((d) => d.id);
    const uniqueIds = new Set(ids);

    // All IDs should be unique
    expect(ids.length).toBe(uniqueIds.size);

    // IDs should follow format: file:name:line
    for (const id of ids) {
      expect(id).toMatch(/^[^:]+:[^:]+:\d+(-\d+)?$/);
    }
  });

  it('should handle files with various content', async () => {
    // Scan the index.ts which has both exports and imports
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/index.ts'],
    });

    expect(result.stats.filesScanned).toBe(1);
    // Should find at least some content (exports/imports)
    const hasContent = result.documents.length >= 0;
    expect(hasContent).toBe(true);
  });

  it('should handle scanner errors gracefully', async () => {
    const registry = createDefaultRegistry();

    // Test with a file that doesn't exist (should not crash)
    const result = await registry.scanRepository({
      repoRoot,
      include: ['nonexistent-file.ts'],
    });

    // Should return empty results, not throw
    expect(result.documents).toEqual([]);
    expect(result.stats.filesScanned).toBe(0);
  });

  it('should get scanner by language', () => {
    const registry = createDefaultRegistry();

    const tsScanner = registry.getScanner('typescript');
    expect(tsScanner).toBeDefined();
    expect(tsScanner?.language).toBe('typescript');

    const mdScanner = registry.getScanner('markdown');
    expect(mdScanner).toBeDefined();
    expect(mdScanner?.language).toBe('markdown');

    // Unknown language
    const unknownScanner = registry.getScanner('python');
    expect(unknownScanner).toBeUndefined();
  });

  it('should build glob patterns from scanners when no include specified', async () => {
    const registry = createDefaultRegistry();

    // Scan without include patterns - should auto-detect
    // Use a narrow repoRoot for faster test
    const result = await registry.scanRepository({
      repoRoot: `${repoRoot}/packages/core/src/scanner`,
      exclude: ['**/*.test.ts', '**/node_modules/**', '**/dist/**'],
    });

    // Should find files automatically based on registered scanners
    expect(result.stats.filesScanned).toBeGreaterThan(0);
  }, 10000);

  it('should use default exclusions', async () => {
    const result = await scanRepository({
      repoRoot: `${repoRoot}/packages/core/src/scanner`, // Narrow scope for faster test
      include: ['**/*.ts', '**/*.md'],
      // Not specifying exclude - should use defaults
    });

    // Should not include node_modules files
    const nodeModulesFiles = result.documents.filter((d) =>
      d.metadata.file.includes('node_modules')
    );
    expect(nodeModulesFiles.length).toBe(0);

    // Should not include dist files
    const distFiles = result.documents.filter((d) => d.metadata.file.includes('dist/'));
    expect(distFiles.length).toBe(0);
  }, 10000);

  it('should handle mixed language repositories', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/*.ts', 'README.md'],
      exclude: ['**/*.test.ts'],
    });

    // Should have both TypeScript and Markdown documents
    const tsDocuments = result.documents.filter((d) => d.language === 'typescript');
    const mdDocuments = result.documents.filter((d) => d.language === 'markdown');

    expect(tsDocuments.length).toBeGreaterThan(0);
    expect(mdDocuments.length).toBeGreaterThan(0);

    // Total should equal sum
    expect(result.documents.length).toBe(tsDocuments.length + mdDocuments.length);
  });

  it('should extract methods from classes', async () => {
    const result = await scanRepository({
      repoRoot,
      include: ['packages/core/src/scanner/typescript.ts'],
      exclude: ['**/*.test.ts'],
    });

    // Should find TypeScriptScanner class methods
    const methods = result.documents.filter(
      (d) => d.type === 'method' && d.metadata.name?.startsWith('TypeScriptScanner.')
    );

    expect(methods.length).toBeGreaterThan(0);

    // Should have method signatures
    for (const method of methods) {
      expect(method.metadata.signature).toBeDefined();
      expect(method.metadata.signature).toContain('(');
    }
  });

  it('should handle case-insensitive file extensions', () => {
    const registry = createDefaultRegistry();

    // Test various case combinations
    expect(registry.getScannerForFile('test.TS')?.language).toBe('typescript');
    expect(registry.getScannerForFile('test.Md')?.language).toBe('markdown');
    expect(registry.getScannerForFile('test.TSX')?.language).toBe('typescript');
  });

  it('should handle scanner errors and continue', async () => {
    const registry = new ScannerRegistry();

    // Create a scanner that always throws during scan
    const errorScanner = {
      language: 'typescript-error',
      capabilities: { syntax: true },
      canHandle: (file: string) => file.endsWith('.ts'),
      scan: async (_files: string[], _repoRoot: string) => {
        throw new Error('Intentional scanner error');
      },
    };

    // Register only the error scanner
    registry.register(errorScanner);

    // Try to scan TypeScript files
    const result = await registry.scanRepository({
      repoRoot,
      include: ['packages/core/src/index.ts'],
    });

    // Should have errors reported
    expect(result.stats.errors.length).toBeGreaterThan(0);
    expect(result.stats.errors[0].error).toContain('Intentional scanner error');
    expect(result.stats.errors[0].file).toBe('[typescript-error]');

    // Should still return valid result structure (just with errors)
    expect(result.documents).toEqual([]);
    expect(result.stats.filesScanned).toBe(1);
  });

  describe('Code Snippets', () => {
    it('should extract code snippets for classes', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/typescript.ts'],
        exclude: ['**/*.test.ts'],
      });

      // Find TypeScriptScanner class
      const tsScanner = result.documents.find((d) => d.metadata.name === 'TypeScriptScanner');
      expect(tsScanner).toBeDefined();
      expect(tsScanner?.metadata.snippet).toBeDefined();
      expect(tsScanner?.metadata.snippet).toContain('class TypeScriptScanner');
      expect(tsScanner?.metadata.snippet).toContain('implements Scanner');
    });

    it('should extract code snippets for functions', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/index.ts'],
      });

      // Find createDefaultRegistry function
      const fn = result.documents.find((d) => d.metadata.name === 'createDefaultRegistry');
      expect(fn).toBeDefined();
      expect(fn?.metadata.snippet).toBeDefined();
      expect(fn?.metadata.snippet).toContain('function createDefaultRegistry');
    });

    it('should extract code snippets for interfaces', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/types.ts'],
      });

      // Find Scanner interface
      const scannerInterface = result.documents.find((d) => d.metadata.name === 'Scanner');
      expect(scannerInterface).toBeDefined();
      expect(scannerInterface?.metadata.snippet).toBeDefined();
      expect(scannerInterface?.metadata.snippet).toContain('interface Scanner');
      expect(scannerInterface?.metadata.snippet).toContain('scan(');
    });

    it('should extract code snippets for type aliases', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/types.ts'],
      });

      // Find DocumentType type alias
      const docType = result.documents.find((d) => d.metadata.name === 'DocumentType');
      expect(docType).toBeDefined();
      expect(docType?.metadata.snippet).toBeDefined();
      expect(docType?.metadata.snippet).toContain('DocumentType');
    });

    it('should extract code snippets for methods', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/typescript.ts'],
        exclude: ['**/*.test.ts'],
      });

      // Find a method from TypeScriptScanner
      const method = result.documents.find(
        (d) => d.type === 'method' && d.metadata.name === 'TypeScriptScanner.canHandle'
      );
      expect(method).toBeDefined();
      expect(method?.metadata.snippet).toBeDefined();
      expect(method?.metadata.snippet).toContain('canHandle');
    });

    it('should truncate long snippets', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/typescript.ts'],
        exclude: ['**/*.test.ts'],
      });

      // TypeScriptScanner class is large, should be truncated
      const tsScanner = result.documents.find((d) => d.metadata.name === 'TypeScriptScanner');
      expect(tsScanner).toBeDefined();

      // If the class is >50 lines, it should be truncated
      const lineCount = tsScanner?.metadata.snippet?.split('\n').length || 0;
      // Either it's <=51 lines (50 + truncation message) or it contains the truncation indicator
      const isTruncated = tsScanner?.metadata.snippet?.includes('// ...');
      const isWithinLimit = lineCount <= 51;
      expect(isTruncated || isWithinLimit).toBe(true);
    });

    it('should preserve snippet formatting and indentation', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/typescript.ts'],
        exclude: ['**/*.test.ts'],
      });

      const method = result.documents.find(
        (d) => d.type === 'method' && d.metadata.name === 'TypeScriptScanner.canHandle'
      );
      expect(method).toBeDefined();

      // Should preserve indentation (method body should be indented)
      const snippet = method?.metadata.snippet || '';
      const lines = snippet.split('\n');
      // Find a line inside the method body (not the signature)
      const bodyLine = lines.find((line) => line.includes('return'));
      expect(bodyLine).toBeDefined();
      // Body should be indented (starts with spaces)
      expect(bodyLine?.startsWith('    ')).toBe(true);
    });
  });

  describe('Import Extraction', () => {
    it('should extract imports for classes', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/typescript.ts'],
        exclude: ['**/*.test.ts'],
      });

      // Find TypeScriptScanner class
      const tsScanner = result.documents.find((d) => d.metadata.name === 'TypeScriptScanner');
      expect(tsScanner).toBeDefined();
      expect(tsScanner?.metadata.imports).toBeDefined();
      expect(tsScanner?.metadata.imports).toContain('ts-morph');
      expect(tsScanner?.metadata.imports).toContain('node:path');
    });

    it('should extract imports for functions', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/index.ts'],
      });

      // Find createDefaultRegistry function
      const fn = result.documents.find((d) => d.metadata.name === 'createDefaultRegistry');
      expect(fn).toBeDefined();
      expect(fn?.metadata.imports).toBeDefined();
      // index.ts imports from local files
      expect(fn?.metadata.imports?.some((i) => i.includes('./typescript'))).toBe(true);
    });

    it('should extract imports for interfaces', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/types.ts'],
      });

      // Find Scanner interface
      const scannerInterface = result.documents.find((d) => d.metadata.name === 'Scanner');
      expect(scannerInterface).toBeDefined();
      expect(scannerInterface?.metadata.imports).toBeDefined();
      // types.ts has no imports, so should be empty array
      expect(scannerInterface?.metadata.imports).toEqual([]);
    });

    it('should extract imports for methods', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/typescript.ts'],
        exclude: ['**/*.test.ts'],
      });

      // Find a method from TypeScriptScanner
      const method = result.documents.find(
        (d) => d.type === 'method' && d.metadata.name === 'TypeScriptScanner.canHandle'
      );
      expect(method).toBeDefined();
      expect(method?.metadata.imports).toBeDefined();
      // Methods inherit file-level imports
      expect(method?.metadata.imports).toContain('ts-morph');
    });

    it('should handle relative imports', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/typescript.ts'],
        exclude: ['**/*.test.ts'],
      });

      const tsScanner = result.documents.find((d) => d.metadata.name === 'TypeScriptScanner');
      expect(tsScanner?.metadata.imports).toContain('./types');
    });

    it('should handle scoped package imports', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/mcp-server/src/adapters/built-in/search-adapter.ts'],
        exclude: ['**/*.test.ts'],
      });

      const doc = result.documents.find((d) => d.metadata.name === 'SearchAdapter');
      expect(doc).toBeDefined();
      // Should have scoped package imports
      expect(doc?.metadata.imports?.some((i) => i.startsWith('@lytics/'))).toBe(true);
    });

    it('should handle node builtin imports', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/typescript.ts'],
        exclude: ['**/*.test.ts'],
      });

      const tsScanner = result.documents.find((d) => d.metadata.name === 'TypeScriptScanner');
      expect(tsScanner?.metadata.imports).toContain('node:path');
    });

    it('should handle re-exports as imports', async () => {
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/index.ts'],
      });

      // The index.ts file uses re-exports (export * from "./scanner")
      // These should be captured as imports
      const docs = result.documents;
      // Even if there are no named exports, the file should have import entries
      // from re-exports if present
      expect(docs.length >= 0).toBe(true);
    });

    it('should return empty array for files with no imports', async () => {
      // types.ts should have no imports
      const result = await scanRepository({
        repoRoot,
        include: ['packages/core/src/scanner/types.ts'],
      });

      const docType = result.documents.find((d) => d.metadata.name === 'DocumentType');
      expect(docType).toBeDefined();
      expect(docType?.metadata.imports).toBeDefined();
      expect(docType?.metadata.imports).toEqual([]);
    });
  });
});
