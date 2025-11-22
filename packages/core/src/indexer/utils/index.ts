/**
 * Indexer Utilities
 *
 * Modular utilities for repository indexing organized by domain.
 *
 * @module indexer/utils
 */

// Document preparation
export {
  filterDocumentsByExport,
  filterDocumentsByLanguage,
  filterDocumentsByType,
  prepareDocumentForEmbedding,
  prepareDocumentsForEmbedding,
} from './documents';

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
