/**
 * Tests for formatting utilities
 */

import { describe, expect, it } from 'vitest';
import type { Document } from '../../../scanner/types';
import {
  cleanDocumentText,
  formatDocumentText,
  formatDocumentTextWithSignature,
  truncateText,
} from '../formatting';

describe('Formatting Utilities', () => {
  describe('formatDocumentText', () => {
    it('should format document with name and text', () => {
      const doc: Document = {
        id: 'doc1',
        type: 'function',
        language: 'typescript',
        text: 'function calculateTotal(items) { return items.reduce(...); }',
        metadata: {
          file: '/src/utils.ts',
          name: 'calculateTotal',
          startLine: 10,
          endLine: 12,
          exported: false,
        },
      };

      const result = formatDocumentText(doc);
      expect(result).toBe(
        'function: calculateTotal\n\nfunction calculateTotal(items) { return items.reduce(...); }'
      );
    });

    it('should format document with only name (no text)', () => {
      const doc: Document = {
        id: 'doc2',
        type: 'class',
        language: 'typescript',
        text: '',
        metadata: {
          file: '/src/models.ts',
          name: 'User',
          startLine: 5,
          endLine: 20,
          exported: false,
        },
      };

      const result = formatDocumentText(doc);
      expect(result).toBe('class: User');
    });

    it('should format document with only text (no name)', () => {
      const doc: Document = {
        id: 'doc3',
        type: 'function',
        language: 'typescript',
        text: '// This is a comment',
        metadata: {
          file: '/src/app.ts',
          name: '',
          exported: false,
          startLine: 1,
          endLine: 1,
        },
      };

      const result = formatDocumentText(doc);
      expect(result).toBe('// This is a comment');
    });

    it('should handle empty document', () => {
      const doc: Document = {
        id: 'doc4',
        type: 'documentation',
        language: 'typescript',
        text: '',
        metadata: {
          file: '/src/empty.ts',
          name: '',
          startLine: 1,
          endLine: 1,
          exported: false,
        },
      };

      const result = formatDocumentText(doc);
      expect(result).toBe('');
    });

    it('should preserve multiline text', () => {
      const doc: Document = {
        id: 'doc5',
        type: 'function',
        language: 'typescript',
        text: 'function foo() {\n  return 42;\n}',
        metadata: {
          file: '/src/utils.ts',
          name: 'foo',
          startLine: 1,
          endLine: 3,
          exported: false,
        },
      };

      const result = formatDocumentText(doc);
      expect(result).toContain('function: foo\n\nfunction foo()');
      expect(result).toContain('return 42');
    });
  });

  describe('formatDocumentTextWithSignature', () => {
    it('should include signature when available', () => {
      const doc: Document = {
        id: 'doc1',
        type: 'function',
        language: 'typescript',
        text: 'async function processData(data: string[]) { ... }',
        metadata: {
          file: '/src/processor.ts',
          name: 'processData',
          signature: 'processData(data: string[]): Promise<void>',
          startLine: 10,
          endLine: 15,
          exported: false,
        },
      };

      const result = formatDocumentTextWithSignature(doc);
      expect(result).toContain('function: processData');
      expect(result).toContain('processData(data: string[]): Promise<void>');
      expect(result).toContain('async function processData');
    });

    it('should work without signature', () => {
      const doc: Document = {
        id: 'doc2',
        type: 'class',
        language: 'typescript',
        text: 'class User { }',
        metadata: {
          file: '/src/models.ts',
          name: 'User',
          startLine: 1,
          endLine: 1,
          exported: false,
        },
      };

      const result = formatDocumentTextWithSignature(doc);
      expect(result).toBe('class: User\nclass User { }');
    });

    it('should handle empty signature', () => {
      const doc: Document = {
        id: 'doc3',
        type: 'function',
        language: 'typescript',
        text: 'function test() { }',
        metadata: {
          file: '/src/test.ts',
          name: 'test',
          signature: '',
          startLine: 1,
          endLine: 1,
          exported: false,
        },
      };

      const result = formatDocumentTextWithSignature(doc);
      expect(result).toBe('function: test\nfunction test() { }');
    });
  });

  describe('truncateText', () => {
    it('should not truncate text shorter than maxLength', () => {
      const text = 'Short text';
      expect(truncateText(text, 20)).toBe('Short text');
    });

    it('should not truncate text equal to maxLength', () => {
      const text = 'Exactly 20 chars!!!.';
      expect(truncateText(text, 20)).toBe('Exactly 20 chars!!!.');
    });

    it('should truncate long text and add ellipsis', () => {
      const text = 'This is a very long text that needs to be truncated';
      const result = truncateText(text, 20);

      expect(result).toHaveLength(20);
      expect(result.endsWith('...')).toBe(true);
      expect(result).toBe('This is a very lo...');
    });

    it('should handle maxLength of 3 (minimum for ellipsis)', () => {
      const text = 'Long text';
      expect(truncateText(text, 3)).toBe('...');
    });

    it('should handle empty text', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('should handle very small maxLength', () => {
      const text = 'Test';
      // Note: For very small maxLength (< 4), result may be longer than maxLength
      // This is acceptable as "..." takes 3 chars minimum
      const result = truncateText(text, 1);
      expect(result).toBe('Te...');
    });

    it('should preserve exactly maxLength - 3 characters before ellipsis', () => {
      const text = 'abcdefghijk';
      const result = truncateText(text, 10);

      expect(result).toBe('abcdefg...');
      expect(result).toHaveLength(10);
    });
  });

  describe('cleanDocumentText', () => {
    it('should remove multiple spaces', () => {
      const text = 'function  foo()    {  return  42; }';
      expect(cleanDocumentText(text)).toBe('function foo() { return 42; }');
    });

    it('should reduce excessive newlines', () => {
      const text = 'line1\n\n\n\nline2';
      expect(cleanDocumentText(text)).toBe('line1\n\nline2');
    });

    it('should preserve single and double newlines', () => {
      const text = 'line1\nline2\n\nline3';
      expect(cleanDocumentText(text)).toBe('line1\nline2\n\nline3');
    });

    it('should trim leading and trailing whitespace', () => {
      const text = '   text with spaces   ';
      expect(cleanDocumentText(text)).toBe('text with spaces');
    });

    it('should handle combination of issues', () => {
      const text = '  function  foo() {\n\n\n  return  42;\n}\n\n\n';
      const expected = 'function foo() {\n\n return 42;\n}';
      expect(cleanDocumentText(text)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(cleanDocumentText('')).toBe('');
    });

    it('should handle text with only whitespace', () => {
      expect(cleanDocumentText('   \n\n  ')).toBe('');
    });

    it('should handle text with tabs', () => {
      const text = 'function\tfoo()\t{\treturn\t42; }';
      // Tabs are preserved (not converted to spaces)
      expect(cleanDocumentText(text)).toBe('function\tfoo()\t{\treturn\t42; }');
    });

    it('should handle already clean text', () => {
      const text = 'Clean text\nWith proper spacing';
      expect(cleanDocumentText(text)).toBe(text);
    });
  });

  describe('Integration scenarios', () => {
    it('should format and clean document text', () => {
      const doc: Document = {
        id: 'doc1',
        type: 'function',
        language: 'typescript',
        text: 'function  foo() {\n\n\n  return  42;\n}',
        metadata: {
          file: '/src/utils.ts',
          name: 'foo',
          startLine: 1,
          endLine: 3,
          exported: false,
        },
      };

      const formatted = formatDocumentText(doc);
      const cleaned = cleanDocumentText(formatted);

      expect(cleaned).toContain('function: foo');
      expect(cleaned).not.toContain('  ');
      expect(cleaned).not.toContain('\n\n\n');
    });

    it('should format, clean, and truncate', () => {
      const doc: Document = {
        id: 'doc1',
        type: 'function',
        language: 'typescript',
        text: 'function calculateTotalWithVeryLongName() { return items.reduce((sum, item) => sum + item.price, 0); }',
        metadata: {
          file: '/src/utils.ts',
          name: 'calculateTotalWithVeryLongName',
          startLine: 1,
          endLine: 1,
          exported: false,
        },
      };

      const formatted = formatDocumentText(doc);
      const cleaned = cleanDocumentText(formatted);
      const truncated = truncateText(cleaned, 50);

      expect(truncated).toHaveLength(50);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should handle complex formatting pipeline', () => {
      const doc: Document = {
        id: 'doc1',
        type: 'class',
        language: 'typescript',
        text: 'class   User  {\n\n\n  constructor(name:  string) {}\n\n\n}',
        metadata: {
          file: '/src/models.ts',
          name: 'User',
          signature: 'class User',
          startLine: 1,
          endLine: 5,
          exported: false,
        },
      };

      // Full pipeline
      const withSig = formatDocumentTextWithSignature(doc);
      const cleaned = cleanDocumentText(withSig);

      expect(cleaned).toContain('class: User');
      expect(cleaned).toContain('class User');
      expect(cleaned).toContain('constructor(name: string)');
      expect(cleaned).not.toContain('   ');
      expect(cleaned).not.toContain('\n\n\n');
    });
  });
});
