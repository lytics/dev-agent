#!/usr/bin/env node
/**
 * Copy tree-sitter WASM files to dist/wasm/ for bundled CLI
 * This ensures WASM files are available when the CLI is installed as an npm package
 */

const fs = require('node:fs');
const path = require('node:path');

let wasmSourceDir;
try {
  // Try to find tree-sitter-wasms package location
  // We need to look for a known file inside it. "out/tree-sitter-go.wasm" is a good candidate if we knew it existed.
  // Or "package.json" but require.resolve might point to main.
  // tree-sitter-wasms package.json has "main": "index.js" maybe?

  // Let's try to find package.json first
  try {
    const pkgPath = require.resolve('tree-sitter-wasms/package.json');
    wasmSourceDir = path.join(path.dirname(pkgPath), 'out');
  } catch (_e) {
    // If that fails (e.g. exports restricted), try resolving the module root
    const _mainPath = require.resolve('tree-sitter-wasms');
    // Usually main is in root or dist. Let's assume root for now or walk up.
    // But tree-sitter-wasms typically just has "out" folder.

    // Fallback to the hardcoded path if resolve fails, but improve search
    wasmSourceDir = path.join(__dirname, '..', 'node_modules', 'tree-sitter-wasms', 'out');
  }
} catch (_e) {
  // Fallback
  wasmSourceDir = path.join(__dirname, '..', 'node_modules', 'tree-sitter-wasms', 'out');
}

