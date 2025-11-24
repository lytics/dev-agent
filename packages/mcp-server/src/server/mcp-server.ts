/**
 * MCP Server Core
 * Handles protocol, routing, and adapter coordination
 */

import { AdapterRegistry, type RegistryConfig } from '../adapters/adapter-registry';
import type { ToolAdapter } from '../adapters/tool-adapter';
import type { AdapterContext, Config, ToolExecutionContext } from '../adapters/types';
import { ConsoleLogger } from '../utils/logger';
import { JSONRPCHandler } from './protocol/jsonrpc';
import type {
  ErrorCode,
  InitializeResult,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPMethod,
  ServerCapabilities,
  ServerInfo,
  ToolCall,
} from './protocol/types';
import { StdioTransport } from './transport/stdio-transport';
import type { Transport, TransportMessage } from './transport/transport';

export interface MCPServerConfig {
  serverInfo: ServerInfo;
  config: Config;
  transport?: 'stdio' | Transport;
  registry?: RegistryConfig;
  adapters?: ToolAdapter[];
}

export class MCPServer {
  private registry: AdapterRegistry;
  private transport: Transport;
  private logger = new ConsoleLogger('[MCP Server]');
  private config: Config;
  private serverInfo: ServerInfo;

  constructor(config: MCPServerConfig) {
    this.config = config.config;
    this.serverInfo = config.serverInfo;
    this.registry = new AdapterRegistry(config.registry || {});

    // Create transport
    if (config.transport === 'stdio' || !config.transport) {
      this.transport = new StdioTransport();
    } else {
      this.transport = config.transport;
    }

    // Register provided adapters
    if (config.adapters) {
      for (const adapter of config.adapters) {
        this.registry.register(adapter);
      }
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    this.logger.info('Starting MCP server', {
      name: this.serverInfo.name,
      version: this.serverInfo.version,
    });

    // Initialize adapters
    const adapterContext: AdapterContext = {
      logger: this.logger,
      config: this.config,
    };
    await this.registry.initializeAll(adapterContext);

    // Set up transport handlers
    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.onError((error) => this.handleError(error));

    // Start transport
    await this.transport.start();

    this.logger.info('MCP server started', this.registry.getStats());
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping MCP server');

    await this.registry.shutdownAll();
    await this.transport.stop();

    this.logger.info('MCP server stopped');
  }

  /**
   * Register a new adapter
   */
  registerAdapter(adapter: ToolAdapter): void {
    this.registry.register(adapter);
  }

  /**
   * Handle incoming MCP message
   */
  private async handleMessage(message: TransportMessage): Promise<void> {
    // Only handle requests (not notifications for now)
    if (!JSONRPCHandler.isRequest(message)) {
      this.logger.debug('Ignoring notification', { method: message.method });
      return;
    }

    const request = message as JSONRPCRequest;

    try {
      const result = await this.routeRequest(request);
      const response = JSONRPCHandler.createResponse(request.id!, result);
      await this.transport.send(response);
    } catch (error) {
      this.logger.error('Request handling failed', {
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
      });

      const jsonrpcError = error as { code: ErrorCode; message: string; data?: unknown };
      const errorResponse = JSONRPCHandler.createErrorResponse(request.id, jsonrpcError);
      await this.transport.send(errorResponse);
    }
  }

  /**
   * Route request to appropriate handler
   */
  private async routeRequest(request: JSONRPCRequest): Promise<unknown> {
    const method = request.method as MCPMethod;

    switch (method) {
      case 'initialize':
        return this.handleInitialize();

      case 'tools/list':
        return this.handleToolsList();

      case 'tools/call':
        return this.handleToolsCall(
          request.params as { name: string; arguments: Record<string, unknown> }
        );

      case 'resources/list':
      case 'resources/read':
      case 'prompts/list':
      case 'prompts/get':
        throw JSONRPCHandler.createError(-32601, `Method not implemented: ${method}`);

      default:
        throw JSONRPCHandler.createError(-32601, `Unknown method: ${method}`);
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(): InitializeResult {
    const capabilities: ServerCapabilities = {
      tools: { supported: true },
      resources: { supported: false }, // Not yet implemented
      prompts: { supported: false }, // Not yet implemented
    };

    return {
      protocolVersion: '1.0',
      capabilities,
      serverInfo: this.serverInfo,
    };
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(): { tools: ReturnType<AdapterRegistry['getToolDefinitions']> } {
    return {
      tools: this.registry.getToolDefinitions(),
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(params: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown> {
    const { name, arguments: args } = params;

    const context: ToolExecutionContext = {
      logger: this.logger,
      config: this.config,
    };

    const result = await this.registry.executeTool(name, args, context);

    if (!result.success) {
      throw {
        code: result.error?.code ? Number.parseInt(result.error.code, 10) : -32001,
        message: result.error?.message || 'Tool execution failed',
        data: {
          details: result.error?.details,
          suggestion: result.error?.suggestion,
        },
      };
    }

    return result.data;
  }

  /**
   * Handle transport errors
   */
  private handleError(error: Error): void {
    this.logger.error('Transport error', { error: error.message });
  }
}
