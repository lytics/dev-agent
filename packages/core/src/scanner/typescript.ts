import * as path from 'node:path';
import {
  type CallExpression,
  type ClassDeclaration,
  type FunctionDeclaration,
  type InterfaceDeclaration,
  type MethodDeclaration,
  type Node,
  Project,
  type SourceFile,
  SyntaxKind,
  type TypeAliasDeclaration,
} from 'ts-morph';
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

  async scan(files: string[], repoRoot: string): Promise<Document[]> {
    // Initialize project
    this.project = new Project({
      tsConfigFilePath: path.join(repoRoot, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });

    // Add files to project
    const absoluteFiles = files.map((f) => path.join(repoRoot, f));
    this.project.addSourceFilesAtPaths(absoluteFiles);

    const documents: Document[] = [];

    // Extract documents from each file
    for (const file of files) {
      const absolutePath = path.join(repoRoot, file);
      const sourceFile = this.project.getSourceFile(absolutePath);

      if (!sourceFile) continue;

      documents.push(...this.extractFromSourceFile(sourceFile, file, repoRoot));
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
    const imports = this.extractImports(sourceFile);

    // Extract functions
    for (const fn of sourceFile.getFunctions()) {
      const doc = this.extractFunction(fn, relativeFile, imports, sourceFile);
      if (doc) documents.push(doc);
    }

    // Extract classes
    for (const cls of sourceFile.getClasses()) {
      const doc = this.extractClass(cls, relativeFile, imports);
      if (doc) documents.push(doc);

      // Extract methods
      for (const method of cls.getMethods()) {
        const methodDoc = this.extractMethod(
          method,
          cls.getName() || 'Anonymous',
          relativeFile,
          imports,
          sourceFile
        );
        if (methodDoc) documents.push(methodDoc);
      }
    }

    // Extract interfaces
    for (const iface of sourceFile.getInterfaces()) {
      const doc = this.extractInterface(iface, relativeFile, imports);
      if (doc) documents.push(doc);
    }

    // Extract type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      const doc = this.extractTypeAlias(typeAlias, relativeFile, imports);
      if (doc) documents.push(doc);
    }

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

    // Get all call expressions within this node
    const callExpressions = node.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      const calleeInfo = this.extractCalleeFromExpression(callExpr, sourceFile);
      if (calleeInfo) {
        const key = `${calleeInfo.name}:${calleeInfo.line}`;
        if (!seenCalls.has(key)) {
          seenCalls.add(key);
          callees.push(calleeInfo);
        }
      }
    }

    // Also handle new expressions (constructor calls)
    const newExpressions = node.getDescendantsOfKind(SyntaxKind.NewExpression);
    for (const newExpr of newExpressions) {
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
      const symbol = expression.getSymbol();
      if (symbol) {
        const declarations = symbol.getDeclarations();
        if (declarations.length > 0) {
          const declSourceFile = declarations[0].getSourceFile();
          const filePath = declSourceFile.getFilePath();
          // Only include if it's within the project (not node_modules)
          if (!filePath.includes('node_modules')) {
            file = filePath;
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
