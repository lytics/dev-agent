/**
 * MCP Server Entry Point
 * Can be used as a standalone server or imported as a library
 */

// Adapter exports
export { Adapter } from './adapters/Adapter';
export { AdapterRegistry, type RegistryConfig } from './adapters/AdapterRegistry';
export { ToolAdapter } from './adapters/ToolAdapter';
export * from './adapters/types';
// Core exports
export { MCPServer, type MCPServerConfig } from './server/MCPServer';
// Protocol exports
export { JSONRPCHandler } from './server/protocol/jsonrpc';
export * from './server/protocol/types';
export { StdioTransport } from './server/transport/StdioTransport';
// Transport exports
export {
  Transport,
  type TransportConfig,
  type TransportMessage,
} from './server/transport/Transport';

// Utility exports
export { ConsoleLogger } from './utils/logger';
