/**
 * Cursor MCP Configuration Utilities
 * Handles reading and writing Cursor's MCP server configuration
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export interface CursorMCPServerStdio {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface CursorMCPServerHTTP {
  url: string;
  headers?: Record<string, string>;
}

export type CursorMCPServer = CursorMCPServerStdio | CursorMCPServerHTTP;

export interface CursorMCPConfig {
  mcpServers: Record<string, CursorMCPServer>;
}

/**
 * Get the path to Cursor's MCP configuration file
 */
export function getCursorConfigPath(): string {
  return path.join(os.homedir(), '.cursor', 'mcp.json');
}

/**
 * Read Cursor's MCP configuration
 * Creates a new config if it doesn't exist
 */
export async function readCursorConfig(): Promise<CursorMCPConfig> {
  const configPath = getCursorConfigPath();

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty config
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { mcpServers: {} };
    }
    throw error;
  }
}

/**
 * Write Cursor's MCP configuration
 * Creates directory if it doesn't exist
 */
export async function writeCursorConfig(config: CursorMCPConfig): Promise<void> {
  const configPath = getCursorConfigPath();
  const configDir = path.dirname(configPath);

  // Ensure directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Write config with pretty formatting
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Generate a unique server name for dev-agent
 * Uses repository name as base and adds suffix if needed
 */
export function generateServerName(repositoryPath: string, existingNames: string[]): string {
  const repoName = path.basename(repositoryPath);
  const baseName = `dev-agent-${repoName}`;

  // If base name is available, use it
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  // Otherwise, add numeric suffix
  let suffix = 1;
  while (existingNames.includes(`${baseName}-${suffix}`)) {
    suffix++;
  }
  return `${baseName}-${suffix}`;
}

/**
 * Check if a server already exists for this repository
 */
export async function findServerByRepository(repositoryPath: string): Promise<string | null> {
  const config = await readCursorConfig();

  for (const [name, server] of Object.entries(config.mcpServers)) {
    // Only check stdio servers (which have env)
    if ('env' in server && server.env?.REPOSITORY_PATH === repositoryPath) {
      return name;
    }
  }

  return null;
}

/**
 * Add dev-agent MCP server to Cursor configuration
 * Returns the server name if added, or null if already exists
 */
export async function addCursorServer(
  repositoryPath: string
): Promise<{ serverName: string; alreadyExists: boolean }> {
  // Check if server already exists for this repository
  const existingServer = await findServerByRepository(repositoryPath);
  if (existingServer) {
    return { serverName: existingServer, alreadyExists: true };
  }

  const config = await readCursorConfig();
  const existingNames = Object.keys(config.mcpServers);

  // Generate unique server name
  const serverName = generateServerName(repositoryPath, existingNames);

  // Add server configuration
  config.mcpServers[serverName] = {
    command: 'dev',
    args: ['mcp', 'start'],
    env: {
      REPOSITORY_PATH: repositoryPath,
    },
  } as CursorMCPServerStdio;

  // Write updated config
  await writeCursorConfig(config);

  return { serverName, alreadyExists: false };
}

/**
 * Remove dev-agent MCP server from Cursor configuration
 * Finds server by repository path
 */
export async function removeCursorServer(repositoryPath: string): Promise<boolean> {
  const config = await readCursorConfig();

  // Find server entry for this repository
  let serverName: string | undefined;
  for (const [name, server] of Object.entries(config.mcpServers)) {
    // Only check stdio servers (which have env)
    if ('env' in server && server.env?.REPOSITORY_PATH === repositoryPath) {
      serverName = name;
      break;
    }
  }

  if (!serverName) {
    return false; // No server found for this repository
  }

  // Remove the server
  delete config.mcpServers[serverName];

  // Write updated config
  await writeCursorConfig(config);

  return true;
}

/**
 * List all MCP servers in Cursor configuration
 */
export async function listCursorServers(): Promise<
  Array<{ name: string; command: string; repository?: string }>
> {
  const config = await readCursorConfig();

  const servers: Array<{ name: string; command: string; repository?: string }> = [];

  for (const [name, server] of Object.entries(config.mcpServers)) {
    // Determine command display
    let command: string;
    let repository: string | undefined;

    if ('url' in server) {
      command = `HTTP: ${server.url}`;
    } else {
      command = server.command;
      if (server.args && server.args.length > 0) {
        command += ` ${server.args.join(' ')}`;
      }
      repository = server.env?.REPOSITORY_PATH;
    }

    servers.push({
      name,
      command,
      repository,
    });
  }

  return servers;
}
