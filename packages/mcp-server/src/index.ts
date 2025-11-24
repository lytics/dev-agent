/**
 * MCP Server Entry Point
 * Can be used as a standalone server or imported as a library
 */

// Adapter exports
export { Adapter } from './adapters/adapter';
export { AdapterRegistry, type RegistryConfig } from './adapters/adapter-registry';
export * from './adapters/built-in';
export { ToolAdapter } from './adapters/tool-adapter';
export * from './adapters/types';
// Formatter exports
export * from './formatters';
// Core exports
export { MCPServer, type MCPServerConfig } from './server/mcp-server';
// Protocol exports
export { JSONRPCHandler } from './server/protocol/jsonrpc';
export * from './server/protocol/types';
export { StdioTransport } from './server/transport/stdio-transport';
// Transport exports
export {
  Transport,
  type TransportConfig,
  type TransportMessage,
} from './server/transport/transport';
// Utility exports
export { ConsoleLogger } from './utils/logger';
