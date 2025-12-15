/**
 * Pattern Analysis Service
 *
 * Analyzes code patterns in files and compares them against similar files.
 * Provides facts (not judgments) for AI tools to interpret.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { scanRepository } from '../scanner';
import type { Document } from '../scanner/types';
import type {
  ErrorHandlingComparison,
  ErrorHandlingPattern,
  FilePatterns,
  FileSizeComparison,
  FileSizePattern,
  ImportStyleComparison,
  ImportStylePattern,
  PatternAnalysisConfig,
  PatternComparison,
  TestingComparison,
  TestingPattern,
  TypeAnnotationComparison,
  TypeAnnotationPattern,
} from './pattern-analysis-types';

// Re-export all types for cleaner imports
export type {
  ErrorHandlingComparison,
  ErrorHandlingPattern,
  FilePatterns,
  FileSizeComparison,
  FileSizePattern,
  ImportStyleComparison,
  ImportStylePattern,
  PatternAnalysisConfig,
  PatternComparison,
  TestingComparison,
  TestingPattern,
  TypeAnnotationComparison,
  TypeAnnotationPattern,
} from './pattern-analysis-types';

/**
 * Pattern Analysis Service
 *
 * Extracts and compares code patterns across files.
 */
export class PatternAnalysisService {
  constructor(private config: PatternAnalysisConfig) {}

  /**
   * Analyze patterns in a single file
   *
   * @param filePath - Relative path from repository root
   * @returns Pattern analysis results
   */
  async analyzeFile(filePath: string): Promise<FilePatterns> {
    // Step 1: Scan file to get structured documents
    const result = await scanRepository({
      repoRoot: this.config.repositoryPath,
      include: [filePath],
    });

    const documents = result.documents.filter((d) => d.metadata.file === filePath);

    // Step 2: Get file stats and content
    const fullPath = path.join(this.config.repositoryPath, filePath);
    const [stat, content] = await Promise.all([fs.stat(fullPath), fs.readFile(fullPath, 'utf-8')]);

    const lines = content.split('\n').length;

    // Step 3: Extract all patterns
    return {
      fileSize: {
        lines,
        bytes: stat.size,
      },
      testing: await this.analyzeTesting(filePath),
      importStyle: await this.analyzeImportsFromFile(filePath, documents),
      errorHandling: this.analyzeErrorHandling(content),
      typeAnnotations: this.analyzeTypes(documents),
    };
  }

  /**
   * Compare patterns between target file and similar files
   *
   * @param targetFile - Target file to analyze
   * @param similarFiles - Array of similar file paths
   * @returns Pattern comparison results
   */
  async comparePatterns(targetFile: string, similarFiles: string[]): Promise<PatternComparison> {
    const targetPatterns = await this.analyzeFile(targetFile);
    const similarPatterns = await Promise.all(similarFiles.map((f) => this.analyzeFile(f)));

    return {
      fileSize: this.compareFileSize(
        targetPatterns.fileSize,
        similarPatterns.map((s) => s.fileSize)
      ),
      testing: this.compareTesting(
        targetPatterns.testing,
        similarPatterns.map((s) => s.testing)
      ),
      importStyle: this.compareImportStyle(
        targetPatterns.importStyle,
        similarPatterns.map((s) => s.importStyle)
      ),
      errorHandling: this.compareErrorHandling(
        targetPatterns.errorHandling,
        similarPatterns.map((s) => s.errorHandling)
      ),
      typeAnnotations: this.compareTypeAnnotations(
        targetPatterns.typeAnnotations,
        similarPatterns.map((s) => s.typeAnnotations)
      ),
    };
  }

  // ========================================================================
  // Pattern Extractors (MVP: 5 core patterns)
  // ========================================================================

  /**
   * Analyze test coverage for a file
   *
   * Checks for co-located test files (*.test.*, *.spec.*)
   */
  private async analyzeTesting(filePath: string): Promise<TestingPattern> {
    // Skip if already a test file
    if (this.isTestFile(filePath)) {
      return { hasTest: false };
    }

    const testFile = await this.findTestFile(filePath);
    return {
      hasTest: testFile !== null,
      testPath: testFile || undefined,
    };
  }

