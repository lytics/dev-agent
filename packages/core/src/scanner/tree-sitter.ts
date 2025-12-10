/**
 * Tree-sitter utility module for multi-language parsing
 *
 * Provides WASM-based tree-sitter parsing with query support.
 * Used by GoScanner and future language scanners (Python, Rust).
 */

import * as path from 'node:path';

// web-tree-sitter types
type ParserType = import('web-tree-sitter').Parser;
type ParserConstructor = typeof import('web-tree-sitter').Parser;
type LanguageType = import('web-tree-sitter').Language;
type LanguageConstructor = typeof import('web-tree-sitter').Language;
type QueryConstructor = typeof import('web-tree-sitter').Query;

// Cached classes after initialization
let ParserClass: ParserConstructor | null = null;
let LanguageClass: LanguageConstructor | null = null;
let QueryClass: QueryConstructor | null = null;
let parserInitialized = false;

/**
 * Supported languages for tree-sitter parsing
 */
export type TreeSitterLanguage = 'go' | 'python' | 'rust';

/**
 * Cache of loaded language grammars
 */
const languageCache = new Map<TreeSitterLanguage, LanguageType>();

/**
 * Initialize the tree-sitter parser (must be called before parsing)
 * This is idempotent - safe to call multiple times
 */
export async function initTreeSitter(): Promise<void> {
  if (parserInitialized && ParserClass && LanguageClass && QueryClass) return;

  const TreeSitter = await import('web-tree-sitter');
  ParserClass = TreeSitter.Parser;
  LanguageClass = TreeSitter.Language;
  QueryClass = TreeSitter.Query;

  await ParserClass.init();
  parserInitialized = true;
}

/**
 * Get the WASM file path for a language from tree-sitter-wasms package
 */
function getWasmPath(language: TreeSitterLanguage): string {
  // tree-sitter-wasms package structure: node_modules/tree-sitter-wasms/out/tree-sitter-{lang}.wasm
  const wasmFileName = `tree-sitter-${language}.wasm`;

  // Try to resolve from node_modules
  try {
    const packagePath = require.resolve('tree-sitter-wasms/package.json');
    const packageDir = path.dirname(packagePath);
    return path.join(packageDir, 'out', wasmFileName);
  } catch {
    // Fallback: assume it's in a standard location
    return path.join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', wasmFileName);
  }
}

/**
 * Load a language grammar for tree-sitter
 */
export async function loadLanguage(language: TreeSitterLanguage): Promise<LanguageType> {
  // Return cached if available
  const cached = languageCache.get(language);
  if (cached) return cached;

  // Ensure parser is initialized
  await initTreeSitter();

  if (!LanguageClass) {
    throw new Error('Tree-sitter not initialized');
  }

  // Load the language WASM
  const wasmPath = getWasmPath(language);
  const lang = await LanguageClass.load(wasmPath);

  languageCache.set(language, lang);
  return lang;
}

/**
 * Create a new parser instance with a specific language
 */
export async function createParser(language: TreeSitterLanguage): Promise<ParserType> {
  await initTreeSitter();

  if (!ParserClass) {
    throw new Error('Tree-sitter not initialized');
  }

  const parser = new ParserClass();
  const lang = await loadLanguage(language);
  parser.setLanguage(lang);

  return parser;
}

/**
 * Parsed syntax tree with query capabilities
 */
export interface ParsedTree {
  /** The root node of the syntax tree */
  rootNode: TreeSitterNode;
  /** The source text that was parsed */
  sourceText: string;
  /** Execute a tree-sitter query and return matches */
  query(queryString: string): QueryMatch[];
}

/**
 * A node in the tree-sitter syntax tree
 */
export interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TreeSitterNode[];
  namedChildren: TreeSitterNode[];
  childForFieldName(name: string): TreeSitterNode | null;
  parent: TreeSitterNode | null;
}

/**
 * A match from a tree-sitter query
 */
export interface QueryMatch {
  pattern: number;
  captures: QueryCapture[];
}

/**
 * A captured node from a query match
 */
export interface QueryCapture {
  name: string;
  node: TreeSitterNode;
}

/**
 * Parse source code with tree-sitter
 */
export async function parseCode(
  sourceText: string,
  language: TreeSitterLanguage
): Promise<ParsedTree> {
  const parser = await createParser(language);
  const tree = parser.parse(sourceText);
  const lang = await loadLanguage(language);

  if (!tree) {
    throw new Error(`Failed to parse ${language} code`);
  }

  if (!QueryClass) {
    throw new Error('Tree-sitter not initialized');
  }

  // Cache the QueryClass reference for use in the closure
  const QueryCls = QueryClass;

  return {
    rootNode: tree.rootNode as unknown as TreeSitterNode,
    sourceText,
    query(queryString: string): QueryMatch[] {
      // Use new Query(language, source) instead of deprecated lang.query()
      const query = new QueryCls(lang, queryString);
      const matches = query.matches(tree.rootNode);

      // Convert web-tree-sitter matches to our QueryMatch format
      return matches.map((match) => ({
        pattern: match.pattern,
        captures: match.captures.map((cap) => ({
          name: cap.name,
          node: cap.node as unknown as TreeSitterNode,
        })),
      }));
    },
  };
}

/**
 * Helper to get text from source by line numbers (1-based)
 */
export function getTextByLines(sourceText: string, startLine: number, endLine: number): string {
  const lines = sourceText.split('\n');
  // Convert to 0-based indexing
  return lines.slice(startLine - 1, endLine).join('\n');
}

/**
 * Helper to extract doc comment preceding a node
 * Go doc comments are single-line // comments immediately before declarations
 */
export function extractGoDocComment(sourceText: string, nodeStartLine: number): string | undefined {
  const lines = sourceText.split('\n');
  const docLines: string[] = [];

  // Walk backwards from the line before the node
  for (let i = nodeStartLine - 2; i >= 0; i--) {
    const line = lines[i].trim();

    // Go doc comments start with //
    if (line.startsWith('//')) {
      // Remove the // prefix and trim
      const commentText = line.slice(2).trim();
      docLines.unshift(commentText);
    } else if (line === '') {
      // Empty line - stop if we already have comments, otherwise continue
      if (docLines.length > 0) break;
    } else {
      // Non-comment, non-empty line - stop
      break;
    }
  }

  return docLines.length > 0 ? docLines.join('\n') : undefined;
}
