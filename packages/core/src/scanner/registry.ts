import { globby } from 'globby';
import type { Document, Scanner, ScanOptions, ScanProgress, ScanResult } from './types';

/**
 * Scanner registry manages multiple language scanners
 */
export class ScannerRegistry {
  private scanners: Map<string, Scanner> = new Map();

  /**
   * Register a scanner for a specific language
   */
  register(scanner: Scanner): void {
    this.scanners.set(scanner.language, scanner);
  }

  /**
   * Get scanner for a specific language
   */
  getScanner(language: string): Scanner | undefined {
    return this.scanners.get(language);
  }

  /**
   * Get all registered scanners
   */
  getAllScanners(): Scanner[] {
    return Array.from(this.scanners.values());
  }

  /**
   * Find appropriate scanner for a file
   */
  getScannerForFile(filePath: string): Scanner | undefined {
    for (const scanner of this.scanners.values()) {
      if (scanner.canHandle(filePath)) {
        return scanner;
      }
    }
    return undefined;
  }

  /**
   * Get all supported file extensions
   */
  getSupportedExtensions(): Set<string> {
    const extensions = new Set<string>();
    for (const scanner of this.scanners.values()) {
      const langExtensions = this.getExtensionsForLanguage(scanner.language);
      for (const ext of langExtensions) {
        extensions.add(ext);
      }
    }
    return extensions;
  }

  /**
   * Scan repository with all registered scanners
   */
  async scanRepository(options: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now();
    const errors: Array<{ file: string; error: string }> = [];
    const logger = options.logger?.child({ component: 'scanner' });
    const onProgress = options.onProgress;

    // Helper to emit progress
    const emitProgress = (progress: Partial<ScanProgress>) => {
      onProgress?.({
        phase: 'discovery',
        filesTotal: 0,
        filesScanned: 0,
        documentsExtracted: 0,
        errors: errors.length,
        ...progress,
      });
    };

    // Phase 1: Discovery
    logger?.info({ repoRoot: options.repoRoot }, 'Starting repository scan');
    emitProgress({ phase: 'discovery' });

    // Build glob patterns
    const patterns = this.buildGlobPatterns(options);

    // Find all files
    const files = await globby(patterns, {
      cwd: options.repoRoot,
      ignore: options.exclude || this.getDefaultExclusions(),
      absolute: false,
    });

    logger?.info({ totalFiles: files.length }, 'File discovery complete');

    // Group files by scanner
    const filesByScanner = new Map<Scanner, string[]>();

    for (const file of files) {
      const scanner = this.getScannerForFile(file);
      if (scanner) {
        const existing = filesByScanner.get(scanner) || [];
        existing.push(file);
        filesByScanner.set(scanner, existing);
      }
    }

    // Log per-language breakdown
    const languageBreakdown: Record<string, number> = {};
    for (const [scanner, scannerFiles] of filesByScanner) {
      languageBreakdown[scanner.language] = scannerFiles.length;
      logger?.info(
        { language: scanner.language, files: scannerFiles.length },
        `Found ${scannerFiles.length} ${scanner.language} files`
      );
    }

    // Phase 2: Scanning
    const allDocuments: Document[] = [];
    let totalFilesScanned = 0;

    for (const [scanner, scannerFiles] of filesByScanner.entries()) {
      logger?.debug(
        { language: scanner.language, fileCount: scannerFiles.length },
        `Scanning ${scanner.language}...`
      );

      emitProgress({
        phase: 'scanning',
        language: scanner.language,
        filesTotal: files.length,
        filesScanned: totalFilesScanned,
        documentsExtracted: allDocuments.length,
      });

      try {
        const documents = await scanner.scan(scannerFiles, options.repoRoot, logger);
        allDocuments.push(...documents);
        totalFilesScanned += scannerFiles.length;

        logger?.info(
          { language: scanner.language, files: scannerFiles.length, documents: documents.length },
          `${scanner.language} scan complete`
        );

        emitProgress({
          phase: 'scanning',
          language: scanner.language,
          filesTotal: files.length,
          filesScanned: totalFilesScanned,
          documentsExtracted: allDocuments.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          file: `[${scanner.language}]`,
          error: errorMessage,
        });
        logger?.error(
          { language: scanner.language, error: errorMessage },
          `${scanner.language} scan failed`
        );
      }
    }

    // Phase 3: Complete
    const duration = Date.now() - startTime;

    logger?.info(
      {
        totalFiles: files.length,
        totalDocuments: allDocuments.length,
        duration: `${duration}ms`,
        byLanguage: languageBreakdown,
        errors: errors.length,
      },
      'Repository scan complete'
    );

    emitProgress({
      phase: 'complete',
      filesTotal: files.length,
      filesScanned: totalFilesScanned,
      documentsExtracted: allDocuments.length,
    });

    return {
      documents: allDocuments,
      stats: {
        filesScanned: files.length,
        documentsExtracted: allDocuments.length,
        duration,
        errors,
      },
    };
  }

