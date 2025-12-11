import * as path from 'node:path';
import type { Logger } from '@lytics/kero';
import {
  type ArrowFunction,
  type CallExpression,
  type ClassDeclaration,
  type FunctionDeclaration,
  type FunctionExpression,
  type InterfaceDeclaration,
  type MethodDeclaration,
  type Node,
  Project,
  type SourceFile,
  SyntaxKind,
  type TypeAliasDeclaration,
  type VariableDeclaration,
  type VariableStatement,
} from 'ts-morph';
import { getCurrentSystemResources, getOptimalConcurrency } from '../utils/concurrency';
import type { CalleeInfo, Document, Scanner, ScannerCapabilities } from './types';

/**
 * Enhanced TypeScript scanner using ts-morph
 * Provides type information and cross-file references
 */
export class TypeScriptScanner implements Scanner {
  readonly language = 'typescript';
  readonly capabilities: ScannerCapabilities = {
    syntax: true,
    types: true,
    references: true,
    documentation: true,
  };

  private project: Project | null = null;

  /** Default maximum lines for code snippets */
  private static readonly DEFAULT_MAX_SNIPPET_LINES = 50;

  canHandle(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return (
      ext === '.ts' ||
      ext === '.tsx' ||
      ext === '.js' ||
      ext === '.jsx' ||
      ext === '.mjs' ||
      ext === '.cjs'
    );
  }

  /**
   * Get optimal concurrency level for TypeScript processing
   */
  private getOptimalConcurrency(context: string): number {
    return getOptimalConcurrency({
      context,
      systemResources: getCurrentSystemResources(),
      environmentVariables: process.env,
    });
  }

