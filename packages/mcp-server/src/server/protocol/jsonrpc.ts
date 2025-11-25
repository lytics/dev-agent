/**
 * JSON-RPC 2.0 Protocol Handler
 */

import type { JSONRPCError, JSONRPCNotification, JSONRPCRequest, JSONRPCResponse } from './types';
import { ErrorCode } from './types';

/**
 * Parse a JSON-RPC message from string
 */
export function parse(message: string): JSONRPCRequest | JSONRPCNotification {
  try {
    const parsed = JSON.parse(message);

    // Validate JSON-RPC 2.0
    if (parsed.jsonrpc !== '2.0') {
      throw createError(ErrorCode.InvalidRequest, 'Invalid JSON-RPC version, must be "2.0"');
    }

    // Validate method
    if (typeof parsed.method !== 'string') {
      throw createError(ErrorCode.InvalidRequest, 'Missing or invalid "method" field');
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
    throw createError(
      ErrorCode.ParseError,
      error instanceof Error ? error.message : 'Failed to parse JSON'
    );
  }
}

/**
 * Create a success response
 */
export function createResponse(id: string | number, result: unknown): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
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
export function createNotification(
  method: string,
  params?: Record<string, unknown>
): JSONRPCNotification {
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
export function serialize(message: JSONRPCResponse | JSONRPCNotification): string {
  return JSON.stringify(message);
}

/**
 * Create a JSON-RPC error
 */
export function createError(code: ErrorCode, message: string, data?: unknown): JSONRPCError {
  const error: JSONRPCError = { code, message };
  if (data) {
    error.data = data;
  }
  return error;
}

/**
 * Check if a message is a request (has id)
 */
export function isRequest(
  message: JSONRPCRequest | JSONRPCNotification
): message is JSONRPCRequest {
  return 'id' in message && message.id !== undefined;
}

/**
 * Validate request parameters against expected type
 */
export function validateParams(
  params: unknown,
  expectedType: 'object' | 'array'
): params is Record<string, unknown> | unknown[] {
  if (expectedType === 'object') {
    return typeof params === 'object' && params !== null && !Array.isArray(params);
  }
  return Array.isArray(params);
}
