/**
 * Metrics Collector
 *
 * Builds CodeMetadata from scanner results and change frequency data.
 */

import { calculateChangeFrequency } from '../indexer/utils/change-frequency.js';
import type { Document } from '../scanner/types.js';
import type { CodeMetadata } from './types.js';

/**
 * Count lines of code in a snippet
 */
function countLines(content: string): number {
  return content.split('\n').length;
}

/**
 * Build code metadata from indexer state
 *
 * Combines data from:
 * - Scanner results (documents, imports)
 * - Git history (change frequency)
 *
 * @param repositoryPath - Repository path
 * @param documents - Scanned documents
 * @returns Array of code metadata
 */
export async function buildCodeMetadata(
  repositoryPath: string,
  documents: Document[]
): Promise<CodeMetadata[]> {
  // Calculate change frequency for all files
  const changeFreq = await calculateChangeFrequency({ repositoryPath }).catch(() => new Map());

  // Group documents by file
  const fileToDocuments = new Map<string, Document[]>();
  for (const doc of documents) {
    const filePath = doc.metadata.file;
    const existing = fileToDocuments.get(filePath) || [];
    existing.push(doc);
    fileToDocuments.set(filePath, existing);
  }

  // Build metadata for each file
  const metadata: CodeMetadata[] = [];

  for (const [filePath, docs] of fileToDocuments) {
    const freq = changeFreq.get(filePath);

    // Estimate LOC from first document's snippet (approximate)
    // In practice, this is an underestimate since snippet is truncated
    // But it's good enough for relative comparisons
    const linesOfCode = docs[0]?.metadata.snippet
      ? countLines(docs[0].metadata.snippet)
      : docs[0]?.metadata.endLine - docs[0]?.metadata.startLine || 0;

    // Count unique imports across all documents in this file
    const allImports = new Set<string>();
    for (const doc of docs) {
      if (doc.metadata.imports) {
        for (const imp of doc.metadata.imports) {
          allImports.add(imp);
        }
      }
    }

    metadata.push({
      filePath,
      commitCount: freq?.commitCount,
      lastModified: freq?.lastModified,
      authorCount: freq?.authorCount,
      linesOfCode,
      numFunctions: docs.length, // Each document is a function/component
      numImports: allImports.size,
    });
  }

  return metadata;
}
