/**
 * Tests for relationship building utilities
 */

import type { SearchResult } from '@lytics/dev-agent-core';
import { describe, expect, it } from 'vitest';
import type { CodeRelationship } from '../types';
import { createRelationship, isDuplicateRelationship } from './relationships';

describe('Relationship Utilities', () => {
  const mockSearchResult: SearchResult = {
    id: 'doc1',
    score: 0.9,
    metadata: {
      path: '/src/components/button.ts',
      type: 'function',
      language: 'typescript',
      name: 'createButton',
      startLine: 10,
      endLine: 50,
    },
  };

  describe('createRelationship', () => {
    it('should create a correct CodeRelationship object', () => {
      const relationship = createRelationship(mockSearchResult, 'MyComponent', 'uses');
      expect(relationship).toEqual({
        from: '/src/components/button.ts',
        to: 'MyComponent',
        type: 'uses',
        location: { file: '/src/components/button.ts', line: 10 },
      });
    });

    it('should handle missing startLine', () => {
      const resultWithoutLine: SearchResult = {
        ...mockSearchResult,
        metadata: { ...mockSearchResult.metadata, startLine: undefined },
      };
      const relationship = createRelationship(resultWithoutLine, 'MyComponent', 'uses');
      expect(relationship.location.line).toBe(0);
    });

    it('should create import relationships', () => {
      const relationship = createRelationship(mockSearchResult, 'UserService', 'imports');
      expect(relationship.type).toBe('imports');
      expect(relationship.to).toBe('UserService');
    });

    it('should create export relationships', () => {
      const relationship = createRelationship(mockSearchResult, 'Button', 'exports');
      expect(relationship.type).toBe('exports');
      expect(relationship.to).toBe('Button');
    });

    it('should create dependency relationships', () => {
      const relationship = createRelationship(mockSearchResult, 'react', 'dependencies');
      expect(relationship.type).toBe('dependencies');
      expect(relationship.to).toBe('react');
    });

    it('should preserve metadata in location', () => {
      const result: SearchResult = {
        id: 'doc-test',
        score: 0.85,
        metadata: {
          path: '/src/services/auth.ts',
          type: 'class',
          language: 'typescript',
          name: 'AuthService',
          startLine: 42,
          endLine: 100,
        },
      };

      const relationship = createRelationship(result, 'TokenService', 'uses');
      expect(relationship.location).toEqual({
        file: '/src/services/auth.ts',
        line: 42,
      });
    });

    it('should handle different component name formats', () => {
      const componentNames = ['UserService', 'user-service', 'user_service', 'UserServiceImpl'];

      const relationships = componentNames.map((name) =>
        createRelationship(mockSearchResult, name, 'uses')
      );

      for (const [index, rel] of relationships.entries()) {
        expect(rel.to).toBe(componentNames[index]);
      }
    });
  });

  describe('isDuplicateRelationship', () => {
    const relationships: CodeRelationship[] = [
      {
        from: '/src/app.ts',
        to: 'Button',
        type: 'imports',
        location: { file: '/src/app.ts', line: 5 },
      },
      {
        from: '/src/app.ts',
        to: 'Input',
        type: 'imports',
        location: { file: '/src/app.ts', line: 10 },
      },
    ];

    it('should return true for a duplicate relationship', () => {
      expect(isDuplicateRelationship(relationships, '/src/app.ts', 5)).toBe(true);
    });

    it('should return false for a non-duplicate relationship (different file)', () => {
      expect(isDuplicateRelationship(relationships, '/src/main.ts', 5)).toBe(false);
    });

    it('should return false for a non-duplicate relationship (different line)', () => {
      expect(isDuplicateRelationship(relationships, '/src/app.ts', 15)).toBe(false);
    });

    it('should handle empty relationships array', () => {
      expect(isDuplicateRelationship([], '/src/app.ts', 5)).toBe(false);
    });

    it('should check multiple relationships correctly', () => {
      expect(isDuplicateRelationship(relationships, '/src/app.ts', 10)).toBe(true);
      expect(isDuplicateRelationship(relationships, '/src/app.ts', 20)).toBe(false);
    });

    it('should prevent duplicate entries when building relationships', () => {
      const newRels: CodeRelationship[] = [];
      const testData = [
        { file: '/src/a.ts', line: 1 },
        { file: '/src/a.ts', line: 1 }, // Duplicate
        { file: '/src/b.ts', line: 2 },
        { file: '/src/a.ts', line: 3 },
      ];

      for (const data of testData) {
        if (!isDuplicateRelationship(newRels, data.file, data.line)) {
          newRels.push({
            from: data.file,
            to: 'Component',
            type: 'uses',
            location: { file: data.file, line: data.line },
          });
        }
      }

      expect(newRels).toHaveLength(3);
      expect(newRels.filter((r) => r.location.file === '/src/a.ts')).toHaveLength(2);
    });

    it('should be case-sensitive for file paths', () => {
      expect(isDuplicateRelationship(relationships, '/src/App.ts', 5)).toBe(false);
      expect(isDuplicateRelationship(relationships, '/SRC/app.ts', 5)).toBe(false);
    });

    it('should handle line number 0', () => {
      const relsWithZero: CodeRelationship[] = [
        {
          from: '/src/index.ts',
          to: 'Module',
          type: 'exports',
          location: { file: '/src/index.ts', line: 0 },
        },
      ];

      expect(isDuplicateRelationship(relsWithZero, '/src/index.ts', 0)).toBe(true);
      expect(isDuplicateRelationship(relsWithZero, '/src/index.ts', 1)).toBe(false);
    });
  });

  describe('Integration with createRelationship', () => {
    it('should work together to build unique relationship lists', () => {
      const results: SearchResult[] = [
        {
          id: 'doc1',
          score: 0.9,
          metadata: {
            path: '/src/auth.ts',
            type: 'import',
            language: 'typescript',
            name: 'import',
            startLine: 5,
          },
        },
        {
          id: 'doc2',
          score: 0.85,
          metadata: {
            path: '/src/auth.ts',
            type: 'usage',
            language: 'typescript',
            name: 'usage',
            startLine: 5, // Same location as first
          },
        },
        {
          id: 'doc3',
          score: 0.8,
          metadata: {
            path: '/src/user.ts',
            type: 'usage',
            language: 'typescript',
            name: 'usage',
            startLine: 20,
          },
        },
      ];

      const relationships: CodeRelationship[] = [];

      for (const result of results) {
        const metadata = result.metadata as {
          path: string;
          startLine?: number;
        };
        if (!isDuplicateRelationship(relationships, metadata.path, metadata.startLine || 0)) {
          relationships.push(createRelationship(result, 'UserService', 'uses'));
        }
      }

      expect(relationships).toHaveLength(2);
      expect(relationships[0].location).toEqual({ file: '/src/auth.ts', line: 5 });
      expect(relationships[1].location).toEqual({ file: '/src/user.ts', line: 20 });
    });
  });
});
