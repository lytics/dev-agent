import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.d.ts', '**/test/**'],
    },
  },
  resolve: {
    alias: {
      '@lytics/dev-agent-core': resolve(__dirname, 'packages/core/src'),
      '@lytics/dev-agent-subagents': resolve(__dirname, 'packages/subagents/src'),
      '@lytics/dev-agent-cli': resolve(__dirname, 'packages/cli/src'),
      '@lytics/dev-agent-integrations': resolve(__dirname, 'packages/integrations/src'),
    },
  },
});