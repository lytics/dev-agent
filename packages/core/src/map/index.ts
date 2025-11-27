/**
 * Codebase Map Generator
 * Generates a hierarchical view of the codebase structure
 */

import * as path from 'node:path';
import type { LocalGitExtractor } from '../git/extractor';
import type { RepositoryIndexer } from '../indexer';
import type { SearchResult } from '../vector/types';
import type {
  ChangeFrequency,
  CodebaseMap,
  ExportInfo,
  HotPath,
  MapNode,
  MapOptions,
} from './types';

export * from './types';

/** Default options for map generation */
const DEFAULT_OPTIONS: Required<MapOptions> = {
  depth: 2,
  focus: '',
  includeExports: true,
  maxExportsPerDir: 5,
  includeHotPaths: true,
  maxHotPaths: 5,
  smartDepth: false,
  smartDepthThreshold: 10,
  tokenBudget: 2000,
  includeChangeFrequency: false,
};

/** Context for map generation including optional git extractor */
export interface MapGenerationContext {
  indexer: RepositoryIndexer;
  gitExtractor?: LocalGitExtractor;
}

/**
 * Generate a codebase map from indexed documents
 *
 * @param indexer - Repository indexer with indexed documents
 * @param options - Map generation options
 * @returns Codebase map structure
 */
export async function generateCodebaseMap(
  indexer: RepositoryIndexer,
  options?: MapOptions
): Promise<CodebaseMap>;

/**
 * Generate a codebase map with git history context
 *
 * @param context - Map generation context with indexer and optional git extractor
 * @param options - Map generation options
 * @returns Codebase map structure
 */
export async function generateCodebaseMap(
  context: MapGenerationContext,
  options?: MapOptions
): Promise<CodebaseMap>;