  async scan(files: string[], repoRoot: string, logger?: Logger): Promise<Document[]> {
    // Initialize project with lenient type checking enabled
    // - Allows cross-file symbol resolution for better callee extraction
    // - Keeps strict checks disabled to avoid blocking on type errors
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: false, // Enable dependency resolution for type checking
      compilerOptions: {
        allowJs: true,
        checkJs: false, // Don't type-check JS files (too noisy)
        noEmit: true,
        skipLibCheck: true, // Skip checking .d.ts files for speed
        noResolve: false, // Enable module resolution for type checking
        // Lenient type checking - don't fail on errors
        noImplicitAny: false,
        strictNullChecks: false,
        strict: false,
      },
    });

    const documents: Document[] = [];
    const errors: Array<{
      file: string;
      absolutePath: string;
      error: string;
      phase: string;
      stack?: string;
    }> = [];
    const total = files.length;
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    const startTime = Date.now();

    // Process files in parallel batches for better performance
    // Strategy: Add files to project sequentially (ts-morph state management), then extract in parallel
    // Promise.all allows the event loop to interleave CPU-bound work, providing 2-3x speedup
    const CONCURRENCY = this.getOptimalConcurrency('typescript'); // Configurable concurrency

    // Step 1: Add all files to project sequentially (required for ts-morph state management)
    const sourceFiles = new Map<string, SourceFile>();
    for (const file of files) {
      const absolutePath = path.join(repoRoot, file);
      try {
        const sourceFile = this.project.addSourceFileAtPath(absolutePath);
        if (sourceFile) {
          sourceFiles.set(file, sourceFile);
        }
      } catch (_error) {
        // File failed to add - will be handled in extraction phase
      }
    }

    // Step 2: Process files in parallel batches for extraction
    const fileEntries = Array.from(sourceFiles.entries());
    const batches: Array<[string, SourceFile][]> = [];
    for (let i = 0; i < fileEntries.length; i += CONCURRENCY) {
      batches.push(fileEntries.slice(i, i + CONCURRENCY));
    }

    // Helper to extract from a single file
    const extractFile = async (
      file: string,
      sourceFile: SourceFile
    ): Promise<{
      documents: Document[];
      error?: { file: string; absolutePath: string; error: string; phase: string; stack?: string };
    }> => {
      const absolutePath = path.join(repoRoot, file);

      try {
        const fileDocs = this.extractFromSourceFile(sourceFile, file, repoRoot);
        return { documents: fileDocs };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        return {
          documents: [],
          error: {
            file,
            absolutePath,
            error: errorMessage,
            phase: 'extractFromSourceFile',
            stack: errorStack,
          },
        };
      }
    };

    // Process batches sequentially, files within batch in parallel
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const results = await Promise.all(
        batch.map(([file, sourceFile]) => extractFile(file, sourceFile))
      );

      // Collect results
      for (const result of results) {
        processedCount++;
        if (result.error) {
          errors.push(result.error);
          failureCount++;

          // Log first 10 errors at INFO level, rest at DEBUG
          if (errors.length <= 10) {
            logger?.info(
              {
                file: result.error.file,
                absolutePath: result.error.absolutePath,
                error: result.error.error,
                phase: result.error.phase,
                errorNumber: errors.length,
              },
              `[${errors.length}] Skipped file (${result.error.phase}): ${result.error.file}`
            );
          } else {
            logger?.debug(
              { file: result.error.file, error: result.error.error, phase: result.error.phase },
              `Skipped file (${result.error.phase})`
            );
          }
        } else {
          documents.push(...result.documents);
          successCount++;
        }
      }

      // Log progress after each batch (or every 50 files)
      if (logger && (processedCount % 50 === 0 || batchIndex === batches.length - 1)) {
        const elapsed = Date.now() - startTime;
        const filesPerSecond = processedCount / (elapsed / 1000);
        const remainingFiles = total - processedCount;
        const etaSeconds = Math.ceil(remainingFiles / filesPerSecond);
        const etaMinutes = Math.floor(etaSeconds / 60);
        const etaSecondsRemainder = etaSeconds % 60;

        const etaText =
          etaMinutes > 0 ? `${etaMinutes}m ${etaSecondsRemainder}s` : `${etaSecondsRemainder}s`;

        const percent = Math.round((processedCount / total) * 100);
        logger.info(
          {
            filesProcessed: processedCount,
            total,
            percent,
            documents: documents.length,
            successCount,
            failureCount,
            batch: `${batchIndex + 1}/${batches.length}`,
            concurrency: CONCURRENCY,
            filesPerSecond: Math.round(filesPerSecond * 10) / 10,
            eta: etaText,
          },
          `typescript ${processedCount}/${total} (${percent}%) - ${documents.length} docs, ${Math.round(filesPerSecond)} files/sec, ETA: ${etaText} [batch ${batchIndex + 1}/${batches.length}]`
        );
      }
    }

    // Handle files that failed to add to project
    const failedToAdd = files.length - sourceFiles.size;
    if (failedToAdd > 0) {
      failureCount += failedToAdd;
      for (const file of files) {
        if (!sourceFiles.has(file)) {
          errors.push({
            file,
            absolutePath: path.join(repoRoot, file),
            error: 'Failed to add file to project',
            phase: 'addSourceFileAtPath',
          });
        }
      }
    }

    // Log summary with grouped error context
    if (errors.length > 0) {
      // Group errors by type for summary
      const errorsByPhase = new Map<string, number>();
      for (const err of errors) {
        errorsByPhase.set(err.phase, (errorsByPhase.get(err.phase) || 0) + 1);
      }

      const errorSummary = Array.from(errorsByPhase.entries())
        .map(([phase, count]) => `${count} ${phase}`)
        .join(', ');

      logger?.info(
        { successCount, failureCount, total, errorSummary, documentsExtracted: documents.length },
        `TypeScript scan complete: ${successCount}/${total} files processed successfully. Skipped: ${errorSummary}`
      );

      // Provide helpful suggestions for common errors
      const addSourceFileErrors = errorsByPhase.get('addSourceFileAtPath');
      if (addSourceFileErrors && addSourceFileErrors > 10) {
        logger?.info(
          'Many files failed to parse. Consider checking for syntax errors or incompatible TypeScript versions.'
        );
      }
    } else {
      logger?.info(
        { successCount, total, documentsExtracted: documents.length },
        `TypeScript scan complete: ${successCount}/${total} files processed successfully`
      );
    }

    // Partial success is acceptable - only fail if zero documents extracted
    if (errors.length > 0 && documents.length === 0) {
      throw new Error(`TypeScript scan failed: ${errors[0].error} (in ${errors[0].file})`);
    }

    return documents;
  }

  private extractFromSourceFile(
    sourceFile: SourceFile,
    relativeFile: string,
    _repoRoot: string
  ): Document[] {
    const documents: Document[] = [];

    // Extract file-level imports once (shared by all components in this file)
    let imports: string[] = [];
    try {
      imports = this.extractImports(sourceFile);
    } catch {
      // Continue with empty imports if extraction fails
    }

    // Helper to safely iterate and extract - ts-morph can throw on complex/malformed code
    const safeIterate = <T>(getter: () => T[], processor: (item: T) => void): void => {
      try {
        const items = getter();
        for (const item of items) {
          try {
            processor(item);
          } catch {
            // Skip this item if processing fails
          }
        }
      } catch {
        // Skip this category if iteration fails
      }
    };

    // Extract functions
    safeIterate(
      () => sourceFile.getFunctions(),
      (fn) => {
        const doc = this.extractFunction(fn, relativeFile, imports, sourceFile);
        if (doc) documents.push(doc);
      }
    );

    // Extract classes and their methods
    safeIterate(
      () => sourceFile.getClasses(),
      (cls) => {
        const doc = this.extractClass(cls, relativeFile, imports);
        if (doc) documents.push(doc);

        // Extract methods
        safeIterate(
          () => cls.getMethods(),
          (method) => {
            const methodDoc = this.extractMethod(
              method,
              cls.getName() || 'Anonymous',
              relativeFile,
              imports,
              sourceFile
            );
            if (methodDoc) documents.push(methodDoc);
          }
        );
      }
    );

    // Extract interfaces
    safeIterate(
      () => sourceFile.getInterfaces(),
      (iface) => {
        const doc = this.extractInterface(iface, relativeFile, imports);
        if (doc) documents.push(doc);
      }
    );

    // Extract type aliases
    safeIterate(
      () => sourceFile.getTypeAliases(),
      (typeAlias) => {
        const doc = this.extractTypeAlias(typeAlias, relativeFile, imports);
        if (doc) documents.push(doc);
      }
    );

    // Extract variables with arrow functions, function expressions, or exported constants
    safeIterate(
      () => sourceFile.getVariableStatements(),
      (varStmt) => {
        for (const decl of varStmt.getDeclarations()) {
          try {
            const initializer = decl.getInitializer();
            if (!initializer) continue;

            const kind = initializer.getKind();

            // Arrow functions and function expressions (any export status)
            if (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression) {
              const doc = this.extractVariableWithFunction(
                decl,
                varStmt,
                relativeFile,
                imports,
                sourceFile
              );
              if (doc) documents.push(doc);
            }
            // Exported constants with object/array/call expression initializers
            else if (
              varStmt.isExported() &&
              (kind === SyntaxKind.ObjectLiteralExpression ||
                kind === SyntaxKind.ArrayLiteralExpression ||
                kind === SyntaxKind.CallExpression)
            ) {
              const doc = this.extractExportedConstant(decl, varStmt, relativeFile, imports);
              if (doc) documents.push(doc);
            }
          } catch {
            // Skip this declaration if processing fails
          }
        }
      }
    );

    return documents;
  }

  /**
   * Extract import module specifiers from a source file
   * Handles: relative imports, package imports, scoped packages, node builtins
   */
  private extractImports(sourceFile: SourceFile): string[] {
    const imports: string[] = [];

    // Regular imports: import { x } from "module"
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      imports.push(moduleSpecifier);
    }

    // Re-exports: export { x } from "module"
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (moduleSpecifier) {
        imports.push(moduleSpecifier);
      }
    }

    return imports;
  }

  private extractFunction(
    fn: FunctionDeclaration,
    file: string,
    imports: string[],
    sourceFile: SourceFile
  ): Document | null {
    const name = fn.getName();
    if (!name) return null; // Skip anonymous functions

    const startLine = fn.getStartLineNumber();
    const endLine = fn.getEndLineNumber();
    const fullText = fn.getText();
    const signature = fullText.split('{')[0].trim();
    const docComment = this.getDocComment(fn);
    const isExported = fn.isExported();
    const snippet = this.truncateSnippet(fullText);
    const callees = this.extractCallees(fn, sourceFile);

    // Build text for embedding
    const text = this.buildEmbeddingText({
      type: 'function',
      name,
      signature,
      docComment,
      language: 'typescript',
    });

    return {
      id: `${file}:${name}:${startLine}`,
      text,
      type: 'function',
      language: 'typescript',
      metadata: {
        file,
        startLine,
        endLine,
        name,
        signature,
        exported: isExported,
        docstring: docComment,
        snippet,
        imports,
        callees: callees.length > 0 ? callees : undefined,
      },
    };
  }

  private extractClass(cls: ClassDeclaration, file: string, imports: string[]): Document | null {
    const name = cls.getName();
    if (!name) return null;

    const startLine = cls.getStartLineNumber();
    const endLine = cls.getEndLineNumber();
    const fullText = cls.getText();
    const docComment = this.getDocComment(cls);
    const isExported = cls.isExported();
    const snippet = this.truncateSnippet(fullText);

    // Get class signature (class name + extends + implements)
    const extendsClause = cls.getExtends()?.getText() || '';
    const implementsClause = cls
      .getImplements()
      .map((i) => i.getText())
      .join(', ');
    const signature = `class ${name}${extendsClause ? ` extends ${extendsClause}` : ''}${implementsClause ? ` implements ${implementsClause}` : ''}`;

    const text = this.buildEmbeddingText({
      type: 'class',
      name,
      signature,
      docComment,
      language: 'typescript',
    });

    return {
      id: `${file}:${name}:${startLine}`,
      text,
      type: 'class',
      language: 'typescript',
      metadata: {
        file,
        startLine,
        endLine,
        name,
        signature,
        exported: isExported,
        docstring: docComment,
        snippet,
        imports,
      },
    };
  }

  private extractMethod(
    method: MethodDeclaration,
    className: string,
    file: string,
    imports: string[],
    sourceFile: SourceFile
  ): Document | null {
    const name = method.getName();
    if (!name) return null;

    const startLine = method.getStartLineNumber();
    const endLine = method.getEndLineNumber();
    const fullText = method.getText();
    const signature = fullText.split('{')[0].trim();
    const docComment = this.getDocComment(method);
    const isPublic = !method.hasModifier(SyntaxKind.PrivateKeyword);
    const snippet = this.truncateSnippet(fullText);
    const callees = this.extractCallees(method, sourceFile);

    const text = this.buildEmbeddingText({
      type: 'method',
      name: `${className}.${name}`,
      signature,
      docComment,
      language: 'typescript',
    });

    return {
      id: `${file}:${className}.${name}:${startLine}`,
      text,
      type: 'method',
      language: 'typescript',
      metadata: {
        file,
        startLine,
        endLine,
        name: `${className}.${name}`,
        signature,
        exported: isPublic,
        docstring: docComment,
        snippet,
        imports,
        callees: callees.length > 0 ? callees : undefined,
      },
    };
  }

  private extractInterface(
    iface: InterfaceDeclaration,
    file: string,
    imports: string[]
  ): Document | null {
    const name = iface.getName();
    const startLine = iface.getStartLineNumber();
    const endLine = iface.getEndLineNumber();
    const fullText = iface.getText();
    const docComment = this.getDocComment(iface);
    const isExported = iface.isExported();
    const snippet = this.truncateSnippet(fullText);

    // Get interface signature
    const extendsClause = iface
      .getExtends()
      .map((e) => e.getText())
      .join(', ');
    const signature = `interface ${name}${extendsClause ? ` extends ${extendsClause}` : ''}`;

    const text = this.buildEmbeddingText({
      type: 'interface',
      name,
      signature,
      docComment,
      language: 'typescript',
    });

    return {
      id: `${file}:${name}:${startLine}`,
      text,
      type: 'interface',
      language: 'typescript',
      metadata: {
        file,
        startLine,
        endLine,
        name,
        signature,
        exported: isExported,
        docstring: docComment,
        snippet,
        imports,
      },
    };
  }

  private extractTypeAlias(
    typeAlias: TypeAliasDeclaration,
    file: string,
    imports: string[]
  ): Document | null {
    const name = typeAlias.getName();
    const startLine = typeAlias.getStartLineNumber();
    const endLine = typeAlias.getEndLineNumber();
    const fullText = typeAlias.getText();
    const docComment = this.getDocComment(typeAlias);
    const isExported = typeAlias.isExported();
    // For type aliases, the full text IS the signature (no body)
    const signature = fullText;
    const snippet = this.truncateSnippet(fullText);

    const text = this.buildEmbeddingText({
      type: 'type',
      name,
      signature,
      docComment,
      language: 'typescript',
    });

    return {
      id: `${file}:${name}:${startLine}`,
      text,
      type: 'type',
      language: 'typescript',
      metadata: {
        file,
        startLine,
        endLine,
        name,
        signature,
        exported: isExported,
        docstring: docComment,
        snippet,
        imports,
      },
    };
  }

  /**
   * Extract a variable declaration that is initialized with an arrow function or function expression.
   * Captures React hooks, utility functions, and other function-valued constants.
   */
  private extractVariableWithFunction(
    decl: VariableDeclaration,
    varStmt: VariableStatement,
    file: string,
    imports: string[],
    sourceFile: SourceFile
  ): Document | null {
    const name = decl.getName();
    if (!name) return null;

    const initializer = decl.getInitializer();
    if (!initializer) return null;

    const isArrowFunction = initializer.getKind() === SyntaxKind.ArrowFunction;
    const funcNode = initializer as ArrowFunction | FunctionExpression;

    const startLine = decl.getStartLineNumber();
    const endLine = decl.getEndLineNumber();
    const fullText = decl.getText();
    const docComment = this.getDocComment(varStmt);
    const isExported = varStmt.isExported();
    const snippet = this.truncateSnippet(fullText);
    const callees = this.extractCallees(funcNode, sourceFile);

    // Check if async
    const isAsync = funcNode.isAsync?.() ?? false;

    // Check if React hook (name starts with 'use' followed by uppercase)
    const isHook = /^use[A-Z]/.test(name);

    // Build signature from the variable declaration
    // e.g., "const useAuth = (options: AuthOptions) => AuthResult"
    const params = funcNode
      .getParameters()
      .map((p) => p.getText())
      .join(', ');
    const returnType = funcNode.getReturnType()?.getText() ?? '';
    const asyncPrefix = isAsync ? 'async ' : '';
    const arrowOrFunction = isArrowFunction ? '=>' : 'function';
    const signature = `const ${name} = ${asyncPrefix}(${params}) ${arrowOrFunction}${returnType ? `: ${returnType}` : ''}`;

    const text = this.buildEmbeddingText({
      type: 'variable',
      name,
      signature,
      docComment,
      language: 'typescript',
    });

    return {
      id: `${file}:${name}:${startLine}`,
      text,
      type: 'variable',
      language: 'typescript',
      metadata: {
        file,
        startLine,
        endLine,
        name,
        signature,
        exported: isExported,
        docstring: docComment,
        snippet,
        imports,
        callees: callees.length > 0 ? callees : undefined,
        isArrowFunction,
        isHook,
        isAsync,
      },
    };
  }

  /**
   * Extract an exported constant with object literal, array literal, or call expression initializer.
   * Captures configuration objects, contexts, and factory-created values.
   */
  private extractExportedConstant(
    decl: VariableDeclaration,
    varStmt: VariableStatement,
    file: string,
    imports: string[]
  ): Document | null {
    const name = decl.getName();
    if (!name) return null;

    const initializer = decl.getInitializer();
    if (!initializer) return null;

    const startLine = decl.getStartLineNumber();
    const endLine = decl.getEndLineNumber();
    const fullText = decl.getText();
    const docComment = this.getDocComment(varStmt);
    const snippet = this.truncateSnippet(fullText);

    // Determine the kind of constant for better embedding text
    const kind = initializer.getKind();
    let constantKind: 'object' | 'array' | 'value';
    if (kind === SyntaxKind.ObjectLiteralExpression) {
      constantKind = 'object';
    } else if (kind === SyntaxKind.ArrayLiteralExpression) {
      constantKind = 'array';
    } else {
      constantKind = 'value'; // Call expression or other
    }

    // Build signature
    const typeAnnotation = decl.getTypeNode()?.getText();
    const signature = typeAnnotation
      ? `export const ${name}: ${typeAnnotation}`
      : `export const ${name}`;

    const text = this.buildEmbeddingText({
      type: 'constant',
      name,
      signature,
      docComment,
      language: 'typescript',
    });

    return {
      id: `${file}:${name}:${startLine}`,
      text,
      type: 'variable',
      language: 'typescript',
      metadata: {
        file,
        startLine,
        endLine,
        name,
        signature,
        exported: true, // Always true for this method
        docstring: docComment,
        snippet,
        imports,
        isConstant: true,
        constantKind,
      },
    };
  }

  private getDocComment(node: Node): string | undefined {
    // ts-morph doesn't export getJsDocs on base Node type, but it exists on declarations
    const nodeWithJsDocs = node as unknown as {
      getJsDocs?: () => Array<{ getDescription: () => string }>;
    };
    const jsDocComments = nodeWithJsDocs.getJsDocs?.();
    if (!jsDocComments || jsDocComments.length === 0) return undefined;

    return jsDocComments[0].getDescription().trim();
  }

  private buildEmbeddingText(params: {
    type: string;
    name: string;
    signature: string;
    docComment?: string;
    language: string;
  }): string {
    const parts = [`${params.type} ${params.name}`, params.signature];

    if (params.docComment) {
      parts.push(params.docComment);
    }

    return parts.join('\n');
  }

  /**
   * Truncate code snippet to a maximum number of lines
   * Preserves complete lines and adds a truncation indicator if needed
   */
  private truncateSnippet(
    text: string,
    maxLines: number = TypeScriptScanner.DEFAULT_MAX_SNIPPET_LINES
  ): string {
    const lines = text.split('\n');

    if (lines.length <= maxLines) {
      return text;
    }

    const truncated = lines.slice(0, maxLines).join('\n');
    const remaining = lines.length - maxLines;
    return `${truncated}\n// ... ${remaining} more lines`;
  }

  /**
   * Extract callees (functions/methods called) from a node
   * Handles: function calls, method calls, constructor calls
   */
  private extractCallees(node: Node, sourceFile: SourceFile): CalleeInfo[] {
    const callees: CalleeInfo[] = [];
    const seenCalls = new Set<string>(); // Deduplicate by name+line

    try {
      // Get all call expressions within this node
      const callExpressions = node.getDescendantsOfKind(SyntaxKind.CallExpression);

      for (const callExpr of callExpressions) {
        try {
          const calleeInfo = this.extractCalleeFromExpression(callExpr, sourceFile);
          if (calleeInfo) {
            const key = `${calleeInfo.name}:${calleeInfo.line}`;
            if (!seenCalls.has(key)) {
              seenCalls.add(key);
              callees.push(calleeInfo);
            }
          }
        } catch {
          // Skip this call expression if it fails
        }
      }

      // Also handle new expressions (constructor calls)
      const newExpressions = node.getDescendantsOfKind(SyntaxKind.NewExpression);
      for (const newExpr of newExpressions) {
        try {
          const expression = newExpr.getExpression();
          const name = expression.getText();
          const line = newExpr.getStartLineNumber();
          const key = `new ${name}:${line}`;

          if (!seenCalls.has(key)) {
            seenCalls.add(key);
            callees.push({
              name: `new ${name}`,
              line,
              file: undefined, // Could resolve via type checker if needed
            });
          }
        } catch {
          // Skip this new expression if it fails
        }
      }
    } catch {
      // If callee extraction fails entirely, return empty array
      // This is better than crashing the entire scan
    }

    return callees;
  }

  /**
   * Extract callee info from a call expression
   */
  private extractCalleeFromExpression(
    callExpr: CallExpression,
    _sourceFile: SourceFile
  ): CalleeInfo | null {
    const expression = callExpr.getExpression();
    const line = callExpr.getStartLineNumber();

    // Handle different call patterns:
    // 1. Simple call: foo()
    // 2. Method call: obj.method()
    // 3. Chained call: a.b.c()
    // 4. Computed property: obj[key]()

    const expressionText = expression.getText();

    // Skip very complex expressions (e.g., IIFEs, callbacks)
    if (expressionText.includes('(') || expressionText.includes('=>')) {
      return null;
    }

    // Try to resolve the definition file
    let file: string | undefined;
    try {
      // Get the symbol and find its declaration
      // Note: getSymbol() can throw internally when accessing escapedName on undefined nodes
      const symbol = expression.getSymbol();
      if (symbol) {
        const declarations = symbol.getDeclarations();
        if (declarations && declarations.length > 0) {
          const firstDecl = declarations[0];
          if (firstDecl) {
            const declSourceFile = firstDecl.getSourceFile();
            if (declSourceFile) {
              const filePath = declSourceFile.getFilePath();
              // Only include if it's within the project (not node_modules)
              if (filePath && !filePath.includes('node_modules')) {
                file = filePath;
              }
            }
          }
        }
      }
    } catch {
      // Symbol resolution can fail for various reasons, continue without file
    }

    return {
      name: expressionText,
      line,
      file,
    };
  }
}
