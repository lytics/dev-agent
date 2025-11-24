/**
 * MCP Protocol Types
 * Based on Model Context Protocol specification
 */

// JSON-RPC 2.0 Base Types
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// MCP Protocol Methods
export type MCPMethod =
  | 'initialize'
  | 'tools/list'
  | 'tools/call'
  | 'resources/list'
  | 'resources/read'
  | 'prompts/list'
  | 'prompts/get';

// Tool Types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content?: unknown;
  isError?: boolean;
}

// Resource Types (for future use)
export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// Prompt Types (for future use)
export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

// JSON Schema (simplified)
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: JSONSchema;
  [key: string]: unknown;
}

// Server Capabilities
export interface ServerCapabilities {
  tools?: { supported: boolean };
  resources?: { supported: boolean };
  prompts?: { supported: boolean };
}

export interface ServerInfo {
  name: string;
  version: string;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
}

// Error Codes (JSON-RPC 2.0 standard + custom)
export enum ErrorCode {
  // JSON-RPC 2.0 standard errors
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // MCP custom errors (-32000 to -32099)
  ToolNotFound = -32000,
  ToolExecutionError = -32001,
  ResourceNotFound = -32002,
  PromptNotFound = -32003,
}
