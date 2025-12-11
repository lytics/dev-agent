import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Logger } from '@lytics/kero';
import type { Code, Heading, Paragraph, Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Document, Scanner, ScannerCapabilities } from './types';

/**
 * Markdown scanner using remark
 * Extracts documentation sections and code blocks
 */
export class MarkdownScanner implements Scanner {
  readonly language = 'markdown';
  readonly capabilities: ScannerCapabilities = {
    syntax: true,
    documentation: true,
  };

  canHandle(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md' || ext === '.mdx';
  }

  async scan(files: string[], repoRoot: string, _logger?: Logger): Promise<Document[]> {
    const documents: Document[] = [];

    for (const file of files) {
      const absolutePath = path.join(repoRoot, file);
      const content = await fs.readFile(absolutePath, 'utf-8');

      const fileDocs = await this.extractFromMarkdown(content, file);
      documents.push(...fileDocs);
    }

    return documents;
  }

  private async extractFromMarkdown(content: string, file: string): Promise<Document[]> {
    const documents: Document[] = [];

    // Parse markdown
    const processor = unified().use(remarkParse);
    const tree = processor.parse(content) as Root;

    let currentHeading: string | null = null;
    let _currentLevel = 0;
    let currentContent: string[] = [];
    let currentStartLine = 1;

    // Walk the AST
    for (const node of tree.children) {
      if (node.type === 'heading') {
        // Save previous section if exists
        if (currentHeading && currentContent.length > 0) {
          documents.push(
            this.createDocument({
              file,
              heading: currentHeading,
              content: currentContent.join('\n\n'),
              startLine: currentStartLine,
              endLine: node.position?.start.line || currentStartLine,
            })
          );
        }

        // Start new section
        const headingNode = node as Heading;
        currentHeading = this.extractTextFromNode(headingNode);
        _currentLevel = headingNode.depth;
        currentContent = [];
        currentStartLine = node.position?.start.line || 1;
      } else if (node.type === 'paragraph') {
        const paragraphNode = node as Paragraph;
        const text = this.extractTextFromNode(paragraphNode);
        currentContent.push(text);
      } else if (node.type === 'code') {
        const codeNode = node as Code;
        currentContent.push(`\`\`\`${codeNode.lang || ''}\n${codeNode.value}\n\`\`\``);
      }
    }

    // Save last section
    if (currentHeading && currentContent.length > 0) {
      documents.push(
        this.createDocument({
          file,
          heading: currentHeading,
          content: currentContent.join('\n\n'),
          startLine: currentStartLine,
          endLine: content.split('\n').length,
        })
      );
    }

    return documents;
  }

  private extractTextFromNode(node: unknown): string {
    const n = node as { value?: string; children?: unknown[] };
    if (typeof n.value === 'string') {
      return n.value;
    }

    if (Array.isArray(n.children)) {
      return n.children.map((child) => this.extractTextFromNode(child)).join('');
    }

    return '';
  }

  private createDocument(params: {
    file: string;
    heading: string;
    content: string;
    startLine: number;
    endLine: number;
  }): Document {
    const { file, heading, content, startLine, endLine } = params;

    // Build text for embedding
    const text = `${heading}\n\n${content}`;

    // Create clean ID
    const id = `${file}:${this.slugify(heading)}:${startLine}`;

    return {
      id,
      text,
      type: 'documentation',
      language: 'markdown',
      metadata: {
        file,
        startLine,
        endLine,
        name: heading,
        exported: true,
        docstring: content.substring(0, 200), // First 200 chars as summary
      },
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
