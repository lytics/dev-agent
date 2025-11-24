/**
 * Utilities for handling MCP protocol messages
 */

import type { AdapterRegistry } from '../../adapters/adapter-registry';
import type {
  InitializeResult,
  ServerCapabilities,
  ServerInfo,
  ToolDefinition,
} from '../protocol/types';

/**
 * Create initialization result
 */
export function createInitializeResult(
  serverInfo: ServerInfo,
  capabilities: ServerCapabilities
): InitializeResult {
  return {
    protocolVersion: '1.0.0',
    serverInfo,
    capabilities,
  };
}

/**
 * Create tools list result
 */
export function createToolsListResult(registry: AdapterRegistry): { tools: ToolDefinition[] } {
  return {
    tools: registry.getToolDefinitions(),
  };
}

/**
 * Extract tool call parameters from request
 */
export function extractToolCallParams(
  params: unknown
): { name: string; arguments: Record<string, unknown> } | null {
  if (!params || typeof params !== 'object') {
    return null;
  }

  const p = params as Record<string, unknown>;

  if (typeof p.name !== 'string') {
    return null;
  }

  if (typeof p.arguments !== 'object' || p.arguments === null) {
    return null;
  }

  return {
    name: p.name,
    arguments: p.arguments as Record<string, unknown>,
  };
}

/**
 * Validate JSON-RPC request structure
 */
export function validateRequest(request: unknown): boolean {
  if (!request || typeof request !== 'object') {
    return false;
  }

  const req = request as Record<string, unknown>;

  // Must have jsonrpc and method
  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return false;
  }

  return true;
}

/**
 * Check if method is supported
 */
export function isSupportedMethod(method: string): boolean {
  const supportedMethods = ['initialize', 'tools/list', 'tools/call'];
  return supportedMethods.includes(method);
}
