/**
 * Go language scanner using tree-sitter
 *
 * Extracts functions, methods, structs, interfaces, and type aliases from Go source files.
 * Uses tree-sitter queries for declarative pattern matching (similar to Aider's approach).
 */

import * as path from 'node:path';
import type { Logger } from '@lytics/kero';
import {
  type FileSystemValidator,
  NodeFileSystemValidator,
  validateFile,
} from '../utils/file-validator';
import {
  extractGoDocComment,
  initTreeSitter,
  loadLanguage,
  type ParsedTree,
  parseCode,
} from './tree-sitter';
import type { Document, Scanner, ScannerCapabilities } from './types';

/**
 * Tree-sitter queries for Go code extraction
 * Based on tree-sitter-go grammar: https://github.com/tree-sitter/tree-sitter-go
 */
const GO_QUERIES = {
  // Top-level function declarations
  functions: `
    (function_declaration
      name: (identifier) @name) @definition
  `,

  // Method declarations with receivers (handles both regular and generic types)
  methods: `
    (method_declaration
      receiver: (parameter_list
        (parameter_declaration
          name: (identifier)? @receiver_name
          type: [
            (pointer_type (type_identifier) @receiver_type)
            (pointer_type (generic_type (type_identifier) @receiver_type))
            (type_identifier) @receiver_type
            (generic_type (type_identifier) @receiver_type)
          ])) @receiver
      name: (field_identifier) @name) @definition
  `,

  // Struct type declarations
  structs: `
    (type_declaration
      (type_spec
        name: (type_identifier) @name
        type: (struct_type) @struct_body)) @definition
  `,

  // Interface type declarations
  interfaces: `
    (type_declaration
      (type_spec
        name: (type_identifier) @name
        type: (interface_type) @interface_body)) @definition
  `,

  // Type alias declarations (non-struct, non-interface)
  typeAliases: `
    (type_declaration
      (type_spec
        name: (type_identifier) @name
        type: [
          (type_identifier)
          (qualified_type)
          (array_type)
          (slice_type)
          (map_type)
          (channel_type)
          (function_type)
        ] @alias_type)) @definition
  `,

  // Const declarations
  constants: `
    (const_declaration
      (const_spec
        name: (identifier) @name
        value: (_)? @value)) @definition
  `,

  // Var declarations (package-level)
  variables: `
    (var_declaration
      (var_spec
        name: (identifier) @name
        value: (_)? @value)) @definition
  `,

  // Package declaration
  package: `
    (package_clause
      (package_identifier) @name) @definition
  `,
};

/**
 * Go scanner using tree-sitter for parsing
 */
export class GoScanner implements Scanner {
  readonly language = 'go';
  readonly capabilities: ScannerCapabilities = {
    syntax: true,
    types: true,
    documentation: true,
  };

  /** Maximum lines for code snippets */
  private static readonly MAX_SNIPPET_LINES = 50;

  /** File validator (injected for testability) */
  private fileValidator: FileSystemValidator;

  constructor(fileValidator: FileSystemValidator = new NodeFileSystemValidator()) {
    this.fileValidator = fileValidator;
  }

  canHandle(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.go';
  }

