import * as path from 'node:path';
import {
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
import type { Document, Scanner, ScannerCapabilities } from './types';

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

    // Extract functions
    for (const fn of sourceFile.getFunctions()) {
      const doc = this.extractFunction(fn, relativeFile);
      if (doc) documents.push(doc);
    }

    // Extract classes
    for (const cls of sourceFile.getClasses()) {
      const doc = this.extractClass(cls, relativeFile);
      if (doc) documents.push(doc);

      // Extract methods
      for (const method of cls.getMethods()) {
        const methodDoc = this.extractMethod(method, cls.getName() || 'Anonymous', relativeFile);
        if (methodDoc) documents.push(methodDoc);
      }
    }

    // Extract interfaces
    for (const iface of sourceFile.getInterfaces()) {
      const doc = this.extractInterface(iface, relativeFile);
      if (doc) documents.push(doc);
    }

    // Extract type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      const doc = this.extractTypeAlias(typeAlias, relativeFile);
      if (doc) documents.push(doc);
    }

    return documents;
  }

  private extractFunction(fn: FunctionDeclaration, file: string): Document | null {
    const name = fn.getName();
    if (!name) return null; // Skip anonymous functions

    const startLine = fn.getStartLineNumber();
    const endLine = fn.getEndLineNumber();
    const signature = fn.getText().split('{')[0].trim();
    const docComment = this.getDocComment(fn);
    const isExported = fn.isExported();

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
      },
    };
  }

  private extractClass(cls: ClassDeclaration, file: string): Document | null {
    const name = cls.getName();
    if (!name) return null;

    const startLine = cls.getStartLineNumber();
    const endLine = cls.getEndLineNumber();
    const docComment = this.getDocComment(cls);
    const isExported = cls.isExported();

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
      },
    };
  }

  private extractMethod(
    method: MethodDeclaration,
    className: string,
    file: string
  ): Document | null {
    const name = method.getName();
    if (!name) return null;

    const startLine = method.getStartLineNumber();
    const endLine = method.getEndLineNumber();
    const signature = method.getText().split('{')[0].trim();
    const docComment = this.getDocComment(method);
    const isPublic = !method.hasModifier(SyntaxKind.PrivateKeyword);

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
      },
    };
  }

  private extractInterface(iface: InterfaceDeclaration, file: string): Document | null {
    const name = iface.getName();
    const startLine = iface.getStartLineNumber();
    const endLine = iface.getEndLineNumber();
    const docComment = this.getDocComment(iface);
    const isExported = iface.isExported();

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
      },
    };
  }

  private extractTypeAlias(typeAlias: TypeAliasDeclaration, file: string): Document | null {
    const name = typeAlias.getName();
    const startLine = typeAlias.getStartLineNumber();
    const endLine = typeAlias.getEndLineNumber();
    const docComment = this.getDocComment(typeAlias);
    const isExported = typeAlias.isExported();
    const signature = typeAlias.getText();

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
}
