/**
 * Cursor MCP Configuration Utilities Tests
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as cursorConfig from './cursor-config';

// Mock os.homedir
vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os');
  return {
    ...actual,
    homedir: vi.fn(),
  };
});

describe('Cursor Config Utilities', () => {
  let testConfigDir: string;

  beforeEach(async () => {
    // Create temp directory for test config
    testConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cursor-test-'));

    // Mock homedir to return test directory
    vi.mocked(os.homedir).mockReturnValue(testConfigDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testConfigDir, { recursive: true, force: true });

    // Clear mocks
    vi.clearAllMocks();
  });

  describe('getCursorConfigPath', () => {
    it('should return correct config path', () => {
      const configPath = cursorConfig.getCursorConfigPath();
      expect(configPath).toBe(path.join(testConfigDir, '.cursor', 'mcp.json'));
    });
  });

  describe('readCursorConfig', () => {
    it('should return empty config when file does not exist', async () => {
      const config = await cursorConfig.readCursorConfig();
      expect(config).toEqual({ mcpServers: {} });
    });

    it('should read existing config', async () => {
      // Create config file
      const configPath = cursorConfig.getCursorConfigPath();
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify({
          mcpServers: {
            'test-server': {
              command: 'test',
              args: ['arg1'],
            },
          },
        }),
        'utf-8'
      );

      const config = await cursorConfig.readCursorConfig();
      const server = config.mcpServers['test-server'];
      expect(server).toBeDefined();
      expect('command' in server && server.command).toBe('test');
    });
  });

  describe('writeCursorConfig', () => {
    it('should create directory and write config', async () => {
      const config = {
        mcpServers: {
          'my-server': {
            command: 'dev',
            args: ['mcp', 'start'],
          },
        },
      };

      await cursorConfig.writeCursorConfig(config);

      const configPath = cursorConfig.getCursorConfigPath();
      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.mcpServers['my-server']).toBeDefined();
      expect(parsed.mcpServers['my-server'].command).toBe('dev');
    });

    it('should format JSON with indentation', async () => {
      const config = {
        mcpServers: {
          'my-server': {
            command: 'dev',
            args: ['mcp', 'start'],
          },
        },
      };

      await cursorConfig.writeCursorConfig(config);

      const configPath = cursorConfig.getCursorConfigPath();
      const content = await fs.readFile(configPath, 'utf-8');

      // Check that it's pretty-printed (has newlines and spaces)
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });
  });

  describe('generateServerName', () => {
    it('should generate name from repository path', () => {
      const name = cursorConfig.generateServerName('/path/to/my-repo', []);
      expect(name).toBe('dev-agent-my-repo');
    });

    it('should add suffix if name already exists', () => {
      const existingNames = ['dev-agent-my-repo'];
      const name = cursorConfig.generateServerName('/path/to/my-repo', existingNames);
      expect(name).toBe('dev-agent-my-repo-1');
    });

    it('should increment suffix for multiple conflicts', () => {
      const existingNames = ['dev-agent-my-repo', 'dev-agent-my-repo-1', 'dev-agent-my-repo-2'];
      const name = cursorConfig.generateServerName('/path/to/my-repo', existingNames);
      expect(name).toBe('dev-agent-my-repo-3');
    });
  });

  describe('findServerByRepository', () => {
    it('should return null when no server exists', async () => {
      const result = await cursorConfig.findServerByRepository('/path/to/repo');
      expect(result).toBeNull();
    });

    it('should find existing server by repository path', async () => {
      await cursorConfig.addCursorServer('/path/to/repo');
      const result = await cursorConfig.findServerByRepository('/path/to/repo');
      expect(result).toBe('dev-agent-repo');
    });
  });

  describe('addCursorServer', () => {
    it('should add new server to empty config', async () => {
      const repositoryPath = '/path/to/repo';
      const result = await cursorConfig.addCursorServer(repositoryPath);

      expect(result.serverName).toBe('dev-agent-repo');
      expect(result.alreadyExists).toBe(false);

      const config = await cursorConfig.readCursorConfig();
      const server = config.mcpServers[result.serverName];
      expect(server).toBeDefined();
      expect('command' in server && server.command).toBe('dev');
      expect('args' in server && server.args).toEqual(['mcp', 'start']);
      expect('env' in server && server.env?.REPOSITORY_PATH).toBe(repositoryPath);
    });

    it('should detect existing server and not create duplicate', async () => {
      // Add first server
      await cursorConfig.addCursorServer('/path/to/repo');

      // Try to add again for same repository
      const result = await cursorConfig.addCursorServer('/path/to/repo');

      expect(result.serverName).toBe('dev-agent-repo');
      expect(result.alreadyExists).toBe(true);

      const config = await cursorConfig.readCursorConfig();
      expect(Object.keys(config.mcpServers).length).toBe(1);
    });

    it('should add server with unique name when different repository', async () => {
      // Add first server
      await cursorConfig.addCursorServer('/path/to/repo');

      // Add second server with same base name but different path
      const result = await cursorConfig.addCursorServer('/other/path/repo');

      expect(result.serverName).toBe('dev-agent-repo-1');
      expect(result.alreadyExists).toBe(false);

      const config = await cursorConfig.readCursorConfig();
      expect(config.mcpServers['dev-agent-repo']).toBeDefined();
      expect(config.mcpServers['dev-agent-repo-1']).toBeDefined();
    });
  });

  describe('removeCursorServer', () => {
    it('should remove server by repository path', async () => {
      const repositoryPath = '/path/to/repo';
      await cursorConfig.addCursorServer(repositoryPath);

      const removed = await cursorConfig.removeCursorServer(repositoryPath);
      expect(removed).toBe(true);

      const config = await cursorConfig.readCursorConfig();
      expect(Object.keys(config.mcpServers).length).toBe(0);
    });

    it('should return false if server not found', async () => {
      const removed = await cursorConfig.removeCursorServer('/nonexistent/path');
      expect(removed).toBe(false);
    });

    it('should only remove matching server', async () => {
      await cursorConfig.addCursorServer('/path/to/repo1');
      await cursorConfig.addCursorServer('/path/to/repo2');

      const removed = await cursorConfig.removeCursorServer('/path/to/repo1');
      expect(removed).toBe(true);

      const config = await cursorConfig.readCursorConfig();
      expect(Object.keys(config.mcpServers).length).toBe(1);
      expect(config.mcpServers['dev-agent-repo2']).toBeDefined();
    });
  });

  describe('listCursorServers', () => {
    it('should return empty list when no servers', async () => {
      const servers = await cursorConfig.listCursorServers();
      expect(servers).toEqual([]);
    });

    it('should list all MCP servers including dev-agent', async () => {
      await cursorConfig.addCursorServer('/path/to/repo1');
      await cursorConfig.addCursorServer('/path/to/repo2');

      const servers = await cursorConfig.listCursorServers();
      expect(servers.length).toBe(2);
      expect(servers[0].name).toBe('dev-agent-repo1');
      expect(servers[0].command).toBe('dev mcp start');
      expect(servers[0].repository).toBe('/path/to/repo1');
      expect(servers[1].name).toBe('dev-agent-repo2');
      expect(servers[1].command).toBe('dev mcp start');
      expect(servers[1].repository).toBe('/path/to/repo2');
    });

    it('should include non-dev-agent servers', async () => {
      await cursorConfig.addCursorServer('/path/to/repo1');

      // Add a non-dev-agent server manually (type assertion for test data)
      const config = await cursorConfig.readCursorConfig();
      (config.mcpServers as any)['other-server'] = {
        command: 'other',
        args: ['arg1'],
      };
      await cursorConfig.writeCursorConfig(config);

      const servers = await cursorConfig.listCursorServers();
      expect(servers.length).toBe(2);
      expect(servers[0].name).toBe('dev-agent-repo1');
      expect(servers[1].name).toBe('other-server');
      expect(servers[1].command).toBe('other arg1');
    });

    it('should handle HTTP servers', async () => {
      // Add an HTTP server (like Figma) (type assertion for test data)
      const config = await cursorConfig.readCursorConfig();
      (config.mcpServers as any).figma = {
        url: 'https://mcp.figma.com/mcp',
        headers: {},
      };
      await cursorConfig.writeCursorConfig(config);

      const servers = await cursorConfig.listCursorServers();
      expect(servers.length).toBe(1);
      expect(servers[0].name).toBe('figma');
      expect(servers[0].command).toBe('HTTP: https://mcp.figma.com/mcp');
      expect(servers[0].repository).toBeUndefined();
    });
  });
});
