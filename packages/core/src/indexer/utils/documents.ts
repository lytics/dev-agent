/**
 * Document Preparation Utilities
 * Functions for transforming documents for embedding generation
 */

import type { Document } from '../../scanner/types';
import type { EmbeddingDocument } from '../../vector/types';
import { formatDocumentText } from './formatting';

/**
 * Prepare documents for embedding generation
 *
 * Transforms Document objects from the scanner into EmbeddingDocument
 * objects suitable for vector storage. Applies text formatting and
 * metadata transformation.
 *
 * @param documents - Array of documents from repository scanner
 * @returns Array of documents ready for embedding generation
 *
 * @example
 * ```typescript
 * const scanned = await scanRepository({ repoRoot: '/src' });
 * const prepared = prepareDocumentsForEmbedding(scanned.documents);
 *
 * // Now ready for: await vectorStore.addDocuments(prepared)
 * ```
 */
export function prepareDocumentsForEmbedding(documents: Document[]): EmbeddingDocument[] {
  return documents.map((doc) => ({
    id: doc.id,
    text: formatDocumentText(doc),
    metadata: {
      path: doc.metadata.file,
      type: doc.type,
      language: doc.language,
      name: doc.metadata.name,
      startLine: doc.metadata.startLine,
      endLine: doc.metadata.endLine,
      exported: doc.metadata.exported,
      signature: doc.metadata.signature,
      docstring: doc.metadata.docstring,
    },
  }));
}

/**
 * Prepare single document for embedding
 *
 * Convenience function for preparing a single document.
 * Useful for incremental indexing or testing.
 *
 * @param doc - Document to prepare
 * @returns Embedding document
 *
 * @example
 * ```typescript
 * const doc = { ... };
 * const embeddingDoc = prepareDocumentForEmbedding(doc);
 * ```
 */
export function prepareDocumentForEmbedding(doc: Document): EmbeddingDocument {
  return {
    id: doc.id,
    text: formatDocumentText(doc),
    metadata: {
      path: doc.metadata.file,
      type: doc.type,
      language: doc.language,
      name: doc.metadata.name,
      startLine: doc.metadata.startLine,
      endLine: doc.metadata.endLine,
      exported: doc.metadata.exported,
      signature: doc.metadata.signature,
      docstring: doc.metadata.docstring,
    },
  };
}

/**
 * Filter documents by export status
 *
 * @param documents - Documents to filter
 * @param exported - True for exported only, false for non-exported only
 * @returns Filtered documents
 *
 * @example
 * ```typescript
 * const publicAPI = filterDocumentsByExport(docs, true);
 * ```
 */
export function filterDocumentsByExport(documents: Document[], exported: boolean): Document[] {
  return documents.filter((doc) => doc.metadata.exported === exported);
}

/**
 * Filter documents by type
 *
 * @param documents - Documents to filter
 * @param types - Document types to include
 * @returns Filtered documents
 *
 * @example
 * ```typescript
 * const functions = filterDocumentsByType(docs, ['function', 'method']);
 * ```
 */
export function filterDocumentsByType(documents: Document[], types: string[]): Document[] {
  return documents.filter((doc) => types.includes(doc.type));
}

/**
 * Filter documents by language
 *
 * @param documents - Documents to filter
 * @param languages - Languages to include
 * @returns Filtered documents
 *
 * @example
 * ```typescript
 * const tsFiles = filterDocumentsByLanguage(docs, ['typescript', 'javascript']);
 * ```
 */
export function filterDocumentsByLanguage(documents: Document[], languages: string[]): Document[] {
  const lowerLanguages = languages.map((lang) => lang.toLowerCase());
  return documents.filter((doc) => lowerLanguages.includes(doc.language.toLowerCase()));
}
