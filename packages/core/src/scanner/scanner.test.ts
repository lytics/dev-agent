import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MarkdownScanner } from './markdown';
import { ScannerRegistry } from './registry';
import { TypeScriptScanner } from './typescript';

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
  const repoRoot = path.join(__dirname, '../../../../');

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
      include: ['packages/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
    });

    // Should not include test files
    const testFiles = result.documents.filter((d) => d.metadata.file.includes('.test.ts'));
    expect(testFiles.length).toBe(0);
  });

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
});
