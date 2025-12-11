/**
 * WASM file resolution utilities
 * Separated for testability and easier maintenance
 */

export interface FileSystemAdapter {
  existsSync(path: string): boolean;
  requireResolve(id: string): string;
}

export interface WasmResolutionConfig {
  filename: string;
  packageName?: string;
  currentDirectory: string;
  fileSystem: FileSystemAdapter;
}

/**
 * Default filesystem adapter using Node.js fs and require
 */
export class NodeFileSystemAdapter implements FileSystemAdapter {
  existsSync(path: string): boolean {
    return require('node:fs').existsSync(path);
  }

  requireResolve(id: string): string {
    return require.resolve(id);
  }
}

/**
 * Find WASM files with multiple fallback strategies
 */
export function findWasmFile(config: WasmResolutionConfig): string {
  const { filename, packageName, currentDirectory, fileSystem } = config;
  const triedPaths: string[] = [];

  // Strategy 1: Check bundled location (dist/wasm/)
  const bundledPath = require('node:path').join(currentDirectory, 'wasm', filename);
  triedPaths.push(`bundled: ${bundledPath}`);
  if (fileSystem.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Strategy 2: Check vendor directory (dist/vendor/)
  if (packageName) {
    const vendorPath = require('node:path').join(currentDirectory, 'vendor', packageName, filename);
    triedPaths.push(`vendor: ${vendorPath}`);
    if (fileSystem.existsSync(vendorPath)) {
      return vendorPath;
    }
  }

  // Strategy 3: Development environment - resolve via node_modules
  if (packageName) {
    try {
      const mainPath = fileSystem.requireResolve(packageName);
      const packageDir = require('node:path').dirname(mainPath);

      // Check common locations within package
      const locations = [
        require('node:path').join(packageDir, filename),
        require('node:path').join(packageDir, 'lib', filename),
        require('node:path').join(require('node:path').dirname(packageDir), filename), // parent directory
      ];

      for (const location of locations) {
        if (fileSystem.existsSync(location)) {
          return location;
        }
      }

      triedPaths.push(`node_modules: checked ${locations.join(', ')}`);
    } catch (e) {
      triedPaths.push(`node_modules: resolution failed - ${e}`);
    }
  }

  throw new Error(
    `Failed to locate WASM file (${filename})${packageName ? ` from package ${packageName}` : ''}. ` +
      `Tried:\n  ${triedPaths.join('\n  ')}`
  );
}

/**
 * Tree-sitter language-specific WASM resolution
 */
export function findLanguageWasm(
  language: string,
  currentDirectory: string,
  fileSystem: FileSystemAdapter = new NodeFileSystemAdapter()
): string {
  const wasmFileName = `tree-sitter-${language}.wasm`;

  try {
    // First try bundled location using our utility
    return findWasmFile({
      filename: wasmFileName,
      currentDirectory,
      fileSystem,
    });
  } catch {
    // Fall back to tree-sitter-wasms package
    try {
      const packagePath = fileSystem.requireResolve('tree-sitter-wasms/package.json');
      const packageDir = require('node:path').dirname(packagePath);
      const wasmPath = require('node:path').join(packageDir, 'out', wasmFileName);

      if (fileSystem.existsSync(wasmPath)) {
        return wasmPath;
      }

      throw new Error(`WASM file not found in tree-sitter-wasms/out: ${wasmPath}`);
    } catch (packageError) {
      throw new Error(
        `Failed to locate tree-sitter WASM file for ${language} (${wasmFileName}). ` +
          `Make sure tree-sitter-wasms package is installed. Error: ${packageError}`
      );
    }
  }
}

/**
 * Web tree-sitter core WASM resolution
 */
export function findWebTreeSitterWasm(
  currentDirectory: string,
  fileSystem: FileSystemAdapter = new NodeFileSystemAdapter()
): string {
  return findWasmFile({
    filename: 'tree-sitter.wasm',
    packageName: 'web-tree-sitter',
    currentDirectory,
    fileSystem,
  });
}
