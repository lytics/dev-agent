/**
 * Formatting Utilities
 * Functions for document text formatting and optimization
 */

import type { Document } from '../../scanner/types';

/**
 * Format document text for better embedding quality
 *
 * Combines document name and content to provide rich semantic context
 * for embedding generation. This improves search relevance by including
 * both structural information (type, name) and actual content.
 *
 * @param doc - Document to format
 * @returns Formatted text suitable for embedding
 *
 * @example
 * ```typescript
 * const doc = {
 *   type: 'function',
 *   metadata: { name: 'calculateTotal' },
 *   text: 'function calculateTotal(items) { ... }'
 * };
 *
 * formatDocumentText(doc);
 * // "function: calculateTotal\n\nfunction calculateTotal(items) { ... }"
 * ```
 */
export function formatDocumentText(doc: Document): string {
  const parts: string[] = [];

  // Add type and name for context
  if (doc.metadata.name) {
    parts.push(`${doc.type}: ${doc.metadata.name}`);
  }

  // Add actual content
  if (doc.text) {
    parts.push(doc.text);
  }

  return parts.join('\n\n');
}

/**
 * Format document text with signature
 *
 * Includes function/method signature for enhanced searchability.
 * Useful when you want to make signatures more prominent in search.
 *
 * @param doc - Document to format
 * @returns Formatted text with signature emphasis
 *
 * @example
 * ```typescript
 * const doc = {
 *   type: 'function',
 *   metadata: {
 *     name: 'processData',
 *     signature: 'processData(data: string[]): Promise<void>'
 *   },
 *   text: 'async function processData...'
 * };
 *
 * formatDocumentTextWithSignature(doc);
 * // "function: processData\nprocessData(data: string[])...
 * ```
 */
export function formatDocumentTextWithSignature(doc: Document): string {
  const parts: string[] = [];

  // Add type and name
  if (doc.metadata.name) {
    parts.push(`${doc.type}: ${doc.metadata.name}`);
  }

  // Add signature if available
  if (doc.metadata.signature) {
    parts.push(doc.metadata.signature);
  }

  // Add content
  if (doc.text) {
    parts.push(doc.text);
  }

  return parts.join('\n');
}

/**
 * Truncate document text to maximum length
 *
 * Useful for limiting embedding input size while preserving
 * the most important information (beginning of the document).
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length in characters
 * @returns Truncated text with ellipsis if needed
 *
 * @example
 * ```typescript
 * truncateText('Long text...', 20);
 * // "Long text...
 *
 * truncateText('Short', 20);
 * // "Short"
 * ```
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Clean document text by removing excessive whitespace
 *
 * Normalizes whitespace while preserving intentional line breaks.
 * Helps reduce token count for embeddings.
 *
 * @param text - Text to clean
 * @returns Cleaned text
 *
 * @example
 * ```typescript
 * cleanDocumentText('function  foo() {\n\n\n  return  42;\n}');
 * // "function foo() {\n\n  return 42;\n}"
 * ```
 */
export function cleanDocumentText(text: string): string {
  return (
    text
      // Replace multiple spaces with single space
      .replace(/ +/g, ' ')
      // Replace more than 2 newlines with 2 newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim leading/trailing whitespace
      .trim()
  );
}