  /**
   * Validate that Go scanning support is available
   */
  private async validateGoSupport(): Promise<void> {
    try {
      // Try to initialize tree-sitter and load Go language
      await initTreeSitter();
      await loadLanguage('go');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('tree-sitter WASM') || errorMessage.includes('Failed to locate')) {
        throw new Error(
          'Go tree-sitter WASM files not found. ' +
            'tree-sitter-go.wasm is required for Go code parsing.'
        );
      }
      throw error;
    }
  }

  async scan(files: string[], repoRoot: string, logger?: Logger): Promise<Document[]> {
    const documents: Document[] = [];
    const total = files.length;
    const errors: Array<{
      file: string;
      absolutePath: string;
      error: string;
      phase: string;
      stack?: string;
    }> = [];

    // Runtime check: Ensure Go support is available
    try {
      await this.validateGoSupport();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger?.error({ error: errorMessage }, 'Go scanner initialization failed');
      throw new Error(
        `Go scanner cannot function: ${errorMessage}\n` +
          'This usually means tree-sitter WASM files are missing.\n' +
          'If you installed dev-agent from source, run: pnpm build\n' +
          'If you installed via npm, try reinstalling: npm install -g dev-agent'
      );
    }

    const startTime = Date.now();

    for (let i = 0; i < total; i++) {
      const file = files[i];

      // Log progress every 50 files (more frequent feedback)
      if (logger && i > 0 && i % 50 === 0) {
        const elapsed = Date.now() - startTime;
        const filesPerSecond = i / (elapsed / 1000);
        const remainingFiles = total - i;
        const etaSeconds = Math.ceil(remainingFiles / filesPerSecond);
        const etaMinutes = Math.floor(etaSeconds / 60);
        const etaSecondsRemainder = etaSeconds % 60;

        const etaText =
          etaMinutes > 0 ? `${etaMinutes}m ${etaSecondsRemainder}s` : `${etaSecondsRemainder}s`;

        const percent = Math.round((i / total) * 100);
        logger.info(
          {
            filesProcessed: i,
            total,
            percent,
            documents: documents.length,
            filesPerSecond: Math.round(filesPerSecond * 10) / 10,
            eta: etaText,
          },
          `go ${i}/${total} (${percent}%) - ${documents.length} docs extracted, ${Math.round(filesPerSecond)} files/sec, ETA: ${etaText}`
        );
      }

      try {
        const absolutePath = path.join(repoRoot, file);

        // Validate file using testable utility
        const validation = validateFile(file, absolutePath, this.fileValidator);
        if (!validation.isValid) {
          errors.push({
            file,
            absolutePath,
            error: validation.error || 'Unknown validation error',
            phase: validation.phase || 'fileValidation',
          });
          continue;
        }

        const sourceText = this.fileValidator.readText(absolutePath);

        // Skip generated files
        if (this.isGeneratedFile(sourceText)) {
          continue;
        }

        const fileDocs = await this.extractFromFile(sourceText, file);
        documents.push(...fileDocs);
      } catch (error) {
        // Collect detailed error information
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        errors.push({
          file,
          absolutePath: path.join(repoRoot, file),
          error: errorMessage,
          phase: 'extractFromFile',
          stack: errorStack,
        });

        // Log first 10 errors at INFO level, rest at DEBUG
        if (errors.length <= 10) {
          logger?.info(
            {
              file,
              absolutePath: path.join(repoRoot, file),
              error: errorMessage,
              phase: 'extractFromFile',
              errorNumber: errors.length,
            },
            `[${errors.length}] Skipped Go file (extractFromFile): ${file}`
          );
        } else {
          logger?.debug(
            { file, error: errorMessage, phase: 'extractFromFile' },
            `Skipped Go file (extractFromFile): ${file}`
          );
        }
      }
    }

    // Log final summary
    const successCount = documents.length;
    const failureCount = errors.length;

    if (failureCount > 0) {
      // Group errors by type for summary
      const errorsByPhase = new Map<string, number>();
      for (const err of errors) {
        errorsByPhase.set(err.phase, (errorsByPhase.get(err.phase) || 0) + 1);
      }

      const errorSummary = Array.from(errorsByPhase.entries())
        .map(([phase, count]) => `${count} ${phase}`)
        .join(', ');

      logger?.info(
        { successCount, failureCount, total, errorSummary },
        `Go scan complete: ${successCount}/${total} files processed successfully. Skipped: ${errorSummary}`
      );
    } else {
      logger?.info(
        { successCount, total },
        `Go scan complete: ${successCount}/${total} files processed successfully`
      );
    }

    return documents;
  }

  /**
   * Check if a file is generated (should be skipped)
   */
  private isGeneratedFile(sourceText: string): boolean {
    const firstLine = sourceText.split('\n')[0] || '';
    return firstLine.includes('Code generated') || firstLine.includes('DO NOT EDIT');
  }

  /**
   * Extract documents from a single Go file
   */
  private async extractFromFile(sourceText: string, relativeFile: string): Promise<Document[]> {
    const documents: Document[] = [];
    const tree = await parseCode(sourceText, 'go');
    const isTestFile = relativeFile.endsWith('_test.go');

    // Extract functions
    documents.push(...this.extractFunctions(tree, sourceText, relativeFile, isTestFile));

    // Extract methods
    documents.push(...this.extractMethods(tree, sourceText, relativeFile, isTestFile));

    // Extract structs
    documents.push(...this.extractStructs(tree, sourceText, relativeFile, isTestFile));

    // Extract interfaces
    documents.push(...this.extractInterfaces(tree, sourceText, relativeFile, isTestFile));

    // Extract type aliases
    documents.push(...this.extractTypeAliases(tree, sourceText, relativeFile, isTestFile));

    // Extract constants
    documents.push(...this.extractConstants(tree, sourceText, relativeFile, isTestFile));

    return documents;
  }

  /**
   * Extract function declarations
   */
  private extractFunctions(
    tree: ParsedTree,
    sourceText: string,
    file: string,
    isTestFile: boolean
  ): Document[] {
    const documents: Document[] = [];
    const matches = tree.query(GO_QUERIES.functions);

    for (const match of matches) {
      const nameCapture = match.captures.find((c) => c.name === 'name');
      const defCapture = match.captures.find((c) => c.name === 'definition');

      if (!nameCapture || !defCapture) continue;

      const name = nameCapture.node.text;
      const startLine = defCapture.node.startPosition.row + 1; // 1-based
      const endLine = defCapture.node.endPosition.row + 1;
      const fullText = defCapture.node.text;
      const signature = this.extractSignature(fullText);
      const docstring = extractGoDocComment(sourceText, startLine);
      const exported = this.isExported(name);
      const snippet = this.truncateSnippet(fullText);

      // Check for generics
      const { isGeneric, typeParameters } = this.extractTypeParameters(signature);

      documents.push({
        id: `${file}:${name}:${startLine}`,
        text: this.buildEmbeddingText('function', name, signature, docstring),
        type: 'function',
        language: 'go',
        metadata: {
          file,
          startLine,
          endLine,
          name,
          signature,
          exported,
          docstring,
          snippet,
          custom: {
            ...(isTestFile ? { isTest: true } : {}),
            ...(isGeneric ? { isGeneric, typeParameters } : {}),
          },
        },
      });
    }

    return documents;
  }

  /**
   * Extract method declarations (functions with receivers)
   */
  private extractMethods(
    tree: ParsedTree,
    sourceText: string,
    file: string,
    isTestFile: boolean
  ): Document[] {
    const documents: Document[] = [];
    const matches = tree.query(GO_QUERIES.methods);

    for (const match of matches) {
      const nameCapture = match.captures.find((c) => c.name === 'name');
      const defCapture = match.captures.find((c) => c.name === 'definition');
      const receiverTypeCapture = match.captures.find((c) => c.name === 'receiver_type');
      const receiverCapture = match.captures.find((c) => c.name === 'receiver');

      if (!nameCapture || !defCapture) continue;

      const methodName = nameCapture.node.text;
      const receiverType = receiverTypeCapture?.node.text || 'Unknown';
      // Strip type parameters from receiver for cleaner name (Stack[T] -> Stack)
      const baseReceiverType = receiverType.replace(/\[.*\]/, '');
      const name = `${baseReceiverType}.${methodName}`;
      const startLine = defCapture.node.startPosition.row + 1;
      const endLine = defCapture.node.endPosition.row + 1;
      const fullText = defCapture.node.text;
      const signature = this.extractSignature(fullText);
      const docstring = extractGoDocComment(sourceText, startLine);
      const exported = this.isExported(methodName);
      const snippet = this.truncateSnippet(fullText);

      // Check if receiver is a pointer
      const receiverText = receiverCapture?.node.text || '';
      const receiverPointer = receiverText.includes('*');

      // Check for generics (receiver has type params like Stack[T])
      const receiverHasGenerics = receiverType.includes('[');
      const { isGeneric: signatureHasGenerics, typeParameters } =
        this.extractTypeParameters(signature);
      const isGeneric = receiverHasGenerics || signatureHasGenerics;

      documents.push({
        id: `${file}:${name}:${startLine}`,
        text: this.buildEmbeddingText('method', name, signature, docstring),
        type: 'method',
        language: 'go',
        metadata: {
          file,
          startLine,
          endLine,
          name,
          signature,
          exported,
          docstring,
          snippet,
          custom: {
            receiver: baseReceiverType,
            receiverPointer,
            ...(isTestFile ? { isTest: true } : {}),
            ...(isGeneric ? { isGeneric, typeParameters } : {}),
          },
        },
      });
    }

    return documents;
  }

  /**
   * Extract struct declarations
   */
  private extractStructs(
    tree: ParsedTree,
    sourceText: string,
    file: string,
    isTestFile: boolean
  ): Document[] {
    const documents: Document[] = [];
    const matches = tree.query(GO_QUERIES.structs);

    for (const match of matches) {
      const nameCapture = match.captures.find((c) => c.name === 'name');
      const defCapture = match.captures.find((c) => c.name === 'definition');

      if (!nameCapture || !defCapture) continue;

      const name = nameCapture.node.text;
      const startLine = defCapture.node.startPosition.row + 1;
      const endLine = defCapture.node.endPosition.row + 1;
      const fullText = defCapture.node.text;

      // Check for generics in the full declaration text
      const { isGeneric, typeParameters } = this.extractTypeParameters(fullText);
      const signature = isGeneric
        ? `type ${name}[${typeParameters?.join(', ')}] struct`
        : `type ${name} struct`;

      const docstring = extractGoDocComment(sourceText, startLine);
      const exported = this.isExported(name);
      const snippet = this.truncateSnippet(fullText);

      documents.push({
        id: `${file}:${name}:${startLine}`,
        text: this.buildEmbeddingText('struct', name, signature, docstring),
        type: 'class', // Map struct to 'class' for consistency with other scanners
        language: 'go',
        metadata: {
          file,
          startLine,
          endLine,
          name,
          signature,
          exported,
          docstring,
          snippet,
          custom: {
            ...(isTestFile ? { isTest: true } : {}),
            ...(isGeneric ? { isGeneric, typeParameters } : {}),
          },
        },
      });
    }

    return documents;
  }

  /**
   * Extract interface declarations
   */
  private extractInterfaces(
    tree: ParsedTree,
    sourceText: string,
    file: string,
    isTestFile: boolean
  ): Document[] {
    const documents: Document[] = [];
    const matches = tree.query(GO_QUERIES.interfaces);

    for (const match of matches) {
      const nameCapture = match.captures.find((c) => c.name === 'name');
      const defCapture = match.captures.find((c) => c.name === 'definition');

      if (!nameCapture || !defCapture) continue;

      const name = nameCapture.node.text;
      const startLine = defCapture.node.startPosition.row + 1;
      const endLine = defCapture.node.endPosition.row + 1;
      const fullText = defCapture.node.text;

      // Check for generics in the full declaration text
      const { isGeneric, typeParameters } = this.extractTypeParameters(fullText);
      const signature = isGeneric
        ? `type ${name}[${typeParameters?.join(', ')}] interface`
        : `type ${name} interface`;

      const docstring = extractGoDocComment(sourceText, startLine);
      const exported = this.isExported(name);
      const snippet = this.truncateSnippet(fullText);

      documents.push({
        id: `${file}:${name}:${startLine}`,
        text: this.buildEmbeddingText('interface', name, signature, docstring),
        type: 'interface',
        language: 'go',
        metadata: {
          file,
          startLine,
          endLine,
          name,
          signature,
          exported,
          docstring,
          snippet,
          custom: {
            ...(isTestFile ? { isTest: true } : {}),
            ...(isGeneric ? { isGeneric, typeParameters } : {}),
          },
        },
      });
    }

    return documents;
  }

  /**
   * Extract type alias declarations
   */
  private extractTypeAliases(
    tree: ParsedTree,
    sourceText: string,
    file: string,
    isTestFile: boolean
  ): Document[] {
    const documents: Document[] = [];
    const matches = tree.query(GO_QUERIES.typeAliases);

    for (const match of matches) {
      const nameCapture = match.captures.find((c) => c.name === 'name');
      const defCapture = match.captures.find((c) => c.name === 'definition');

      if (!nameCapture || !defCapture) continue;

      const name = nameCapture.node.text;
      const startLine = defCapture.node.startPosition.row + 1;
      const endLine = defCapture.node.endPosition.row + 1;
      const fullText = defCapture.node.text;
      const signature = fullText.trim();
      const docstring = extractGoDocComment(sourceText, startLine);
      const exported = this.isExported(name);
      const snippet = this.truncateSnippet(fullText);

      documents.push({
        id: `${file}:${name}:${startLine}`,
        text: this.buildEmbeddingText('type', name, signature, docstring),
        type: 'type',
        language: 'go',
        metadata: {
          file,
          startLine,
          endLine,
          name,
          signature,
          exported,
          docstring,
          snippet,
          custom: isTestFile ? { isTest: true } : undefined,
        },
      });
    }

    return documents;
  }

  /**
   * Extract constant declarations
   */
  private extractConstants(
    tree: ParsedTree,
    sourceText: string,
    file: string,
    isTestFile: boolean
  ): Document[] {
    const documents: Document[] = [];
    const matches = tree.query(GO_QUERIES.constants);

    for (const match of matches) {
      const nameCapture = match.captures.find((c) => c.name === 'name');
      const defCapture = match.captures.find((c) => c.name === 'definition');

      if (!nameCapture || !defCapture) continue;

      const name = nameCapture.node.text;
      // Only extract exported constants
      if (!this.isExported(name)) continue;

      const startLine = defCapture.node.startPosition.row + 1;
      const endLine = defCapture.node.endPosition.row + 1;
      const fullText = defCapture.node.text;
      const signature = fullText.trim();
      const docstring = extractGoDocComment(sourceText, startLine);
      const snippet = this.truncateSnippet(fullText);

      documents.push({
        id: `${file}:${name}:${startLine}`,
        text: this.buildEmbeddingText('constant', name, signature, docstring),
        type: 'variable',
        language: 'go',
        metadata: {
          file,
          startLine,
          endLine,
          name,
          signature,
          exported: true,
          docstring,
          snippet,
          custom: {
            isConstant: true,
            ...(isTestFile ? { isTest: true } : {}),
          },
        },
      });
    }

    return documents;
  }

  /**
   * Check if a Go identifier is exported (starts with uppercase)
   */
  private isExported(name: string): boolean {
    if (!name || name.length === 0) return false;
    const firstChar = name.charAt(0);
    return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
  }

  /**
   * Extract function/method signature (first line up to the opening brace)
   */
  private extractSignature(fullText: string): string {
    const braceIndex = fullText.indexOf('{');
    if (braceIndex === -1) return fullText.trim();
    return fullText.slice(0, braceIndex).trim();
  }

  /**
   * Extract type parameters from a generic declaration.
   * Returns { isGeneric, typeParameters } where typeParameters is an array like ["T any", "K comparable"]
   */
  private extractTypeParameters(signature: string): {
    isGeneric: boolean;
    typeParameters?: string[];
  } {
    // Match type parameters in brackets: func Name[T any, K comparable](...) or type Name[T any] struct
    // Look for [ before ( for functions, or [ after type name for types
    const typeParamMatch = signature.match(/\[([^\]]+)\]/);
    if (!typeParamMatch) {
      return { isGeneric: false };
    }

    const params = typeParamMatch[1];
    // Split by comma, but handle constraints like "~int | ~string"
    const typeParameters = params
      .split(/,\s*/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return {
      isGeneric: true,
      typeParameters,
    };
  }

  /**
   * Build embedding text for vector search
   */
  private buildEmbeddingText(
    type: string,
    name: string,
    signature: string,
    docstring?: string
  ): string {
    const parts = [`${type} ${name}`, signature];
    if (docstring) {
      parts.push(docstring);
    }
    return parts.join('\n');
  }

  /**
   * Truncate code snippet to maximum lines
   */
  private truncateSnippet(text: string): string {
    const lines = text.split('\n');
    if (lines.length <= GoScanner.MAX_SNIPPET_LINES) {
      return text;
    }
    const truncated = lines.slice(0, GoScanner.MAX_SNIPPET_LINES).join('\n');
    const remaining = lines.length - GoScanner.MAX_SNIPPET_LINES;
    return `${truncated}\n// ... ${remaining} more lines`;
  }
}
