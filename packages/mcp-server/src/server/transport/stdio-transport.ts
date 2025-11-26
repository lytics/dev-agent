/**
 * Stdio Transport for MCP Server
 * Communicates via standard input/output streams
 */

import * as readline from 'node:readline';
import { parse, serialize } from '../protocol/jsonrpc';
import type { JSONRPCNotification, JSONRPCResponse } from '../protocol/types';
import { Transport, type TransportMessage } from './transport';

export class StdioTransport extends Transport {
  private messageHandler?: (message: TransportMessage) => void | Promise<void>;
  private errorHandler?: (error: Error) => void;
  private ready = false;
  private readline?: readline.Interface;
  private isGracefulShutdown = false;

  async start(): Promise<void> {
    if (this.ready) {
      return;
    }

    // Create readline interface for line-by-line input
    // Note: We don't specify 'output' to avoid readline echoing input to stdout
    this.readline = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    // Handle incoming lines
    this.readline.on('line', (line: string) => {
      this.handleIncomingMessage(line);
    });

    // Handle errors
    this.readline.on('error', (error: Error) => {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    });

    // Handle stdin closure (when IDE closes)
    this.readline.on('close', () => {
      // Only exit if this wasn't a graceful shutdown initiated by stop()
      if (!this.isGracefulShutdown) {
        // IDE closed the connection unexpectedly, exit gracefully
        process.exit(0);
      }
    });

    process.stdin.on('end', () => {
      // Only exit if this wasn't a graceful shutdown initiated by stop()
      if (!this.isGracefulShutdown) {
        // Stdin stream ended unexpectedly, exit gracefully
        process.exit(0);
      }
    });

    // Handle process exit signals
    process.on('SIGINT', () => {
      void this.stop();
    });

    process.on('SIGTERM', () => {
      void this.stop();
    });

    this.ready = true;
  }

  async stop(): Promise<void> {
    if (!this.ready) {
      return;
    }

    // Mark as graceful shutdown to prevent process.exit() in close handler
    this.isGracefulShutdown = true;

    if (this.readline) {
      this.readline.close();
      this.readline = undefined;
    }

    this.ready = false;
  }

  async send(message: JSONRPCResponse | JSONRPCNotification): Promise<void> {
    if (!this.ready) {
      throw new Error('Transport not ready');
    }

    const serialized = serialize(message);

    // Write to stdout with newline
    process.stdout.write(`${serialized}\n`);
  }

  onMessage(handler: (message: TransportMessage) => void | Promise<void>): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  isReady(): boolean {
    return this.ready;
  }

  private handleIncomingMessage(line: string): void {
    if (!this.messageHandler) {
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      return; // Skip empty lines
    }

    try {
      const message = parse(trimmed);
      void this.messageHandler(message);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
}
