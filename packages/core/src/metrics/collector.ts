/**
 * Metrics Collector
 *
 * Builds CodeMetadata from scanner results and change frequency data.
 */

// Note: We import FileAuthorContribution type only for internal use in deriving change frequency
import type { FileAuthorContribution } from '../indexer/utils/change-frequency.js';
import { calculateFileAuthorContributions } from '../indexer/utils/change-frequency.js';
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
  // Use fast batched author contributions call to derive change frequency
  // This is much faster than the old calculateChangeFrequency which made individual git calls per file
  const authorContributions = await calculateFileAuthorContributions({ repositoryPath }).catch(
    () => new Map()
  );

  // Derive change frequency from author contributions (no additional git calls!)
  const changeFreq = new Map<
    string,
    { commitCount: number; lastModified: Date; authorCount: number }
  >();

  for (const [filePath, contributions] of authorContributions) {
    // Sum commit counts across all authors
    const commitCount = contributions.reduce(
      (sum: number, c: FileAuthorContribution) => sum + c.commitCount,
      0
    );

    // Get most recent commit across all authors
    const lastModified =
      contributions.reduce(
        (latest: Date | null, c: FileAuthorContribution) => {
          if (!c.lastCommit) return latest;
          if (!latest) return c.lastCommit;
          return c.lastCommit > latest ? c.lastCommit : latest;
        },
        null as Date | null
      ) || new Date(0);

    // Author count is number of unique contributors
    const authorCount = contributions.length;

    changeFreq.set(filePath, {
      commitCount,
      lastModified,
      authorCount,
    });
  }

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
