/**
 * Tree-sitter utility module for multi-language parsing
 *
 * Provides WASM-based tree-sitter parsing with query support.
 * Used by GoScanner and future language scanners (Python, Rust).
 */

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { findLanguageWasm, findWebTreeSitterWasm } from '../utils/wasm-resolver';

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
 *
 * Currently supported:
 * - 'go': Go language parsing (bundled in production)
 *
 * To add new languages:
 * 1. Add language to this type definition
 * 2. Update SUPPORTED_LANGUAGES in packages/dev-agent/scripts/copy-wasm.js
 * 3. Ensure tree-sitter-wasms contains the required WASM file
 * 4. Add language-specific scanner in packages/core/src/scanner/
 */
export type TreeSitterLanguage = 'go';

/**
 * Cache of loaded language grammars
 */
const languageCache = new Map<TreeSitterLanguage, LanguageType>();

/**
 * Get the path to web-tree-sitter's WASM binding file
 */
function getTreeSitterWasmPath(): string {
  return findWebTreeSitterWasm(__dirname);
}

/**
 * Initialize the tree-sitter parser (must be called before parsing)
 * This is idempotent - safe to call multiple times
 */
export async function initTreeSitter(): Promise<void> {
  if (parserInitialized && ParserClass && LanguageClass && QueryClass) return;

  let TreeSitter: typeof import('web-tree-sitter');
  try {
    // Strategy 1: Standard import (works in most dev environments)
    TreeSitter = await import('web-tree-sitter');
  } catch (importError) {
    // Strategy 2: Bundled Vendor Fallback
    // When bundled with tsup, external modules might be missing or broken.
    // We explicitly look for our vendored copy in dist/vendor/web-tree-sitter.
    try {
      const require = createRequire(__filename);
      const vendorPath = path.join(__dirname, 'vendor', 'web-tree-sitter');

      if (fs.existsSync(vendorPath)) {
        // Try requiring the directory (uses package.json if present)
        try {
          TreeSitter = require(vendorPath);
        } catch {
          // Fallback to explicit file requirement
          const cjsFile = path.join(vendorPath, 'tree-sitter.cjs');
          const jsFile = path.join(vendorPath, 'tree-sitter.js');
          if (fs.existsSync(cjsFile)) TreeSitter = require(cjsFile);
          else if (fs.existsSync(jsFile)) TreeSitter = require(jsFile);
          else throw new Error('No entry file found in vendor directory');
        }
      } else {
        // Strategy 3: Standard require resolution (last resort for dev/test)
        const modulePath = require.resolve('web-tree-sitter');
        TreeSitter = require(modulePath);
      }
    } catch (fallbackError) {
      console.error(`[scanner] Failed to load web-tree-sitter: ${importError} / ${fallbackError}`);
      throw new Error(`Could not load web-tree-sitter: ${importError}`);
    }
  }

  ParserClass = TreeSitter.Parser;
  LanguageClass = TreeSitter.Language;
  QueryClass = TreeSitter.Query;

  // Get the path to web-tree-sitter's WASM binding file
  let wasmPath: string;
  try {
    wasmPath = getTreeSitterWasmPath();
  } catch (err) {
    console.error(`[scanner] Failed to find web-tree-sitter WASM: ${err}`);
    throw err;
  }

  const absolutePath = path.resolve(wasmPath);

  // Try initializing with the absolute path directly first
  try {
    await ParserClass.init({
      locateFile: () => absolutePath,
    });
  } catch (error) {
    console.error(`[scanner] Parser.init({ locateFile }) failed: ${error}`);
    throw error;
  }

  parserInitialized = true;
}

/**
 * Get the WASM file path for a language from tree-sitter-wasms package
 */
function getWasmPath(language: TreeSitterLanguage): string {
  return findLanguageWasm(language, __dirname);
}

/**
 * Load a language grammar for tree-sitter
 */
export async function loadLanguage(language: TreeSitterLanguage): Promise<LanguageType> {
  // Declare variables outside try block so they're accessible in catch
  let wasmPath: string | undefined;
  let absolutePath: string | undefined;
  let fileUrl: string | undefined;

  try {
    // Return cached if available
    const cached = languageCache.get(language);
    if (cached) return cached;

    // Ensure parser is initialized
    await initTreeSitter();

    if (!LanguageClass) {
      throw new Error('Tree-sitter not initialized');
    }

    // Load the language WASM
    try {
      wasmPath = getWasmPath(language);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to locate tree-sitter WASM file for ${language}: ${errorMessage}`);
    }

    // Validate path (should never be undefined if getWasmPath succeeded, but double-check)
    if (!wasmPath || typeof wasmPath !== 'string') {
      throw new Error(`getWasmPath returned invalid path for ${language}: ${String(wasmPath)}`);
    }

    // Check if WASM file exists
    if (!fs.existsSync(wasmPath)) {
      throw new Error(
        `Tree-sitter WASM file not found for ${language}: ${wasmPath}. ` +
          `Make sure tree-sitter-wasms package is installed.`
      );
    }

    // Convert to absolute path
    // Note: In Node.js environment (which we are in), web-tree-sitter's Language.load expects a file path, NOT a URL.
    // Passing a file:// URL causes fs.open to fail with ENOENT.
    absolutePath = path.resolve(wasmPath);

    // Validate absolute path
    if (!absolutePath || typeof absolutePath !== 'string') {
      throw new Error(
        `Invalid WASM path resolved for ${language}: ${String(absolutePath)} (original: ${wasmPath})`
      );
    }

    // Validate LanguageClass and load method exist
    if (!LanguageClass) {
      throw new Error('LanguageClass is null - tree-sitter not initialized');
    }
    if (typeof LanguageClass.load !== 'function') {
      throw new Error(`LanguageClass.load is not a function: ${typeof LanguageClass.load}`);
    }

    const lang = await LanguageClass.load(absolutePath);
    languageCache.set(language, lang);
    return lang;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as NodeJS.ErrnoException)?.code;
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Include detailed context in error message
    // Note: wasmPath, absolutePath, fileUrl might not be defined if error happened earlier
    const context = [
      `Failed to load tree-sitter language ${language}`,
      errorMessage,
      errorCode ? `(code: ${errorCode})` : '',
      typeof wasmPath !== 'undefined' ? `WASM path: ${wasmPath}` : 'WASM path: not resolved',
      typeof absolutePath !== 'undefined'
        ? `Absolute path: ${absolutePath}`
        : 'Absolute path: not resolved',
      typeof fileUrl !== 'undefined' ? `File URL: ${fileUrl}` : 'File URL: not resolved',
      errorStack ? `Stack: ${errorStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    throw new Error(context);
  }
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
  try {
    // Validate input
    if (typeof sourceText !== 'string') {
      throw new Error(`Invalid sourceText: expected string, got ${typeof sourceText}`);
    }

    const parser = await createParser(language);
    const tree = parser.parse(sourceText);
    const lang = await loadLanguage(language);

    if (!tree) {
      throw new Error(`Failed to parse ${language} code: parser returned null`);
    }

    if (!QueryClass) {
      throw new Error('Tree-sitter not initialized: QueryClass is null');
    }

    // Cache the QueryClass reference for use in the closure
    const QueryCls = QueryClass;

    return {
      rootNode: tree.rootNode as unknown as TreeSitterNode,
      sourceText,
      query(queryString: string): QueryMatch[] {
        try {
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
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Query execution failed: ${errorMessage}`);
        }
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as NodeJS.ErrnoException)?.code;
    throw new Error(
      `Failed to parse ${language} code: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ''}`
    );
  }
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