  /**
   * Analyze import style from documents
   *
   * Always uses content analysis for reliability (scanner may not extract imports from all files).
   */
  private async analyzeImportsFromFile(
    filePath: string,
    _documents: Document[]
  ): Promise<ImportStylePattern> {
    // Always analyze raw content for maximum reliability
    // Scanner extraction can be incomplete for test files or unusual syntax
    const fullPath = path.join(this.config.repositoryPath, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    return this.analyzeImportsFromContent(content);
  }

  /**
   * Analyze imports from raw file content (fallback method)
   */
  private analyzeImportsFromContent(content: string): ImportStylePattern {
    // Count actual imports (not exports)
    const esmImports = content.match(/^import\s/gm) || [];
    const cjsImports = content.match(/require\s*\(/g) || [];

    const hasESM = esmImports.length > 0;
    const hasCJS = cjsImports.length > 0;

    if (!hasESM && !hasCJS) {
      return { style: 'unknown', importCount: 0 };
    }

    const importCount = esmImports.length + cjsImports.length;

    let style: ImportStylePattern['style'];
    if (hasESM && hasCJS) {
      style = 'mixed';
    } else if (hasESM) {
      style = 'esm';
    } else {
      style = 'cjs';
    }

    return { style, importCount };
  }

  /**
   * Analyze error handling patterns in file content
   *
   * Detects: throw, Result<T>, error returns (Go style)
   */
  private analyzeErrorHandling(content: string): ErrorHandlingPattern {
    const patterns = {
      throw: /throw\s+new\s+\w*Error/g,
      result: /Result<|{\s*ok:\s*(true|false)/g,
      errorReturn: /\)\s*:\s*\([^)]*,\s*error\)/g, // Go: (val, error)
    };

    const matches = {
      throw: [...content.matchAll(patterns.throw)],
      result: [...content.matchAll(patterns.result)],
      errorReturn: [...content.matchAll(patterns.errorReturn)],
    };

    const counts = {
      throw: matches.throw.length,
      result: matches.result.length,
      errorReturn: matches.errorReturn.length,
    };

    // Determine primary style
    const total = counts.throw + counts.result + counts.errorReturn;
    if (total === 0) {
      return { style: 'unknown', examples: [] };
    }

    const max = Math.max(counts.throw, counts.result, counts.errorReturn);
    const hasMultiple = Object.values(counts).filter((c) => c > 0).length > 1;

    let style: ErrorHandlingPattern['style'] = 'unknown';
    if (hasMultiple) {
      style = 'mixed';
    } else if (counts.throw === max) {
      style = 'throw';
    } else if (counts.result === max) {
      style = 'result';
    } else if (counts.errorReturn === max) {
      style = 'error-return';
    }

    return { style, examples: [] };
  }

  /**
   * Analyze type annotation coverage from documents
   *
   * Checks function/method signatures for explicit types.
   */
  private analyzeTypes(documents: Document[]): TypeAnnotationPattern {
    const functions = documents.filter((d) => d.type === 'function' || d.type === 'method');

    if (functions.length === 0) {
      return { coverage: 'none', annotatedCount: 0, totalCount: 0 };
    }

    // Check if signatures have explicit return types (contains ': ' after params)
    const annotated = functions.filter((d) => {
      const sig = d.metadata.signature || '';
      // Look for ': Type' pattern after closing paren or arrow
      return /(\)|=>)\s*:\s*\w+/.test(sig);
    });

    const coverage = annotated.length / functions.length;
    let coverageLevel: TypeAnnotationPattern['coverage'];
    if (coverage >= 0.9) {
      coverageLevel = 'full';
    } else if (coverage >= 0.5) {
      coverageLevel = 'partial';
    } else if (coverage > 0) {
      coverageLevel = 'minimal';
    } else {
      coverageLevel = 'none';
    }

    return {
      coverage: coverageLevel,
      annotatedCount: annotated.length,
      totalCount: functions.length,
    };
  }

  // ========================================================================
  // Pattern Comparisons
  // ========================================================================

