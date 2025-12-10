import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { GoScanner } from '../go';
import type { Document } from '../types';

describe('GoScanner', () => {
  const scanner = new GoScanner();
  const fixturesDir = path.join(__dirname, 'fixtures', 'go');

  describe('canHandle', () => {
    it('should handle .go files', () => {
      expect(scanner.canHandle('main.go')).toBe(true);
      expect(scanner.canHandle('server.go')).toBe(true);
      expect(scanner.canHandle('path/to/file.go')).toBe(true);
    });

    it('should not handle non-Go files', () => {
      expect(scanner.canHandle('main.ts')).toBe(false);
      expect(scanner.canHandle('main.py')).toBe(false);
      expect(scanner.canHandle('main.go.bak')).toBe(false);
      expect(scanner.canHandle('README.md')).toBe(false);
    });

    it('should handle case-insensitive extensions', () => {
      expect(scanner.canHandle('main.GO')).toBe(true);
      expect(scanner.canHandle('main.Go')).toBe(true);
    });
  });

  describe('capabilities', () => {
    it('should have correct language', () => {
      expect(scanner.language).toBe('go');
    });

    it('should report syntax capability', () => {
      expect(scanner.capabilities.syntax).toBe(true);
    });

    it('should report types capability', () => {
      expect(scanner.capabilities.types).toBe(true);
    });

    it('should report documentation capability', () => {
      expect(scanner.capabilities.documentation).toBe(true);
    });
  });

  describe('scan', () => {
    let simpleDocuments: Document[];
    let methodsDocuments: Document[];
    let testDocuments: Document[];

    beforeAll(async () => {
      // Scan the simple.go fixture
      simpleDocuments = await scanner.scan(['simple.go'], fixturesDir);

      // Scan the methods.go fixture
      methodsDocuments = await scanner.scan(['methods.go'], fixturesDir);

      // Scan the test file fixture
      testDocuments = await scanner.scan(['simple_test.go'], fixturesDir);
    });

    describe('functions', () => {
      it('should extract exported functions', () => {
        const newServer = simpleDocuments.find(
          (d) => d.metadata.name === 'NewServer' && d.type === 'function'
        );
        expect(newServer).toBeDefined();
        expect(newServer?.metadata.exported).toBe(true);
        expect(newServer?.metadata.signature).toContain('func NewServer');
        expect(newServer?.metadata.docstring).toContain('creates a new server');
      });

      it('should extract unexported functions', () => {
        const processRequest = simpleDocuments.find(
          (d) => d.metadata.name === 'processRequest' && d.type === 'function'
        );
        expect(processRequest).toBeDefined();
        expect(processRequest?.metadata.exported).toBe(false);
      });

      it('should include function signature', () => {
        const start = simpleDocuments.find(
          (d) => d.metadata.name === 'Start' && d.type === 'function'
        );
        expect(start).toBeDefined();
        expect(start?.metadata.signature).toContain('ctx context.Context');
        expect(start?.metadata.signature).toContain('error');
      });
    });

    describe('structs', () => {
      it('should extract struct declarations', () => {
        const config = simpleDocuments.find(
          (d) => d.metadata.name === 'Config' && d.type === 'class'
        );
        expect(config).toBeDefined();
        expect(config?.language).toBe('go');
        expect(config?.metadata.exported).toBe(true);
      });

      it('should extract doc comments for structs', () => {
        const server = simpleDocuments.find(
          (d) => d.metadata.name === 'Server' && d.type === 'class'
        );
        expect(server).toBeDefined();
        expect(server?.metadata.docstring).toContain('represents a server instance');
      });

      it('should include struct snippet', () => {
        const config = simpleDocuments.find(
          (d) => d.metadata.name === 'Config' && d.type === 'class'
        );
        expect(config?.metadata.snippet).toContain('Host');
        expect(config?.metadata.snippet).toContain('Port');
      });
    });

    describe('interfaces', () => {
      it('should extract interface declarations', () => {
        const reader = simpleDocuments.find(
          (d) => d.metadata.name === 'Reader' && d.type === 'interface'
        );
        expect(reader).toBeDefined();
        expect(reader?.metadata.exported).toBe(true);
        expect(reader?.metadata.signature).toBe('type Reader interface');
      });

      it('should extract doc comments for interfaces', () => {
        const reader = simpleDocuments.find(
          (d) => d.metadata.name === 'Reader' && d.type === 'interface'
        );
        expect(reader?.metadata.docstring).toContain('reading data');
      });

      it('should extract embedded interfaces', () => {
        const readWriter = simpleDocuments.find(
          (d) => d.metadata.name === 'ReadWriter' && d.type === 'interface'
        );
        expect(readWriter).toBeDefined();
        expect(readWriter?.metadata.snippet).toContain('Reader');
        expect(readWriter?.metadata.snippet).toContain('Writer');
      });
    });

    describe('type aliases', () => {
      it('should extract type aliases', () => {
        const id = simpleDocuments.find((d) => d.metadata.name === 'ID' && d.type === 'type');
        expect(id).toBeDefined();
        expect(id?.metadata.exported).toBe(true);
      });

      it('should extract function types', () => {
        const handler = simpleDocuments.find(
          (d) => d.metadata.name === 'Handler' && d.type === 'type'
        );
        expect(handler).toBeDefined();
        expect(handler?.metadata.signature).toContain('func');
      });
    });

    describe('constants', () => {
      it('should extract exported constants', () => {
        const maxRetries = simpleDocuments.find(
          (d) => d.metadata.name === 'MaxRetries' && d.type === 'variable'
        );
        expect(maxRetries).toBeDefined();
        expect(maxRetries?.metadata.exported).toBe(true);
        expect(maxRetries?.metadata.custom?.isConstant).toBe(true);
      });

      it('should not extract unexported constants', () => {
        const privateConst = simpleDocuments.find((d) => d.metadata.name === 'privateConst');
        expect(privateConst).toBeUndefined();
      });
    });

    describe('methods', () => {
      it('should extract methods with receivers', () => {
        const success = methodsDocuments.find(
          (d) => d.metadata.name === 'ExpBackoff.Success' && d.type === 'method'
        );
        expect(success).toBeDefined();
        expect(success?.metadata.custom?.receiver).toBe('ExpBackoff');
      });

      it('should detect pointer receivers', () => {
        const markFail = methodsDocuments.find(
          (d) => d.metadata.name === 'ExpBackoff.MarkFailAndGetWait' && d.type === 'method'
        );
        expect(markFail).toBeDefined();
        expect(markFail?.metadata.custom?.receiverPointer).toBe(true);
      });

      it('should detect value receivers', () => {
        const stringMethod = methodsDocuments.find(
          (d) => d.metadata.name === 'ExpBackoff.String' && d.type === 'method'
        );
        expect(stringMethod).toBeDefined();
        expect(stringMethod?.metadata.custom?.receiverPointer).toBe(false);
      });

      it('should extract method doc comments', () => {
        const markFail = methodsDocuments.find(
          (d) => d.metadata.name === 'ExpBackoff.MarkFailAndGetWait' && d.type === 'method'
        );
        expect(markFail?.metadata.docstring).toContain('increments failure count');
      });

      it('should handle unexported methods', () => {
        const calculateWait = methodsDocuments.find(
          (d) => d.metadata.name === 'ExpBackoff.calculateWait' && d.type === 'method'
        );
        expect(calculateWait).toBeDefined();
        expect(calculateWait?.metadata.exported).toBe(false);
      });
    });

    describe('generated files', () => {
      it('should skip generated files', async () => {
        const generatedDocs = await scanner.scan(['generated.go'], fixturesDir);
        expect(generatedDocs).toHaveLength(0);
      });
    });

    describe('test files', () => {
      it('should mark test file documents with isTest flag', () => {
        const testNewServer = testDocuments.find((d) => d.metadata.name === 'TestNewServer');
        expect(testNewServer).toBeDefined();
        expect(testNewServer?.metadata.custom?.isTest).toBe(true);
      });

      it('should extract test functions', () => {
        const testFunctions = testDocuments.filter(
          (d) => d.type === 'function' && d.metadata.name?.startsWith('Test')
        );
        expect(testFunctions.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('document IDs', () => {
      it('should generate unique IDs in format file:name:line', () => {
        const newServer = simpleDocuments.find((d) => d.metadata.name === 'NewServer');
        expect(newServer?.id).toMatch(/^simple\.go:NewServer:\d+$/);
      });
    });

    describe('embedding text', () => {
      it('should build embedding text with type, name, signature, and docstring', () => {
        const newServer = simpleDocuments.find((d) => d.metadata.name === 'NewServer');
        expect(newServer?.text).toContain('function NewServer');
        expect(newServer?.text).toContain('func NewServer');
        expect(newServer?.text).toContain('creates a new server');
      });
    });
  });

  describe('generics support', () => {
    let genericsDocuments: Document[];

    beforeAll(async () => {
      genericsDocuments = await scanner.scan(['generics.go'], fixturesDir);
    });

    describe('generic structs', () => {
      it('should extract generic struct Stack[T any]', () => {
        const stack = genericsDocuments.find(
          (d) => d.metadata.name === 'Stack' && d.type === 'class'
        );
        expect(stack).toBeDefined();
        expect(stack?.metadata.custom?.isGeneric).toBe(true);
        expect(stack?.metadata.custom?.typeParameters).toEqual(['T any']);
        expect(stack?.metadata.signature).toContain('[T any]');
      });

      it('should extract generic struct with multiple type parameters', () => {
        const pair = genericsDocuments.find(
          (d) => d.metadata.name === 'Pair' && d.type === 'class'
        );
        expect(pair).toBeDefined();
        expect(pair?.metadata.custom?.isGeneric).toBe(true);
        expect(pair?.metadata.custom?.typeParameters).toEqual(['K comparable', 'V any']);
      });
    });

    describe('generic functions', () => {
      it('should extract generic function Map[T, U any]', () => {
        const mapFn = genericsDocuments.find(
          (d) => d.metadata.name === 'Map' && d.type === 'function'
        );
        expect(mapFn).toBeDefined();
        expect(mapFn?.metadata.custom?.isGeneric).toBe(true);
        expect(mapFn?.metadata.custom?.typeParameters).toEqual(['T', 'U any']);
      });

      it('should extract generic function with constraints', () => {
        const minFn = genericsDocuments.find(
          (d) => d.metadata.name === 'Min' && d.type === 'function'
        );
        expect(minFn).toBeDefined();
        expect(minFn?.metadata.custom?.isGeneric).toBe(true);
        expect(minFn?.metadata.custom?.typeParameters).toEqual(['T Ordered']);
      });

      it('should extract NewPair generic constructor', () => {
        const newPair = genericsDocuments.find(
          (d) => d.metadata.name === 'NewPair' && d.type === 'function'
        );
        expect(newPair).toBeDefined();
        expect(newPair?.metadata.custom?.isGeneric).toBe(true);
        expect(newPair?.metadata.custom?.typeParameters).toEqual(['K comparable', 'V any']);
      });
    });

    describe('generic methods', () => {
      it('should extract method on generic receiver Stack[T]', () => {
        const push = genericsDocuments.find(
          (d) => d.metadata.name === 'Stack.Push' && d.type === 'method'
        );
        expect(push).toBeDefined();
        expect(push?.metadata.custom?.receiver).toBe('Stack');
        expect(push?.metadata.custom?.isGeneric).toBe(true);
      });

      it('should extract Pop method on generic Stack', () => {
        const pop = genericsDocuments.find(
          (d) => d.metadata.name === 'Stack.Pop' && d.type === 'method'
        );
        expect(pop).toBeDefined();
        expect(pop?.metadata.custom?.receiver).toBe('Stack');
        expect(pop?.metadata.custom?.receiverPointer).toBe(true);
      });
    });

    describe('generic interfaces', () => {
      it('should extract generic interface Comparable[T any]', () => {
        const comparable = genericsDocuments.find(
          (d) => d.metadata.name === 'Comparable' && d.type === 'interface'
        );
        expect(comparable).toBeDefined();
        expect(comparable?.metadata.custom?.isGeneric).toBe(true);
        expect(comparable?.metadata.custom?.typeParameters).toEqual(['T any']);
      });
    });

    describe('non-generic items in generic file', () => {
      it('should not mark non-generic interface as generic', () => {
        const ordered = genericsDocuments.find(
          (d) => d.metadata.name === 'Ordered' && d.type === 'interface'
        );
        expect(ordered).toBeDefined();
        expect(ordered?.metadata.custom?.isGeneric).toBeUndefined();
      });
    });
  });
});
