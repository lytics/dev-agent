/**
 * Tests for WASM resolution utilities
 */

import { describe, expect, it } from 'vitest';
import {
  type FileSystemAdapter,
  findLanguageWasm,
  findWasmFile,
  findWebTreeSitterWasm,
  type WasmResolutionConfig,
} from '../wasm-resolver';

// Mock filesystem adapter for testing
class MockFileSystemAdapter implements FileSystemAdapter {
  constructor(
    private existingFiles: Set<string> = new Set(),
    private resolvedPaths: Map<string, string> = new Map()
  ) {}

  existsSync(path: string): boolean {
    return this.existingFiles.has(path);
  }

  requireResolve(id: string): string {
    const resolved = this.resolvedPaths.get(id);
    if (!resolved) {
      throw new Error(`Cannot resolve module '${id}'`);
    }
    return resolved;
  }

  addFile(path: string): this {
    this.existingFiles.add(path);
    return this;
  }

  addResolvedPath(id: string, path: string): this {
    this.resolvedPaths.set(id, path);
    return this;
  }
}

describe('findWasmFile', () => {
  it('should find file in bundled location', () => {
    const mockFs = new MockFileSystemAdapter().addFile('/dist/wasm/test.wasm');

    const config: WasmResolutionConfig = {
      filename: 'test.wasm',
      currentDirectory: '/dist',
      fileSystem: mockFs,
    };

    expect(findWasmFile(config)).toBe('/dist/wasm/test.wasm');
  });

  it('should find file in vendor directory', () => {
    const mockFs = new MockFileSystemAdapter().addFile('/dist/vendor/my-package/test.wasm');

    const config: WasmResolutionConfig = {
      filename: 'test.wasm',
      packageName: 'my-package',
      currentDirectory: '/dist',
      fileSystem: mockFs,
    };

    expect(findWasmFile(config)).toBe('/dist/vendor/my-package/test.wasm');
  });

  it('should find file in node_modules', () => {
    const mockFs = new MockFileSystemAdapter()
      .addFile('/project/node_modules/my-package/test.wasm')
      .addResolvedPath('my-package', '/project/node_modules/my-package/index.js');

    const config: WasmResolutionConfig = {
      filename: 'test.wasm',
      packageName: 'my-package',
      currentDirectory: '/dist',
      fileSystem: mockFs,
    };

    expect(findWasmFile(config)).toBe('/project/node_modules/my-package/test.wasm');
  });

  it('should try multiple node_modules locations', () => {
    const mockFs = new MockFileSystemAdapter()
      .addFile('/project/node_modules/my-package/lib/test.wasm')
      .addResolvedPath('my-package', '/project/node_modules/my-package/index.js');

    const config: WasmResolutionConfig = {
      filename: 'test.wasm',
      packageName: 'my-package',
      currentDirectory: '/dist',
      fileSystem: mockFs,
    };

    expect(findWasmFile(config)).toBe('/project/node_modules/my-package/lib/test.wasm');
  });

  it('should throw detailed error when file not found', () => {
    const mockFs = new MockFileSystemAdapter();

    const config: WasmResolutionConfig = {
      filename: 'missing.wasm',
      packageName: 'my-package',
      currentDirectory: '/dist',
      fileSystem: mockFs,
    };

    expect(() => findWasmFile(config)).toThrow(
      /Failed to locate WASM file.*missing\.wasm.*from package my-package/
    );
  });
});

describe('findLanguageWasm', () => {
  it('should find bundled Go WASM file', () => {
    const mockFs = new MockFileSystemAdapter().addFile('/dist/wasm/tree-sitter-go.wasm');

    expect(findLanguageWasm('go', '/dist', mockFs)).toBe('/dist/wasm/tree-sitter-go.wasm');
  });

  it('should fall back to tree-sitter-wasms package', () => {
    const mockFs = new MockFileSystemAdapter()
      .addFile('/node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm')
      .addResolvedPath(
        'tree-sitter-wasms/package.json',
        '/node_modules/tree-sitter-wasms/package.json'
      );

    expect(findLanguageWasm('python', '/dist', mockFs)).toBe(
      '/node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm'
    );
  });

  it('should throw error when language WASM not found', () => {
    const mockFs = new MockFileSystemAdapter();

    expect(() => findLanguageWasm('nonexistent', '/dist', mockFs)).toThrow(
      /Failed to locate tree-sitter WASM file for nonexistent/
    );
  });
});

describe('findWebTreeSitterWasm', () => {
  it('should find web-tree-sitter WASM file', () => {
    const mockFs = new MockFileSystemAdapter().addFile(
      '/dist/vendor/web-tree-sitter/tree-sitter.wasm'
    );

    expect(findWebTreeSitterWasm('/dist', mockFs)).toBe(
      '/dist/vendor/web-tree-sitter/tree-sitter.wasm'
    );
  });

  it('should throw error when not found', () => {
    const mockFs = new MockFileSystemAdapter();

    expect(() => findWebTreeSitterWasm('/dist', mockFs)).toThrow(
      /Failed to locate WASM file.*tree-sitter\.wasm.*from package web-tree-sitter/
    );
  });
});
