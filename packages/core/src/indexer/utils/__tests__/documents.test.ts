/**
 * Tests for document preparation utilities
 */

import { describe, expect, it } from 'vitest';
import type { Document } from '../../../scanner/types';
import {
  filterDocumentsByExport,
  filterDocumentsByLanguage,
  filterDocumentsByType,
  prepareDocumentForEmbedding,
  prepareDocumentsForEmbedding,
} from '../documents';

describe('Document Preparation Utilities', () => {
  const mockDocuments: Document[] = [
    {
      id: 'doc1',
      type: 'function',
      language: 'typescript',
      text: 'function calculateTotal(items) { return items.reduce(...); }',
      metadata: {
        file: '/src/utils.ts',
        name: 'calculateTotal',
        startLine: 10,
        endLine: 12,
        exported: true,
        signature: 'calculateTotal(items: Item[]): number',
        docstring: 'Calculate total price from items',
      },
    },
    {
      id: 'doc2',
      type: 'class',
      language: 'typescript',
      text: 'class User { constructor(name: string) {} }',
      metadata: {
        file: '/src/models.ts',
        name: 'User',
        startLine: 5,
        endLine: 20,
        exported: true,
      },
    },
    {
      id: 'doc3',
      type: 'function',
      language: 'javascript',
      text: 'function helper() { return 42; }',
      metadata: {
        file: '/src/helper.js',
        name: 'helper',
        startLine: 1,
        endLine: 3,
        exported: false,
      },
    },
  ];

  describe('prepareDocumentsForEmbedding', () => {
    it('should transform documents to embedding documents', () => {
      const result = prepareDocumentsForEmbedding(mockDocuments);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('doc1');
      expect(result[0].text).toContain('function: calculateTotal');
      expect(result[0].text).toContain('function calculateTotal');
    });

    it('should format document text properly', () => {
      const result = prepareDocumentsForEmbedding([mockDocuments[0]]);

      expect(result[0].text).toContain('function: calculateTotal');
      expect(result[0].text).toContain('function calculateTotal(items)');
    });

    it('should transform metadata correctly', () => {
      const result = prepareDocumentsForEmbedding([mockDocuments[0]]);
      const metadata = result[0].metadata;

      expect(metadata.path).toBe('/src/utils.ts');
      expect(metadata.type).toBe('function');
      expect(metadata.language).toBe('typescript');
      expect(metadata.name).toBe('calculateTotal');
      expect(metadata.startLine).toBe(10);
      expect(metadata.endLine).toBe(12);
      expect(metadata.exported).toBe(true);
      expect(metadata.signature).toBe('calculateTotal(items: Item[]): number');
      expect(metadata.docstring).toBe('Calculate total price from items');
    });

    it('should handle documents without optional metadata', () => {
      const doc: Document = {
        id: 'doc-minimal',
        type: 'class',
        language: 'typescript',
        text: 'class Simple {}',
        metadata: {
          file: '/src/simple.ts',
          name: 'Simple',
          startLine: 1,
          endLine: 1,
          exported: false,
        },
      };

      const result = prepareDocumentsForEmbedding([doc]);

      expect(result[0].metadata.signature).toBeUndefined();
      expect(result[0].metadata.docstring).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = prepareDocumentsForEmbedding([]);
      expect(result).toEqual([]);
    });

    it('should preserve document order', () => {
      const result = prepareDocumentsForEmbedding(mockDocuments);

      expect(result[0].id).toBe('doc1');
      expect(result[1].id).toBe('doc2');
      expect(result[2].id).toBe('doc3');
    });
  });

  describe('prepareDocumentForEmbedding', () => {
    it('should transform single document', () => {
      const result = prepareDocumentForEmbedding(mockDocuments[0]);

      expect(result.id).toBe('doc1');
      expect(result.text).toContain('function: calculateTotal');
      expect(result.metadata.path).toBe('/src/utils.ts');
    });

    it('should format text correctly', () => {
      const result = prepareDocumentForEmbedding(mockDocuments[1]);

      expect(result.text).toContain('class: User');
      expect(result.text).toContain('class User');
    });

    it('should handle document without signature', () => {
      const result = prepareDocumentForEmbedding(mockDocuments[2]);

      expect(result.metadata.signature).toBeUndefined();
    });
  });

  describe('filterDocumentsByExport', () => {
    it('should filter exported documents', () => {
      const result = filterDocumentsByExport(mockDocuments, true);

      expect(result).toHaveLength(2);
      expect(result.every((doc) => doc.metadata.exported)).toBe(true);
    });

    it('should filter non-exported documents', () => {
      const result = filterDocumentsByExport(mockDocuments, false);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc3');
      expect(result[0].metadata.exported).toBe(false);
    });

    it('should handle empty array', () => {
      const result = filterDocumentsByExport([], true);
      expect(result).toEqual([]);
    });

    it('should return empty array when no matches', () => {
      const allExported = mockDocuments.filter((doc) => doc.metadata.exported);
      const result = filterDocumentsByExport(allExported, false);

      expect(result).toEqual([]);
    });
  });

  describe('filterDocumentsByType', () => {
    it('should filter by single type', () => {
      const result = filterDocumentsByType(mockDocuments, ['function']);

      expect(result).toHaveLength(2);
      expect(result.every((doc) => doc.type === 'function')).toBe(true);
    });

    it('should filter by multiple types', () => {
      const result = filterDocumentsByType(mockDocuments, ['function', 'class']);

      expect(result).toHaveLength(3);
    });

    it('should return empty array for non-matching types', () => {
      const result = filterDocumentsByType(mockDocuments, ['interface', 'type']);

      expect(result).toEqual([]);
    });

    it('should handle empty type array', () => {
      const result = filterDocumentsByType(mockDocuments, []);

      expect(result).toEqual([]);
    });

    it('should handle empty document array', () => {
      const result = filterDocumentsByType([], ['function']);

      expect(result).toEqual([]);
    });

    it('should be case-sensitive', () => {
      const result = filterDocumentsByType(mockDocuments, ['Function']);

      expect(result).toEqual([]);
    });
  });

  describe('filterDocumentsByLanguage', () => {
    it('should filter by single language', () => {
      const result = filterDocumentsByLanguage(mockDocuments, ['typescript']);

      expect(result).toHaveLength(2);
      expect(result.every((doc) => doc.language === 'typescript')).toBe(true);
    });

    it('should filter by multiple languages', () => {
      const result = filterDocumentsByLanguage(mockDocuments, ['typescript', 'javascript']);

      expect(result).toHaveLength(3);
    });

    it('should be case-insensitive', () => {
      const result = filterDocumentsByLanguage(mockDocuments, ['TypeScript', 'JavaScript']);

      expect(result).toHaveLength(3);
    });

    it('should return empty array for non-matching languages', () => {
      const result = filterDocumentsByLanguage(mockDocuments, ['python', 'go']);

      expect(result).toEqual([]);
    });

    it('should handle empty language array', () => {
      const result = filterDocumentsByLanguage(mockDocuments, []);

      expect(result).toEqual([]);
    });

    it('should handle empty document array', () => {
      const result = filterDocumentsByLanguage([], ['typescript']);

      expect(result).toEqual([]);
    });
  });

  describe('Integration scenarios', () => {
    it('should filter and prepare documents', () => {
      const exported = filterDocumentsByExport(mockDocuments, true);
      const prepared = prepareDocumentsForEmbedding(exported);

      expect(prepared).toHaveLength(2);
      expect(prepared.every((doc) => doc.metadata.exported)).toBe(true);
    });

    it('should chain multiple filters', () => {
      const typescript = filterDocumentsByLanguage(mockDocuments, ['typescript']);
      const functions = filterDocumentsByType(typescript, ['function']);
      const exported = filterDocumentsByExport(functions, true);

      expect(exported).toHaveLength(1);
      expect(exported[0].id).toBe('doc1');
    });

    it('should prepare filtered documents', () => {
      const functions = filterDocumentsByType(mockDocuments, ['function']);
      const prepared = prepareDocumentsForEmbedding(functions);

      expect(prepared).toHaveLength(2);
      expect(prepared.every((doc) => doc.metadata.type === 'function')).toBe(true);
    });

    it('should handle complex filtering pipeline', () => {
      // Get public TypeScript functions
      const typescript = filterDocumentsByLanguage(mockDocuments, ['typescript']);
      const exported = filterDocumentsByExport(typescript, true);
      const functions = filterDocumentsByType(exported, ['function']);
      const prepared = prepareDocumentsForEmbedding(functions);

      expect(prepared).toHaveLength(1);
      expect(prepared[0].id).toBe('doc1');
      expect(prepared[0].metadata.language).toBe('typescript');
      expect(prepared[0].metadata.exported).toBe(true);
      expect(prepared[0].metadata.type).toBe('function');
    });
  });
});
