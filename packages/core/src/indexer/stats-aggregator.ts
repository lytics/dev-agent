/**
 * Statistics aggregator for efficient incremental stats collection during indexing
 */

import type { Document, DocumentType } from '../scanner/types';
import type { LanguageStats, PackageStats, SupportedLanguage } from './types';

/**
 * Efficiently aggregates statistics during indexing with O(1) operations
 * Uses streaming aggregation to avoid post-processing overhead
 */
export class StatsAggregator {
  private languageStats = new Map<SupportedLanguage, LanguageStats>();
  private componentTypeStats = new Map<string, number>();
  private packageStats = new Map<string, PackageStats>();
  private fileToPackage = new Map<string, string>(); // Cache for package lookups
  private processedFiles = new Set<string>();

  /**
   * Add a document to the aggregation
   * O(1) operation - just increments counters
   */
  addDocument(doc: Document): void {
    const language = doc.language as SupportedLanguage;
    const file = doc.metadata.file;
    const type = doc.type;

    // Track unique files per language
    const isNewFile = !this.processedFiles.has(file);
    if (isNewFile) {
      this.processedFiles.add(file);
    }

    // Increment language stats
    this.incrementLanguage(language, doc, isNewFile);

    // Increment component type stats
    this.incrementComponentType(type);

    // Increment package stats (if in monorepo)
    this.incrementPackage(file, language, isNewFile);
  }

  /**
   * Register a package for monorepo support
   */
  registerPackage(packagePath: string, packageName: string): void {
    if (!this.packageStats.has(packagePath)) {
      this.packageStats.set(packagePath, {
        name: packageName,
        path: packagePath,
        files: 0,
        components: 0,
        languages: {},
      });
    }
  }

  /**
   * Get aggregated statistics
   */
  getDetailedStats(): {
    byLanguage: Partial<Record<SupportedLanguage, LanguageStats>>;
    byComponentType: Partial<Record<string, number>>;
    byPackage: Record<string, PackageStats>;
  } {
    return {
      byLanguage: Object.fromEntries(this.languageStats),
      byComponentType: Object.fromEntries(this.componentTypeStats),
      byPackage: Object.fromEntries(this.packageStats),
    };
  }

  /**
   * Reset all stats (useful for testing)
   */
  reset(): void {
    this.languageStats.clear();
    this.componentTypeStats.clear();
    this.packageStats.clear();
    this.fileToPackage.clear();
    this.processedFiles.clear();
  }

  /**
   * Get current counts for monitoring
   */
  getCounts(): {
    languages: number;
    componentTypes: number;
    packages: number;
    files: number;
  } {
    return {
      languages: this.languageStats.size,
      componentTypes: this.componentTypeStats.size,
      packages: this.packageStats.size,
      files: this.processedFiles.size,
    };
  }

  // Private helpers

  private incrementLanguage(language: SupportedLanguage, doc: Document, isNewFile: boolean): void {
    if (!this.languageStats.has(language)) {
      this.languageStats.set(language, {
        files: 0,
        components: 0,
        lines: 0,
      });
    }

    const stats = this.languageStats.get(language);
    if (!stats) return; // Should never happen, but guard for type safety

    if (isNewFile) {
      stats.files++;
    }
    stats.components++;

    // Approximate lines from component range
    const lines = doc.metadata.endLine - doc.metadata.startLine + 1;
    stats.lines += lines;
  }

  private incrementComponentType(type: DocumentType | string): void {
    const current = this.componentTypeStats.get(type) || 0;
    this.componentTypeStats.set(type, current + 1);
  }

  private incrementPackage(file: string, language: SupportedLanguage, isNewFile: boolean): void {
    // Find package for this file (cached lookup)
    let packagePath = this.fileToPackage.get(file);

    if (!packagePath) {
      // Find nearest parent package by checking registered packages
      packagePath = this.findPackageForFile(file);
      if (packagePath) {
        this.fileToPackage.set(file, packagePath);
      }
    }

    if (packagePath) {
      const pkg = this.packageStats.get(packagePath);
      if (pkg) {
        if (isNewFile) {
          pkg.files++;
        }
        pkg.components++;
        pkg.languages[language] = (pkg.languages[language] || 0) + 1;
      }
    }
  }

  private findPackageForFile(file: string): string | undefined {
    // Find the longest matching package path (most specific)
    let bestMatch: string | undefined;
    let bestMatchLength = 0;

    for (const packagePath of this.packageStats.keys()) {
      // Check if file is within this package
      if (file.startsWith(`${packagePath}/`) || file.startsWith(packagePath)) {
        if (packagePath.length > bestMatchLength) {
          bestMatch = packagePath;
          bestMatchLength = packagePath.length;
        }
      }
    }

    return bestMatch;
  }
}
