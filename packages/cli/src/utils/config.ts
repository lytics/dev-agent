import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from './logger.js';

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  enabled: boolean;
  source?: string; // For custom adapters (npm package or local path)
  settings?: Record<string, string | number | boolean>;
}

/**
 * Dev Agent Configuration Schema
 */
export interface DevAgentConfig {
  version: string;
  repository: {
    path?: string;
    excludePatterns?: string[];
    languages?: string[];
  };
  mcp?: {
    adapters?: Record<string, AdapterConfig>;
  };
  // Legacy fields (for backward compatibility)
  repositoryPath?: string;
  vectorStorePath?: string;
  embeddingModel?: string;
  dimension?: number;
  excludePatterns?: string[];
  includePatterns?: string[];
  languages?: string[];
}

const CONFIG_FILE_NAME = '.dev-agent/config.json';
const DEFAULT_VERSION = '1.0';

/**
 * Resolve environment variable references in config values
 * Supports ${VAR_NAME} syntax
 */
function resolveEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    // Match ${VAR_NAME} pattern
    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        throw new Error(
          `Environment variable ${varName} is not set (referenced in config as ${match})`
        );
      }
      return envValue;
    });
  }

  if (Array.isArray(value)) {
    return value.map(resolveEnvVars);
  }

  if (value && typeof value === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveEnvVars(val);
    }
    return resolved;
  }

  return value;
}

/**
 * Validate configuration structure
 */
function validateConfig(config: unknown): config is DevAgentConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object');
  }

  const cfg = config as Record<string, unknown>;

  // Version is required
  if (!cfg.version || typeof cfg.version !== 'string') {
    throw new Error('Config must have a "version" field (string)');
  }

  // Repository section is optional but should be an object if present
  if (cfg.repository !== undefined && typeof cfg.repository !== 'object') {
    throw new Error('Config "repository" field must be an object');
  }

  // MCP section is optional but should be an object if present
  if (cfg.mcp !== undefined && typeof cfg.mcp !== 'object') {
    throw new Error('Config "mcp" field must be an object');
  }

  // Validate adapter configs if present
  if (cfg.mcp && typeof cfg.mcp === 'object') {
    const mcp = cfg.mcp as Record<string, unknown>;
    if (mcp.adapters && typeof mcp.adapters === 'object') {
      const adapters = mcp.adapters as Record<string, unknown>;
      for (const [name, adapterConfig] of Object.entries(adapters)) {
        if (typeof adapterConfig !== 'object' || adapterConfig === null) {
          throw new Error(`Adapter "${name}" config must be an object`);
        }
        const adapter = adapterConfig as Record<string, unknown>;
        if (adapter.enabled !== undefined && typeof adapter.enabled !== 'boolean') {
          throw new Error(`Adapter "${name}" enabled field must be a boolean`);
        }
      }
    }
  }

  return true;
}

/**
 * Find config file starting from a directory
 */
export async function findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const configPath = path.join(currentDir, CONFIG_FILE_NAME);
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      // Config not found, go up one directory
      currentDir = path.dirname(currentDir);
    }
  }

  return null;
}

/**
 * Load and validate configuration file
 */
export async function loadConfig(configPath?: string): Promise<DevAgentConfig | null> {
  try {
    const finalPath = configPath || (await findConfigFile());

    if (!finalPath) {
      return null;
    }

    const content = await fs.readFile(finalPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate structure
    validateConfig(parsed);

    // Resolve environment variables
    const resolved = resolveEnvVars(parsed) as DevAgentConfig;

    return resolved;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load config: ${message}`);
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }
    return null;
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(
  config: DevAgentConfig,
  targetDir: string = process.cwd()
): Promise<void> {
  const configDir = path.join(targetDir, '.dev-agent');
  const configPath = path.join(configDir, 'config.json');

  try {
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    // Silent save - let caller handle user messaging
  } catch (error) {
    throw new Error(
      `Failed to save config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get default configuration
 */
export function getDefaultConfig(repositoryPath: string = process.cwd()): DevAgentConfig {
  const resolvedPath = path.resolve(repositoryPath);

  return {
    version: DEFAULT_VERSION,
    repository: {
      path: '.',
      excludePatterns: [
        // Standard exclusions
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        // TypeScript performance exclusions
        '**/*.mock.ts',
        '**/*.mock.tsx',
        '**/mocks/**',
        '**/*.d.ts',
        '**/test-utils/**',
        '**/testing/**',
      ],
      languages: ['typescript', 'javascript', 'markdown'],
    },
    mcp: {
      adapters: {
        search: { enabled: true },
        refs: { enabled: true },
        map: { enabled: true },
        history: { enabled: true },
        plan: { enabled: true },
        explore: { enabled: true },
        github: { enabled: true },
        status: { enabled: true },
        health: { enabled: true },
      },
    },
    // Legacy fields for backward compatibility
    repositoryPath: resolvedPath,
    excludePatterns: [
      // Standard exclusions
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/coverage/**',
      // TypeScript performance exclusions
      '**/*.mock.ts',
      '**/*.mock.tsx',
      '**/mocks/**',
      '**/*.d.ts',
      '**/test-utils/**',
      '**/testing/**',
    ],
    languages: ['typescript', 'javascript', 'markdown'],
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    dimension: 384,
  };
}

/**
 * Merge user config with defaults
 */
export function mergeConfigWithDefaults(
  userConfig: Partial<DevAgentConfig>,
  defaults: DevAgentConfig = getDefaultConfig()
): DevAgentConfig {
  return {
    ...defaults,
    ...userConfig,
    repository: {
      ...defaults.repository,
      ...userConfig.repository,
    },
    mcp: {
      ...defaults.mcp,
      ...userConfig.mcp,
      adapters: {
        ...defaults.mcp?.adapters,
        ...userConfig.mcp?.adapters,
      },
    },
  };
}
