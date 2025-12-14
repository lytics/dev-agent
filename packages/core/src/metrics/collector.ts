/**
 * Metrics Collector
 *
 * Builds CodeMetadata from scanner results and change frequency data.
 */

import { calculateChangeFrequency } from '../indexer/utils/change-frequency.js';
import type { Document } from '../scanner/types.js';
import type { CodeMetadata } from './types.js';

/**
 * Count lines of code in a file
 */
async function countFileLines(repositoryPath: string, filePath: string): Promise<number> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  try {
    const fullPath = path.join(repositoryPath, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content.split('\n').length;
  } catch {
    // File doesn't exist or can't be read - return 0
    return 0;
  }
}

/**
 * Build code metadata from indexer state
 *
 * Combines data from:
 * - Scanner results (documents, imports)
 * - Git history (change frequency) - calculated on-demand
 *
 * @param repositoryPath - Repository path
 * @param documents - Scanned documents
 * @returns Code metadata array
 */
export async function buildCodeMetadata(
  repositoryPath: string,
  documents: Document[]
): Promise<CodeMetadata[]> {
  // Calculate change frequency using git log
  const changeFreq = await calculateChangeFrequency({
    repositoryPath,
    maxCommits: 1000,
  }).catch(() => new Map());

  // Group documents by file
  const fileToDocuments = new Map<string, Document[]>();
  for (const doc of documents) {
    const filePath = doc.metadata.file;
    const existing = fileToDocuments.get(filePath) || [];
    existing.push(doc);
    fileToDocuments.set(filePath, existing);
  }

  // Build metadata for each file - process in parallel for speed
  const CONCURRENCY = 50; // Read 50 files at a time
  const fileEntries = Array.from(fileToDocuments.entries());
  const batches: Array<[string, Document[]][]> = [];

  // Create batches
  for (let i = 0; i < fileEntries.length; i += CONCURRENCY) {
    batches.push(fileEntries.slice(i, i + CONCURRENCY));
  }

  const metadata: CodeMetadata[] = [];

  // Process each batch in parallel
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async ([filePath, docs]) => {
        const freq = changeFreq.get(filePath);

        // Count actual lines of code from the file on disk
        const linesOfCode = await countFileLines(repositoryPath, filePath);

        // Count unique imports across all documents in this file
        const allImports = new Set<string>();
        for (const doc of docs) {
          if (doc.metadata.imports) {
            for (const imp of doc.metadata.imports) {
              allImports.add(imp);
            }
          }
        }

        return {
          filePath,
          commitCount: freq?.commitCount,
          lastModified: freq?.lastModified,
          authorCount: freq?.authorCount,
          linesOfCode,
          numFunctions: docs.length, // Each document is a function/component
          numImports: allImports.size,
        };
      })
    );

    metadata.push(...batchResults);
  }

  return metadata;
}
