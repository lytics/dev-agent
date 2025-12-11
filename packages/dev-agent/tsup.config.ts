import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// Read version from package.json at build time
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// External dependencies that should NOT be bundled:
// - Native modules (have platform-specific binaries)
// - Large libraries with their own loading mechanisms
const external = [
  // Native modules with platform-specific binaries
  '@lancedb/lancedb',

  // Large ML library - has its own model loading mechanism
  '@xenova/transformers',

  // These have native bindings or complex loading
  'ts-morph',
  'typescript',
  'web-tree-sitter',
];

export default defineConfig([
  // CLI entry point
  {
    entry: { cli: '../cli/dist/cli.js' },
    outDir: 'dist',
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    external,
    sourcemap: true,
    clean: true,
    // Inject version at build time
    define: {
      __VERSION__: JSON.stringify(version),
    },
    // Note: shebang is already in source file
  },
  // MCP server entry point
  {
    entry: { mcp: '../mcp-server/dist/bin/dev-agent-mcp.js' },
    outDir: 'dist',
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    external,
    sourcemap: true,
    // Don't clean - would delete cli.cjs from first build
    clean: false,
  },
]);
