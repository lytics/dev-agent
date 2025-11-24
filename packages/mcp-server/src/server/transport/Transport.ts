/**
 * Transport layer interface for MCP server
 * Abstracts communication mechanism (stdio, HTTP, WebSocket, etc.)
 */

import type { JSONRPCNotification, JSONRPCRequest, JSONRPCResponse } from '../protocol/types';

export type TransportMessage = JSONRPCRequest | JSONRPCNotification;

export interface TransportConfig {
  // Transport-specific configuration
  [key: string]: unknown;
}

export abstract class Transport {
  /**
   * Start the transport (begin listening for messages)
   */
  abstract start(): Promise<void>;

  /**
   * Stop the transport (cleanup resources)
   */
  abstract stop(): Promise<void>;

  /**
   * Send a message through the transport
   */
  abstract send(message: JSONRPCResponse | JSONRPCNotification): Promise<void>;

  /**
   * Set the message handler
   */
  abstract onMessage(handler: (message: TransportMessage) => void | Promise<void>): void;

  /**
   * Set the error handler
   */
  abstract onError(handler: (error: Error) => void): void;

  /**
   * Check if transport is ready
   */
  abstract isReady(): boolean;
}
