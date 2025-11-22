import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from './logger.js';

export interface DevAgentConfig {
  repositoryPath: string;
  vectorStorePath: string;
  embeddingModel?: string;
  dimension?: number;
  excludePatterns?: string[];
  includePatterns?: string[];
  languages?: string[];
}

const CONFIG_FILE_NAME = '.dev-agent.json';
const DEFAULT_VECTOR_STORE_PATH = '.dev-agent/vectors.lance';

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

export async function loadConfig(configPath?: string): Promise<DevAgentConfig | null> {
  try {
    const finalPath = configPath || (await findConfigFile());

    if (!finalPath) {
      return null;
    }

    const content = await fs.readFile(finalPath, 'utf-8');
    return JSON.parse(content) as DevAgentConfig;
  } catch (error) {
    logger.error(
      `Failed to load config: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

export async function saveConfig(
  config: DevAgentConfig,
  targetDir: string = process.cwd()
): Promise<void> {
  const configPath = path.join(targetDir, CONFIG_FILE_NAME);

  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    logger.success(`Config saved to ${chalk.cyan(configPath)}`);
  } catch (error) {
    throw new Error(
      `Failed to save config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function getDefaultConfig(repositoryPath: string = process.cwd()): DevAgentConfig {
  return {
    repositoryPath: path.resolve(repositoryPath),
    vectorStorePath: path.join(repositoryPath, DEFAULT_VECTOR_STORE_PATH),
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    dimension: 384,
    excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
    languages: ['typescript', 'javascript', 'markdown'],
  };
}

// Fix: Import chalk at the top
import chalk from 'chalk';
