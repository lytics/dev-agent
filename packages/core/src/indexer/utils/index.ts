/**
 * Indexer Utilities
 *
 * Modular utilities for repository indexing organized by domain.
 *
 * @module indexer/utils
 */

// Change frequency tracking
export {
  aggregateChangeFrequency,
  type ChangeFrequencyOptions,
  calculateChangeFrequency,
  type FileChangeFrequency,
} from './change-frequency';

// Stats comparison
export {
  compareStats,
  formatDiffSummary,
  type LanguageDiff,
  type NumericDiff,
  type PackageDiff,
  type StatsDiff,
} from './comparison';
// Document preparation
export {
  filterDocumentsByExport,
  filterDocumentsByLanguage,
  filterDocumentsByType,
  prepareDocumentForEmbedding,
  prepareDocumentsForEmbedding,
} from './documents';
// Stats export
export {
  type ExportOptions,
  exportLanguageStatsAsMarkdown,
  exportPackageStatsAsMarkdown,
  exportStatsAsCsv,
  exportStatsAsJson,
} from './export';
// Text formatting
export {
  cleanDocumentText,
  formatDocumentText,
  formatDocumentTextWithSignature,
  truncateText,
} from './formatting';
// Language mapping
export {
  getExtensionForLanguage,
  getLanguageFromExtension,
  getSupportedLanguages,
  isLanguageSupported,
} from './language';
