/**
 * Codebase Map Generator
 * Generates a hierarchical view of the codebase structure
 */

import * as path from 'node:path';
import type { RepositoryIndexer } from '../indexer';
import type { SearchResult } from '../vector/types';
import type { CodebaseMap, ExportInfo, MapNode, MapOptions } from './types';

export * from './types';

/** Default options for map generation */
const DEFAULT_OPTIONS: Required<MapOptions> = {
  depth: 2,
  focus: '',
  includeExports: true,
  maxExportsPerDir: 5,
  tokenBudget: 2000,
};

/**
 * Generate a codebase map from indexed documents
 *
 * @param indexer - Repository indexer with indexed documents
 * @param options - Map generation options
 * @returns Codebase map structure
 */
export async function generateCodebaseMap(
  indexer: RepositoryIndexer,
  options: MapOptions = {}
): Promise<CodebaseMap> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get all indexed documents (use a broad search)
  // Note: We search with a generic query to get all documents
  const allDocs = await indexer.search('function class interface type', {
    limit: 10000,
    scoreThreshold: 0,
  });

  // Build directory tree from documents
  const root = buildDirectoryTree(allDocs, opts);

  // Count totals
  const totalComponents = countComponents(root);
  const totalDirectories = countDirectories(root);

  return {
    root,
    totalComponents,
    totalDirectories,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build a directory tree from search results
 */
function buildDirectoryTree(docs: SearchResult[], opts: Required<MapOptions>): MapNode {
  // Group documents by directory
  const byDir = new Map<string, SearchResult[]>();

  for (const doc of docs) {
    const filePath = (doc.metadata.path as string) || (doc.metadata.file as string) || '';
    if (!filePath) continue;

    // Apply focus filter
    if (opts.focus && !filePath.startsWith(opts.focus)) {
      continue;
    }

    const dir = path.dirname(filePath);
    if (!byDir.has(dir)) {
      byDir.set(dir, []);
    }
    byDir.get(dir)!.push(doc);
  }

  // Build tree structure
  const rootName = opts.focus || '.';
  const root: MapNode = {
    name: rootName === '.' ? 'root' : path.basename(rootName),
    path: rootName,
    componentCount: 0,
    children: [],
    exports: [],
  };

  // Process each directory
  for (const [dir, dirDocs] of byDir) {
    insertIntoTree(root, dir, dirDocs, opts);
  }

  // Prune tree to depth
  pruneToDepth(root, opts.depth);

  // Sort children alphabetically
  sortTree(root);

  return root;
}

/**
 * Insert documents into the tree at the appropriate location
 */
function insertIntoTree(
  root: MapNode,
  dirPath: string,
  docs: SearchResult[],
  opts: Required<MapOptions>
): void {
  const parts = dirPath.split(path.sep).filter((p) => p && p !== '.');

  let current = root;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const currentPath = parts.slice(0, i + 1).join(path.sep);

    let child = current.children.find((c) => c.name === part);
    if (!child) {
      child = {
        name: part,
        path: currentPath,
        componentCount: 0,
        children: [],
        exports: [],
      };
      current.children.push(child);
    }
    current = child;
  }

  // Add component count and exports to the leaf directory
  current.componentCount += docs.length;

  if (opts.includeExports) {
    const exports = extractExports(docs, opts.maxExportsPerDir);
    current.exports = current.exports || [];
    current.exports.push(...exports);
    // Limit total exports
    if (current.exports.length > opts.maxExportsPerDir) {
      current.exports = current.exports.slice(0, opts.maxExportsPerDir);
    }
  }

  // Propagate counts up the tree
  propagateCounts(root);
}

/**
 * Extract export information from documents
 */
function extractExports(docs: SearchResult[], maxExports: number): ExportInfo[] {
  const exports: ExportInfo[] = [];

  for (const doc of docs) {
    if (doc.metadata.exported && doc.metadata.name) {
      exports.push({
        name: doc.metadata.name as string,
        type: (doc.metadata.type as string) || 'unknown',
        file: (doc.metadata.path as string) || (doc.metadata.file as string) || '',
      });

      if (exports.length >= maxExports) break;
    }
  }

  return exports;
}

/**
 * Propagate component counts up the tree
 */
function propagateCounts(node: MapNode): number {
  let total = node.componentCount;

  for (const child of node.children) {
    total += propagateCounts(child);
  }

  node.componentCount = total;
  return total;
}

/**
 * Prune tree to specified depth
 */
function pruneToDepth(node: MapNode, depth: number, currentDepth = 0): void {
  if (currentDepth >= depth) {
    // At max depth, collapse children
    node.children = [];
    return;
  }

  for (const child of node.children) {
    pruneToDepth(child, depth, currentDepth + 1);
  }
}

/**
 * Sort tree children alphabetically
 */
function sortTree(node: MapNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of node.children) {
    sortTree(child);
  }
}

/**
 * Count total components in tree
 */
function countComponents(node: MapNode): number {
  return node.componentCount;
}

/**
 * Count total directories in tree
 */
function countDirectories(node: MapNode): number {
  let count = 1; // Count this node
  for (const child of node.children) {
    count += countDirectories(child);
  }
  return count;
}

/**
 * Format codebase map as readable text
 */
export function formatCodebaseMap(map: CodebaseMap, options: MapOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  lines.push('# Codebase Map');
  lines.push('');

  // Format tree
  formatNode(map.root, lines, '', true, opts);

  lines.push('');
  lines.push(
    `**Total:** ${map.totalComponents} indexed components across ${map.totalDirectories} directories`
  );

  return lines.join('\n');
}

/**
 * Format a single node in the tree
 */
function formatNode(
  node: MapNode,
  lines: string[],
  prefix: string,
  isLast: boolean,
  opts: Required<MapOptions>
): void {
  const connector = isLast ? '└── ' : '├── ';
  const countStr = node.componentCount > 0 ? ` (${node.componentCount} components)` : '';

  lines.push(`${prefix}${connector}${node.name}/${countStr}`);

  // Add exports if present
  if (opts.includeExports && node.exports && node.exports.length > 0) {
    const exportPrefix = prefix + (isLast ? '    ' : '│   ');
    const exportNames = node.exports.map((e) => e.name).join(', ');
    lines.push(`${exportPrefix}└── exports: ${exportNames}`);
  }

  // Format children
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const isChildLast = i === node.children.length - 1;
    formatNode(child, lines, childPrefix, isChildLast, opts);
  }
}
