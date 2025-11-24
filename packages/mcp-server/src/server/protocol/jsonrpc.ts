/**
 * JSON-RPC 2.0 Protocol Handler
 */

import type { JSONRPCError, JSONRPCNotification, JSONRPCRequest, JSONRPCResponse } from './types';
import { ErrorCode } from './types';

export class JSONRPCHandler {
  /**
   * Parse a JSON-RPC message from string
   */
  static parse(message: string): JSONRPCRequest | JSONRPCNotification {
    try {
      const parsed = JSON.parse(message);

      // Validate JSON-RPC 2.0
      if (parsed.jsonrpc !== '2.0') {
        throw JSONRPCHandler.createError(
          ErrorCode.InvalidRequest,
          'Invalid JSON-RPC version, must be "2.0"'
        );
      }

      // Validate method
      if (typeof parsed.method !== 'string') {
        throw JSONRPCHandler.createError(
          ErrorCode.InvalidRequest,
          'Missing or invalid "method" field'
        );
      }

      // Request (has id) or Notification (no id)
      if (parsed.id !== undefined) {
        return parsed as JSONRPCRequest;
      }

      return parsed as JSONRPCNotification;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw JSONRPCError
      }
      throw JSONRPCHandler.createError(
        ErrorCode.ParseError,
        error instanceof Error ? error.message : 'Failed to parse JSON'
      );
    }
  }

  /**
   * Create a success response
   */
  static createResponse(id: string | number, result: unknown): JSONRPCResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * Create an error response
   */
  static createErrorResponse(
    id: string | number | undefined,
    error: JSONRPCError
  ): JSONRPCResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? (null as unknown as number),
      error,
    };
  }

  /**
   * Create a notification
   */
  static createNotification(method: string, params?: Record<string, unknown>): JSONRPCNotification {
    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
    };

    if (params) {
      notification.params = params;
    }

    return notification;
  }

  /**
   * Serialize a JSON-RPC message to string
   */
  static serialize(message: JSONRPCResponse | JSONRPCNotification): string {
    return JSON.stringify(message);
  }

  /**
   * Create a JSON-RPC error
   */
  static createError(code: ErrorCode, message: string, data?: unknown): JSONRPCError {
    const error: JSONRPCError = { code, message };
    if (data) {
      error.data = data;
    }
    return error;
  }

  /**
   * Check if a message is a request (has id)
   */
  static isRequest(message: JSONRPCRequest | JSONRPCNotification): message is JSONRPCRequest {
    return 'id' in message && message.id !== undefined;
  }

  /**
   * Validate request parameters against expected type
   */
  static validateParams(
    params: unknown,
    expectedType: 'object' | 'array'
  ): params is Record<string, unknown> | unknown[] {
    if (expectedType === 'object') {
      return typeof params === 'object' && params !== null && !Array.isArray(params);
    }
    return Array.isArray(params);
  }
}