  private buildGlobPatterns(options: ScanOptions): string[] {
    // If include patterns specified, use those
    if (options.include && options.include.length > 0) {
      return options.include;
    }

    // Otherwise, build patterns from registered scanners
    const extensions = new Set<string>();

    for (const scanner of this.scanners.values()) {
      // Get common extensions for each language
      const langExtensions = this.getExtensionsForLanguage(scanner.language);
      for (const ext of langExtensions) {
        extensions.add(ext);
      }
    }

    return Array.from(extensions).map((ext) => `**/*${ext}`);
  }

  /**
   * Get default exclusion patterns based on industry best practices
   * Excludes dependencies, build artifacts, caches, IDE files, and other non-source files
   */
  private getDefaultExclusions(): string[] {
    return [
      // Dependencies
      '**/node_modules/**',
      '**/bower_components/**',
      '**/vendor/**',
      '**/third_party/**',

      // Build outputs
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/target/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.nuxt/**',

      // Go generated files
      '**/*.pb.go', // Protobuf
      '**/*.gen.go', // Code generators
      '**/*_gen.go', // Alternative generator pattern
      '**/*.pb.gw.go', // gRPC gateway
      '**/mock_*.go', // Mockgen files
      '**/mocks/**', // Mock directories
      '**/testdata/**', // Test fixtures

      // Version control
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',

      // IDE/Editor
      '**/.vscode/**',
      '**/.idea/**',
      '**/.vs/**',
      '**/.fleet/**',

      // Cache
      '**/.cache/**',
      '**/.parcel-cache/**',
      '**/.vite/**',
      '**/.eslintcache',

      // Test coverage
      '**/coverage/**',
      '**/.nyc_output/**',

      // Logs & temp
      '**/logs/**',
      '**/tmp/**',
      '**/temp/**',
      '**/*.log',
      '**/*.tmp',

      // Lock files (large, not useful for semantic search)
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
      '**/Cargo.lock',
      '**/Gemfile.lock',

      // OS files
      '**/.DS_Store',
      '**/Thumbs.db',

      // Test fixtures & snapshots
      '**/__fixtures__/**',
      '**/__snapshots__/**',
      '**/fixtures/**',

      // Analysis/Reports (common in AI agent projects)
      '**/analysis-reports/**',
      '**/.research/**',
      '**/benchmarks/**',
    ];
  }

  private getExtensionsForLanguage(language: string): string[] {
    const extensionMap: Record<string, string[]> = {
      typescript: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'], // TypeScript scanner handles JS too
      javascript: ['.js', '.jsx', '.mjs', '.cjs'],
      go: ['.go'],
      python: ['.py'],
      rust: ['.rs'],
      markdown: ['.md', '.mdx'],
    };

    return extensionMap[language] || [];
  }
}