  /**
   * Compare file size against similar files
   */
  private compareFileSize(target: FileSizePattern, similar: FileSizePattern[]): FileSizeComparison {
    if (similar.length === 0) {
      return {
        yourFile: target.lines,
        average: target.lines,
        median: target.lines,
        range: [target.lines, target.lines],
        deviation: 'similar',
      };
    }

    const sizes = similar.map((s) => s.lines).sort((a, b) => a - b);
    const average = sizes.reduce((sum, s) => sum + s, 0) / sizes.length;
    const median = sizes[Math.floor(sizes.length / 2)];
    const range: [number, number] = [sizes[0], sizes[sizes.length - 1]];

    // Determine deviation (>20% difference)
    const avgDiff = Math.abs(target.lines - average) / average;
    let deviation: FileSizeComparison['deviation'];
    if (avgDiff > 0.2) {
      deviation = target.lines > average ? 'larger' : 'smaller';
    } else {
      deviation = 'similar';
    }

    return {
      yourFile: target.lines,
      average: Math.round(average),
      median,
      range,
      deviation,
    };
  }

  /**
   * Compare testing patterns
   */
  private compareTesting(target: TestingPattern, similar: TestingPattern[]): TestingComparison {
    if (similar.length === 0) {
      return {
        yourFile: target.hasTest,
        percentage: target.hasTest ? 100 : 0,
        count: { withTest: target.hasTest ? 1 : 0, total: 1 },
      };
    }

    const withTest = similar.filter((s) => s.hasTest).length;
    const percentage = (withTest / similar.length) * 100;

    return {
      yourFile: target.hasTest,
      percentage: Math.round(percentage),
      count: { withTest, total: similar.length },
    };
  }

  /**
   * Compare import styles
   */
  private compareImportStyle(
    target: ImportStylePattern,
    similar: ImportStylePattern[]
  ): ImportStyleComparison {
    if (similar.length === 0) {
      return {
        yourFile: target.style,
        common: target.style,
        percentage: 100,
        distribution: { [target.style]: 1 },
      };
    }

    // Count distribution
    const distribution: Record<string, number> = {};
    for (const s of similar) {
      distribution[s.style] = (distribution[s.style] || 0) + 1;
    }

    // Find most common
    const common = Object.entries(distribution).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const percentage = Math.round((distribution[common] / similar.length) * 100);

    return {
      yourFile: target.style,
      common,
      percentage,
      distribution,
    };
  }

  /**
   * Compare error handling patterns
   */
  private compareErrorHandling(
    target: ErrorHandlingPattern,
    similar: ErrorHandlingPattern[]
  ): ErrorHandlingComparison {
    if (similar.length === 0) {
      return {
        yourFile: target.style,
        common: target.style,
        percentage: 100,
        distribution: { [target.style]: 1 },
      };
    }

    // Count distribution
    const distribution: Record<string, number> = {};
    for (const s of similar) {
      distribution[s.style] = (distribution[s.style] || 0) + 1;
    }

    // Find most common
    const common = Object.entries(distribution).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const percentage = Math.round((distribution[common] / similar.length) * 100);

    return {
      yourFile: target.style,
      common,
      percentage,
      distribution,
    };
  }

  /**
   * Compare type annotation patterns
   */
  private compareTypeAnnotations(
    target: TypeAnnotationPattern,
    similar: TypeAnnotationPattern[]
  ): TypeAnnotationComparison {
    if (similar.length === 0) {
      return {
        yourFile: target.coverage,
        common: target.coverage,
        percentage: 100,
        distribution: { [target.coverage]: 1 },
      };
    }

    // Count distribution
    const distribution: Record<string, number> = {};
    for (const s of similar) {
      distribution[s.coverage] = (distribution[s.coverage] || 0) + 1;
    }

    // Find most common
    const common = Object.entries(distribution).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const percentage = Math.round((distribution[common] / similar.length) * 100);

    return {
      yourFile: target.coverage,
      common,
      percentage,
      distribution,
    };
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Check if a path is a test file
   */
  private isTestFile(filePath: string): boolean {
    return filePath.includes('.test.') || filePath.includes('.spec.');
  }

  /**
   * Find test file for a source file
   *
   * Checks for common patterns: *.test.*, *.spec.*
   */
  private async findTestFile(sourcePath: string): Promise<string | null> {
    const ext = path.extname(sourcePath);
    const base = sourcePath.slice(0, -ext.length);

    const patterns = [`${base}.test${ext}`, `${base}.spec${ext}`];

    for (const testPath of patterns) {
      const fullPath = path.join(this.config.repositoryPath, testPath);
      try {
        await fs.access(fullPath);
        return testPath;
      } catch {
        // File doesn't exist, try next pattern
      }
    }

    return null;
  }
}
