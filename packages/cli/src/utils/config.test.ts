import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findConfigFile, getDefaultConfig, loadConfig, saveConfig } from './config';

describe('Config Utilities', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `cli-config-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig('/test/path');

      expect(config.version).toBe('1.0');
      expect(config.repository).toBeDefined();
      expect(config.repository?.path).toBe('.');
      expect(config.repository?.excludePatterns).toContain('**/node_modules/**');
      expect(config.repository?.languages).toContain('typescript');
      // Legacy fields for backward compatibility
      expect(config.repositoryPath).toBe(path.resolve('/test/path'));
      expect(config.embeddingModel).toBe('Xenova/all-MiniLM-L6-v2');
      expect(config.dimension).toBe(384);
      expect(config.excludePatterns).toContain('**/node_modules/**');
      expect(config.languages).toContain('typescript');
    });

    it('should use current directory if no path provided', () => {
      const config = getDefaultConfig();
      expect(config.repositoryPath).toBe(process.cwd());
    });

    it('should include all 9 MCP adapters', () => {
      const config = getDefaultConfig('/test/path');
      const adapters = config.mcp?.adapters;

      expect(adapters).toBeDefined();
      expect(Object.keys(adapters!)).toHaveLength(9);

      // Verify all adapters are present and enabled by default
      expect(adapters?.search?.enabled).toBe(true);
      expect(adapters?.refs?.enabled).toBe(true);
      expect(adapters?.map?.enabled).toBe(true);
      expect(adapters?.history?.enabled).toBe(true);
      expect(adapters?.plan?.enabled).toBe(true);
      expect(adapters?.explore?.enabled).toBe(true);
      expect(adapters?.github?.enabled).toBe(true);
      expect(adapters?.status?.enabled).toBe(true);
      expect(adapters?.health?.enabled).toBe(true);
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      const config = getDefaultConfig(testDir);
      await saveConfig(config, testDir);

      const configPath = path.join(testDir, '.dev-agent', 'config.json');
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should save valid JSON', async () => {
      const config = getDefaultConfig(testDir);
      await saveConfig(config, testDir);

      const configPath = path.join(testDir, '.dev-agent', 'config.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.version).toBe('1.0');
      expect(parsed.repository).toBeDefined();
      // Legacy fields for backward compatibility
      expect(parsed.repositoryPath).toBe(config.repositoryPath);
      expect(parsed.embeddingModel).toBe(config.embeddingModel);
    });
  });

  describe('findConfigFile', () => {
    it('should find config file in current directory', async () => {
      const config = getDefaultConfig(testDir);
      await saveConfig(config, testDir);

      const found = await findConfigFile(testDir);
      expect(found).toBe(path.join(testDir, '.dev-agent', 'config.json'));
    });

    it('should find config file in parent directory', async () => {
      const subDir = path.join(testDir, 'sub', 'nested');
      await fs.mkdir(subDir, { recursive: true });

      const config = getDefaultConfig(testDir);
      await saveConfig(config, testDir);

      const found = await findConfigFile(subDir);
      expect(found).toBe(path.join(testDir, '.dev-agent', 'config.json'));
    });

    it('should return null if no config found', async () => {
      // Use a completely separate temp directory to avoid finding parent configs
      const isolatedDir = path.join(os.tmpdir(), `isolated-test-${Date.now()}`);
      await fs.mkdir(isolatedDir, { recursive: true });

      try {
        const found = await findConfigFile(isolatedDir);
        expect(found).toBeNull();
      } finally {
        await fs.rm(isolatedDir, { recursive: true, force: true });
      }
    });
  });

  describe('loadConfig', () => {
    it('should load config from file', async () => {
      const config = getDefaultConfig(testDir);
      await saveConfig(config, testDir);

      const loaded = await loadConfig(path.join(testDir, '.dev-agent', 'config.json'));
      expect(loaded).toBeDefined();
      expect(loaded?.version).toBe('1.0');
      expect(loaded?.repository).toBeDefined();
      // Legacy fields for backward compatibility
      expect(loaded?.repositoryPath).toBe(config.repositoryPath);
      expect(loaded?.embeddingModel).toBe(config.embeddingModel);
    });

    it('should return null if config not found', async () => {
      const loaded = await loadConfig('/nonexistent/path/.dev-agent/config.json');
      expect(loaded).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidDir = path.join(testDir, '.dev-agent-invalid');
      await fs.mkdir(invalidDir, { recursive: true });
      const invalidPath = path.join(invalidDir, 'config.json');
      await fs.writeFile(invalidPath, 'invalid json{{{', 'utf-8');

      const loaded = await loadConfig(invalidPath);
      expect(loaded).toBeNull();
    });
  });
});