export async function generateCodebaseMap(
  indexerOrContext: RepositoryIndexer | MapGenerationContext,
  options?: MapOptions
): Promise<CodebaseMap> {
  const opts = { ...DEFAULT_OPTIONS, ...(options || {}) };

  // Normalize input
  const context: MapGenerationContext =
    'indexer' in indexerOrContext
      ? indexerOrContext
      : { indexer: indexerOrContext as RepositoryIndexer };

  // Get all indexed documents (use a broad search)
  // Note: We search with a generic query to get all documents
  const allDocs = await context.indexer.search('function class interface type', {
    limit: 10000,
    scoreThreshold: 0,
  });

  // Build directory tree from documents
  const root = buildDirectoryTree(allDocs, opts);

  // Count totals
  const totalComponents = countComponents(root);
  const totalDirectories = countDirectories(root);

  // Compute hot paths (most referenced files)
  const hotPaths = opts.includeHotPaths ? computeHotPaths(allDocs, opts.maxHotPaths) : [];

  // Compute change frequency if requested and git extractor is available
  if (opts.includeChangeFrequency && context.gitExtractor) {
    await computeChangeFrequency(root, context.gitExtractor);
  }

  return {
    root,
    totalComponents,
    totalDirectories,
    hotPaths,
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
    const existing = byDir.get(dir);
    if (existing) {
      existing.push(doc);
    } else {
      byDir.set(dir, [doc]);
    }
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

  // Prune tree to depth (smart or fixed)
  if (opts.smartDepth) {
    smartPruneTree(root, opts.depth, opts.smartDepthThreshold);
  } else {
    pruneToDepth(root, opts.depth);
  }

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
        signature: doc.metadata.signature as string | undefined,
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
 * Smart prune tree - expand dense directories, collapse sparse ones
 * Uses information density heuristic: expand if componentCount >= threshold
 */
function smartPruneTree(
  node: MapNode,
  maxDepth: number,
  threshold: number,
  currentDepth = 0
): void {
  // Always stop at max depth
  if (currentDepth >= maxDepth) {
    node.children = [];
    return;
  }

  // For each child, decide whether to expand or collapse
  for (const child of node.children) {
    // Expand if:
    // 1. We're within first 2 levels (always show some structure)
    // 2. OR the child has enough components to be "interesting"
    const shouldExpand = currentDepth < 2 || child.componentCount >= threshold;

    if (shouldExpand) {
      smartPruneTree(child, maxDepth, threshold, currentDepth + 1);
    } else {
      // Collapse this branch - it's too sparse to be interesting
      child.children = [];
    }
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
 * Compute change frequency for all nodes in the tree
 */
async function computeChangeFrequency(root: MapNode, extractor: LocalGitExtractor): Promise<void> {
  // Collect all unique directory paths
  const dirPaths = collectDirectoryPaths(root);

  // Get date thresholds
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Compute frequency for each directory
  const frequencyMap = new Map<string, ChangeFrequency>();

  for (const dirPath of dirPaths) {
    try {
      // Get commits for this directory in the last 90 days
      const commits = await extractor.getCommits({
        path: dirPath === 'root' ? '.' : dirPath,
        limit: 100,
        since: ninetyDaysAgo.toISOString(),
        noMerges: true,
      });

      // Count commits in each time window
      let last30Days = 0;
      const last90Days = commits.length;
      let lastCommit: string | undefined;

      for (const commit of commits) {
        const commitDate = new Date(commit.author.date);
        if (commitDate >= thirtyDaysAgo) {
          last30Days++;
        }
        if (!lastCommit || commitDate > new Date(lastCommit)) {
          lastCommit = commit.author.date;
        }
      }

      frequencyMap.set(dirPath, {
        last30Days,
        last90Days,
        lastCommit,
      });
    } catch {
      // Directory might not exist in git or other error
      // Just skip it
    }
  }

  // Apply frequency data to tree nodes
  applyChangeFrequency(root, frequencyMap);
}

/**
 * Collect all directory paths from the tree
 */
function collectDirectoryPaths(node: MapNode, paths: string[] = []): string[] {
  paths.push(node.path);
  for (const child of node.children) {
    collectDirectoryPaths(child, paths);
  }
  return paths;
}

/**
 * Apply change frequency data to tree nodes
 */
function applyChangeFrequency(node: MapNode, frequencyMap: Map<string, ChangeFrequency>): void {
  const freq = frequencyMap.get(node.path);
  if (freq) {
    node.changeFrequency = freq;
  }

  for (const child of node.children) {
    applyChangeFrequency(child, frequencyMap);
  }
}

/**
 * Compute hot paths - files with the most incoming references
 */
function computeHotPaths(docs: SearchResult[], maxPaths: number): HotPath[] {
  // Count incoming references per file
  const refCounts = new Map<string, { count: number; component?: string }>();

  for (const doc of docs) {
    const callers = doc.metadata.callers as Array<{ file: string }> | undefined;
    if (callers && Array.isArray(callers)) {
      // This document is called by others - count it
      const filePath = (doc.metadata.path as string) || (doc.metadata.file as string) || '';
      if (filePath) {
        const existing = refCounts.get(filePath) || { count: 0 };
        existing.count += callers.length;
        existing.component = existing.component || (doc.metadata.name as string);
        refCounts.set(filePath, existing);
      }
    }
  }

  // Also count based on callees pointing to files
  for (const doc of docs) {
    const callees = doc.metadata.callees as Array<{ file: string; name: string }> | undefined;
    if (callees && Array.isArray(callees)) {
      for (const callee of callees) {
        if (callee.file) {
          const existing = refCounts.get(callee.file) || { count: 0 };
          existing.count += 1;
          refCounts.set(callee.file, existing);
        }
      }
    }
  }

  // Sort by count and take top N
  const sorted = Array.from(refCounts.entries())
    .map(([file, data]) => ({
      file,
      incomingRefs: data.count,
      primaryComponent: data.component,
    }))
    .sort((a, b) => b.incomingRefs - a.incomingRefs)
    .slice(0, maxPaths);

  return sorted;
}

/**
 * Format codebase map as readable text
 */
export function formatCodebaseMap(map: CodebaseMap, options: MapOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  lines.push('# Codebase Map');
  lines.push('');

  // Format hot paths if present
  if (opts.includeHotPaths && map.hotPaths.length > 0) {
    lines.push('## Hot Paths (most referenced)');
    for (let i = 0; i < map.hotPaths.length; i++) {
      const hp = map.hotPaths[i];
      const component = hp.primaryComponent ? ` (${hp.primaryComponent})` : '';
      lines.push(`${i + 1}. \`${hp.file}\`${component} - ${hp.incomingRefs} refs`);
    }
    lines.push('');
  }

  // Format tree
  lines.push('## Directory Structure');
  lines.push('');
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

  // Add change frequency indicator if available
  let freqStr = '';
  if (opts.includeChangeFrequency && node.changeFrequency) {
    const freq = node.changeFrequency;
    if (freq.last30Days > 0) {
      // Hot: 5+ commits in 30 days
      if (freq.last30Days >= 5) {
        freqStr = ` 🔥 ${freq.last30Days} commits this month`;
      } else {
        freqStr = ` ✏️ ${freq.last30Days} commits this month`;
      }
    } else if (freq.last90Days > 0) {
      freqStr = ` 📝 ${freq.last90Days} commits (90d)`;
    }
  }

  lines.push(`${prefix}${connector}${node.name}/${countStr}${freqStr}`);

  // Add exports if present
  if (opts.includeExports && node.exports && node.exports.length > 0) {
    const exportPrefix = prefix + (isLast ? '    ' : '│   ');
    const exportItems = node.exports.map((e) => {
      // Use signature if available, otherwise just name
      if (e.signature) {
        // Truncate long signatures
        const sig = e.signature.length > 60 ? `${e.signature.slice(0, 57)}...` : e.signature;
        return sig;
      }
      return e.name;
    });
    lines.push(`${exportPrefix}└── exports: ${exportItems.join(', ')}`);
  }

  // Format children
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const isChildLast = i === node.children.length - 1;
    formatNode(child, lines, childPrefix, isChildLast, opts);
  }
}