// Robust search for tree-sitter-wasms if previous attempts failed or dir doesn't exist
if (!fs.existsSync(wasmSourceDir)) {
  // Try walking up directories to find node_modules/tree-sitter-wasms
  let current = path.dirname(__dirname); // packages/dev-agent
  for (let i = 0; i < 5; i++) {
    const testPath = path.join(current, 'node_modules', 'tree-sitter-wasms', 'out');
    if (fs.existsSync(testPath)) {
      wasmSourceDir = testPath;
      break;
    }

    // Also check .pnpm structure
    const pnpmDir = path.join(current, 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      try {
        const entries = fs.readdirSync(pnpmDir);
        const entry = entries.find((e) => e.startsWith('tree-sitter-wasms@'));
        if (entry) {
          const testPath2 = path.join(pnpmDir, entry, 'node_modules', 'tree-sitter-wasms', 'out');
          if (fs.existsSync(testPath2)) {
            wasmSourceDir = testPath2;
            break;
          }
        }
      } catch (_err) {}
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

console.log(`Using WASM source dir: ${wasmSourceDir}`);

const distDir = path.join(__dirname, '..', 'dist');
const wasmDestDir = path.join(distDir, 'wasm');
const vendorDestDir = path.join(distDir, 'vendor', 'web-tree-sitter');

// Create destination directories
if (!fs.existsSync(wasmDestDir)) {
  fs.mkdirSync(wasmDestDir, { recursive: true });
}
if (!fs.existsSync(vendorDestDir)) {
  fs.mkdirSync(vendorDestDir, { recursive: true });
}

// Check if source directory exists
if (!fs.existsSync(wasmSourceDir)) {
  console.error(`Error: tree-sitter-wasms not found at ${wasmSourceDir}`);
  console.error('WASM files cannot be bundled. Go scanner will not work.');
  console.error('Please run: npm install tree-sitter-wasms');
  process.exit(1);
}

// Supported languages to whitelist (Keep this small to reduce bundle size!)
//
// To add a new language:
// 1. Add language to this array (e.g., 'python', 'rust')
// 2. Update TreeSitterLanguage type in packages/core/src/scanner/tree-sitter.ts
// 3. Ensure tree-sitter-wasms package contains tree-sitter-{lang}.wasm
// 4. Create a language-specific scanner in packages/core/src/scanner/{lang}.ts
// 5. Update scanner registration in packages/core/src/scanner/index.ts
const SUPPORTED_LANGUAGES = ['go'];
const SUPPORTED_FILES = new Set([
  ...SUPPORTED_LANGUAGES.map((lang) => `tree-sitter-${lang}.wasm`),
  'tree-sitter.wasm', // Runtime if present
]);

// Copy whitelisted WASM files
const wasmFiles = fs.readdirSync(wasmSourceDir).filter((file) => {
  return file.endsWith('.wasm') && SUPPORTED_FILES.has(file);
});

if (wasmFiles.length === 0) {
  console.error('Error: No supported WASM files found in tree-sitter-wasms/out');
  console.error(`Expected files: ${Array.from(SUPPORTED_FILES).join(', ')}`);
  console.error('Go scanner will not work without these WASM files.');
  process.exit(1);
}

let copied = 0;
for (const file of wasmFiles) {
  const sourcePath = path.join(wasmSourceDir, file);
  const destPath = path.join(wasmDestDir, file);
  fs.copyFileSync(sourcePath, destPath);
  copied++;
}

// Copy web-tree-sitter files to dist/vendor
let webTreeSitterPath = null;
try {
  const pkgPath = require.resolve('web-tree-sitter/package.json');
  webTreeSitterPath = path.dirname(pkgPath);
  console.log(`Found web-tree-sitter via require.resolve: ${webTreeSitterPath}`);
} catch (e) {
  console.warn(`require.resolve failed: ${e.message}`);
  // Fallback search
  let current = path.dirname(__dirname); // packages/dev-agent
  for (let i = 0; i < 10; i++) {
    // Check standard node_modules
    const p = path.join(current, 'node_modules', 'web-tree-sitter');
    if (fs.existsSync(path.join(p, 'package.json'))) {
      webTreeSitterPath = p;
      break;
    }

    // Check .pnpm
    const pnpmDir = path.join(current, 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      try {
        const entries = fs.readdirSync(pnpmDir);
        const entry = entries.find((e) => e.startsWith('web-tree-sitter@'));
        if (entry) {
          const p2 = path.join(pnpmDir, entry, 'node_modules', 'web-tree-sitter');
          if (fs.existsSync(path.join(p2, 'package.json'))) {
            webTreeSitterPath = p2;
            break;
          }
        }
      } catch (_err) {}
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

if (webTreeSitterPath) {
  // Copy package.json
  fs.copyFileSync(
    path.join(webTreeSitterPath, 'package.json'),
    path.join(vendorDestDir, 'package.json')
  );

  // Copy tree-sitter.js / tree-sitter.cjs (main entry)
  const pkg = require(path.join(webTreeSitterPath, 'package.json'));

  // Check exports for require entry
  let mainFile = 'tree-sitter.js';
  if (pkg.exports?.['.']?.require) {
    mainFile = pkg.exports['.'].require;
  } else if (pkg.main) {
    mainFile = pkg.main;
  } else if (fs.existsSync(path.join(webTreeSitterPath, 'tree-sitter.cjs'))) {
    mainFile = 'tree-sitter.cjs';
  }

  // Handle relative paths like "./tree-sitter.cjs"
  if (mainFile.startsWith('./')) {
    mainFile = mainFile.substring(2);
  }

  const srcMain = path.join(webTreeSitterPath, mainFile);
  if (fs.existsSync(srcMain)) {
    fs.copyFileSync(srcMain, path.join(vendorDestDir, path.basename(mainFile)));
    console.log(`✓ Copied main file: ${mainFile}`);
  } else {
    console.warn(`Warning: Main file not found: ${srcMain}`);
  }

  // Also copy tree-sitter.wasm if it exists in root
  const wasmFile = path.join(webTreeSitterPath, 'tree-sitter.wasm');
  if (fs.existsSync(wasmFile)) {
    fs.copyFileSync(wasmFile, path.join(vendorDestDir, 'tree-sitter.wasm'));
    // Also copy to dist/wasm/ for getTreeSitterWasmPath strategy 0
    fs.copyFileSync(wasmFile, path.join(wasmDestDir, 'tree-sitter.wasm'));
  }

  // Copy lib directory if it exists (contains tree-sitter.wasm sometimes)
  const libDir = path.join(webTreeSitterPath, 'lib');
  if (fs.existsSync(libDir)) {
    const destLibDir = path.join(vendorDestDir, 'lib');
    if (!fs.existsSync(destLibDir)) fs.mkdirSync(destLibDir);
    const files = fs.readdirSync(libDir);
    for (const file of files) {
      fs.copyFileSync(path.join(libDir, file), path.join(destLibDir, file));
      // NOTE: Do NOT copy lib/tree-sitter.wasm to dist/wasm/ if we already copied from root.
      // Root tree-sitter.cjs expects root tree-sitter.wasm.
    }
  }

  console.log(`✓ Copied web-tree-sitter to dist/vendor/`);
} else {
  console.warn('Warning: Could not find web-tree-sitter to copy to vendor dir');
}

console.log(`✓ Copied ${copied} WASM file(s) to dist/wasm/`);
