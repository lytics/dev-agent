import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanCommand } from './clean';
import { indexCommand } from './index';
import { initCommand } from './init';

describe('CLI Commands', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `cli-commands-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('init command', () => {
    it('should create config file', async () => {
      const initDir = path.join(testDir, 'init-test');
      await fs.mkdir(initDir, { recursive: true });

      // Mock process.exit to prevent test termination
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Create a program and add the command
      const program = new Command();
      program.addCommand(initCommand);

      // Parse arguments
      await program.parseAsync(['node', 'cli', 'init', '--path', initDir]);

      exitSpy.mockRestore();

      // Check config file was created
      const configPath = path.join(initDir, '.dev-agent', 'config.json');
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Verify config content
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.version).toBe('1.0');
      expect(config.repository).toBeDefined();
      // Legacy fields for backward compatibility
      expect(config.repositoryPath).toBe(path.resolve(initDir));
      expect(config.embeddingModel).toBe('Xenova/all-MiniLM-L6-v2');
    });

    it('should have correct command name and description', () => {
      expect(initCommand.name()).toBe('init');
      expect(initCommand.description()).toBe('Initialize dev-agent in the current directory');
    });
  });

  describe('clean command', () => {
    it('should have correct command name and description', () => {
      expect(cleanCommand.name()).toBe('clean');
      expect(cleanCommand.description()).toBe('Clean indexed data and cache');
    });

    it('should have force option', () => {
      const options = cleanCommand.options;
      const forceOption = options.find((opt) => opt.long === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.short).toBe('-f');
    });
  });

  describe('index command', () => {
    it('should have correct command name and description', () => {
      expect(indexCommand.name()).toBe('index');
      expect(indexCommand.description()).toBe(
        'Index a repository (code, git history, GitHub issues/PRs)'
      );
    });

    it('should display storage size after indexing', async () => {
      const indexDir = path.join(testDir, 'index-test');
      await fs.mkdir(indexDir, { recursive: true });

      // Create a simple TypeScript file to index
      await fs.writeFile(
        path.join(indexDir, 'sample.ts'),
        `export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}`
      );

      // Capture console output (used by output.log)
      const loggedMessages: string[] = [];
      const originalConsoleLog = console.log;
      vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        loggedMessages.push(args.join(' '));
      });

      // Mock process.exit to prevent test termination
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Create a program and add the command
      const program = new Command();
      program.addCommand(indexCommand);

      // Run index command (skip git and github for faster test)
      await program.parseAsync(['node', 'cli', 'index', indexDir, '--no-git', '--no-github']);

      exitSpy.mockRestore();
      console.log = originalConsoleLog;

      // Verify storage size is in the output (new compact format shows it after duration)
      const storageSizeLog = loggedMessages.find(
        (msg) => msg.includes('Duration:') || msg.includes('Storage:')
      );
      expect(storageSizeLog).toBeDefined();
      // Check for storage size in compact format: "Duration: X • Storage: Y"
      expect(loggedMessages.some((msg) => /\d+(\.\d+)?\s*(B|KB|MB|GB)/.test(msg))).toBe(true);
    }, 30000); // 30s timeout for indexing
  });
});
