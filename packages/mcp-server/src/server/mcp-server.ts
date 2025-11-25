/**
 * MCP Server Core
 * Handles protocol, routing, and adapter coordination
 */

import type { SubagentCoordinator } from '@lytics/dev-agent-subagents';
import { AdapterRegistry, type RegistryConfig } from '../adapters/adapter-registry';
import type { ToolAdapter } from '../adapters/tool-adapter';
import type { AdapterContext, Config, ToolExecutionContext } from '../adapters/types';
import { ConsoleLogger } from '../utils/logger';
import { PromptRegistry } from './prompts';
import { createError, createErrorResponse, createResponse, isRequest } from './protocol/jsonrpc';
import type {
  ErrorCode,
  InitializeResult,
  JSONRPCRequest,
  MCPMethod,
  ServerCapabilities,
  ServerInfo,
} from './protocol/types';
import { StdioTransport } from './transport/stdio-transport';
import type { Transport, TransportMessage } from './transport/transport';

export interface MCPServerConfig {
  serverInfo: ServerInfo;
  config: Config;
  transport?: 'stdio' | Transport;
  registry?: RegistryConfig;
  adapters?: ToolAdapter[];
  /** Optional coordinator for routing through subagents */
  coordinator?: SubagentCoordinator;
}

export class MCPServer {
  private registry: AdapterRegistry;
  private promptRegistry: PromptRegistry;
  private transport: Transport;
  private logger = new ConsoleLogger('[MCP Server]', 'debug'); // Enable debug logging
  private config: Config;
  private serverInfo: ServerInfo;
  private clientProtocolVersion?: string;
  private coordinator?: SubagentCoordinator;

  constructor(config: MCPServerConfig) {
    this.config = config.config;
    this.serverInfo = config.serverInfo;
    this.registry = new AdapterRegistry(config.registry || {});
    this.promptRegistry = new PromptRegistry();
    this.coordinator = config.coordinator;

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
      hasCoordinator: !!this.coordinator,
    });

    // Start coordinator if provided
    if (this.coordinator) {
      this.coordinator.start();
      this.logger.info('Subagent coordinator started', {
        agents: this.coordinator.getAgents(),
      });
    }

    // Initialize adapters with coordinator access
    const adapterContext: AdapterContext = {
      logger: this.logger,
      config: this.config,
      coordinator: this.coordinator,
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

    // Stop coordinator if provided
    if (this.coordinator) {
      await this.coordinator.stop();
      this.logger.info('Subagent coordinator stopped');
    }

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
    this.logger.debug('Raw message received', {
      type: typeof message,
      isRequest: isRequest(message),
      preview: JSON.stringify(message).substring(0, 200),
    });

    // Handle notifications
    if (!isRequest(message)) {
      const method = (message as { method: string }).method;
      this.logger.info('Received notification', { method });

      // The 'initialized' notification is sent by the client after receiving
      // the initialize response. We acknowledge it but don't need to respond.
      if (method === 'initialized') {
        this.logger.info('Client initialized successfully');
      }

      return;
    }

    const request = message as JSONRPCRequest;
    this.logger.info('Received request', { method: request.method, id: request.id });

    try {
      const result = await this.routeRequest(request);
      // request.id is guaranteed to be defined for requests (checked by isRequest)
      const requestId = request.id ?? 0;
      const response = createResponse(requestId, result);
      this.logger.debug('Sending response', {
        id: request.id,
        method: request.method,
        responsePreview: JSON.stringify(response).substring(0, 200),
      });
      await this.transport.send(response);
    } catch (error) {
      this.logger.error('Request handling failed', {
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
      });

      const jsonrpcError = error as { code: ErrorCode; message: string; data?: unknown };
      const requestId = request.id ?? 0;
      const errorResponse = createErrorResponse(requestId, jsonrpcError);
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
        return this.handleInitialize(request.params as { protocolVersion?: string });

      case 'tools/list':
        return this.handleToolsList();

      case 'tools/call':
        return this.handleToolsCall(
          request.params as { name: string; arguments: Record<string, unknown> }
        );

      case 'prompts/list':
        return this.handlePromptsList();

      case 'prompts/get':
        return this.handlePromptsGet(
          request.params as { name: string; arguments?: Record<string, string> }
        );

      case 'resources/list':
        return this.handleResourcesList();

      case 'resources/read':
        throw createError(-32601, `Method not implemented: ${method}`);

      default:
        throw createError(-32601, `Unknown method: ${method}`);
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(params?: { protocolVersion?: string }): InitializeResult {
    // Store the client's protocol version and echo it back
    // MCP uses date-based versioning (e.g., "2025-06-18")
    this.clientProtocolVersion = params?.protocolVersion || '1.0';

    this.logger.debug('Initialize request', {
      clientProtocolVersion: this.clientProtocolVersion,
      clientParams: params,
    });

    const capabilities: ServerCapabilities = {
      tools: { supported: true },
      resources: { supported: false }, // Not yet implemented
      prompts: { supported: true },
    };

    return {
      protocolVersion: this.clientProtocolVersion,
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
   * Map semantic error codes to JSON-RPC numeric codes
   */
  private mapErrorCode(code?: string): number {
    const codeMap: Record<string, number> = {
      INVALID_PARAMS: -32602,
      NOT_FOUND: -32001,
      TIMEOUT: -32002,
      INTERNAL_ERROR: -32603,
      GITHUB_CLI_ERROR: -32003,
      INDEXER_ERROR: -32004,
    };
    return code ? codeMap[code] || -32001 : -32001;
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
        code: this.mapErrorCode(result.error?.code),
        message: result.error?.message || 'Tool execution failed',
        data: {
          details: result.error?.details,
          suggestion: result.error?.suggestion,
        },
      };
    }

    // Format response according to MCP protocol
    // The content field must be an array of content blocks
    return {
      content: [
        {
          type: 'text',
          text:
            typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }

  /**
   * Handle prompts/list request
   */
  private handlePromptsList(): { prompts: unknown[] } {
    this.logger.debug('Listing prompts');
    const prompts = this.promptRegistry.listPrompts();
    this.logger.info('Prompts listed', { count: prompts.length });
    return { prompts };
  }

  /**
   * Handle prompts/get request
   */
  private handlePromptsGet(params: { name: string; arguments?: Record<string, string> }): unknown {
    this.logger.debug('Getting prompt', { name: params.name, arguments: params.arguments });

    try {
      const prompt = this.promptRegistry.getPrompt(params.name, params.arguments || {});

      if (!prompt) {
        throw createError(
          -32003 as ErrorCode, // PromptNotFound
          `Prompt not found: ${params.name}`
        );
      }

      this.logger.info('Prompt retrieved', { name: params.name });
      return prompt;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Missing required argument')) {
        throw createError(
          -32602 as ErrorCode, // InvalidParams
          error.message
        );
      }
      throw error;
    }
  }

  /**
   * Handle resources/list request
   * Returns empty array since resources are not implemented
   */
  private handleResourcesList(): { resources: [] } {
    this.logger.debug('Listing resources');
    // Return empty list since resources are not yet implemented
    // This prevents the "Method not implemented" error while still
    // indicating that resources capability is not supported
    return { resources: [] };
  }

  /**
   * Handle transport errors
   */
  private handleError(error: Error): void {
    this.logger.error('Transport error', { error: error.message });
  }
}
