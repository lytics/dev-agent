/**
 * Tests for JSON-RPC 2.0 Protocol Handler
 */

import { describe, expect, it } from 'vitest';
import { JSONRPCHandler } from '../../src/server/protocol/jsonrpc';
import { ErrorCode } from '../../src/server/protocol/types';

describe('JSONRPCHandler', () => {
  describe('parse', () => {
    it('should parse valid JSON-RPC request', () => {
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: { foo: 'bar' },
      });

      const result = JSONRPCHandler.parse(message);

      expect(result).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: { foo: 'bar' },
      });
    });

    it('should parse notification (no id)', () => {
      const message = JSON.stringify({
        jsonrpc: '2.0',
        method: 'notify',
      });

      const result = JSONRPCHandler.parse(message);

      expect(result).toEqual({
        jsonrpc: '2.0',
        method: 'notify',
      });
      expect('id' in result).toBe(false);
    });

    it('should throw on invalid JSON', () => {
      expect(() => JSONRPCHandler.parse('not json')).toThrow();
    });

    it('should throw on missing jsonrpc field', () => {
      const message = JSON.stringify({
        id: 1,
        method: 'test',
      });

      expect(() => JSONRPCHandler.parse(message)).toThrow();
    });

    it('should throw on wrong jsonrpc version', () => {
      const message = JSON.stringify({
        jsonrpc: '1.0',
        id: 1,
        method: 'test',
      });

      expect(() => JSONRPCHandler.parse(message)).toThrow();
    });

    it('should throw on missing method', () => {
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
      });

      expect(() => JSONRPCHandler.parse(message)).toThrow();
    });
  });

  describe('createResponse', () => {
    it('should create success response', () => {
      const response = JSONRPCHandler.createResponse(1, { result: 'ok' });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { result: 'ok' },
      });
    });

    it('should handle string id', () => {
      const response = JSONRPCHandler.createResponse('test-id', 'success');

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 'test-id',
        result: 'success',
      });
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response', () => {
      const error = {
        code: ErrorCode.InvalidParams,
        message: 'Invalid parameters',
      };

      const response = JSONRPCHandler.createErrorResponse(1, error);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: ErrorCode.InvalidParams,
          message: 'Invalid parameters',
        },
      });
    });

    it('should handle undefined id', () => {
      const error = {
        code: ErrorCode.ParseError,
        message: 'Parse error',
      };

      const response = JSONRPCHandler.createErrorResponse(undefined, error);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.error).toEqual(error);
    });
  });

  describe('createNotification', () => {
    it('should create notification without params', () => {
      const notification = JSONRPCHandler.createNotification('test');

      expect(notification).toEqual({
        jsonrpc: '2.0',
        method: 'test',
      });
      expect('id' in notification).toBe(false);
    });

    it('should create notification with params', () => {
      const notification = JSONRPCHandler.createNotification('test', { foo: 'bar' });

      expect(notification).toEqual({
        jsonrpc: '2.0',
        method: 'test',
        params: { foo: 'bar' },
      });
    });
  });

  describe('serialize', () => {
    it('should serialize response to JSON string', () => {
      const response = {
        jsonrpc: '2.0' as const,
        id: 1,
        result: { success: true },
      };

      const serialized = JSONRPCHandler.serialize(response);

      expect(JSON.parse(serialized)).toEqual(response);
    });

    it('should serialize notification to JSON string', () => {
      const notification = {
        jsonrpc: '2.0' as const,
        method: 'test',
        params: { data: 'value' },
      };

      const serialized = JSONRPCHandler.serialize(notification);

      expect(JSON.parse(serialized)).toEqual(notification);
    });
  });

  describe('createError', () => {
    it('should create error object', () => {
      const error = JSONRPCHandler.createError(ErrorCode.InvalidRequest, 'Invalid request');

      expect(error).toEqual({
        code: ErrorCode.InvalidRequest,
        message: 'Invalid request',
      });
    });

    it('should include data if provided', () => {
      const error = JSONRPCHandler.createError(ErrorCode.InternalError, 'Internal error', {
        details: 'something went wrong',
      });

      expect(error).toEqual({
        code: ErrorCode.InternalError,
        message: 'Internal error',
        data: { details: 'something went wrong' },
      });
    });
  });

  describe('isRequest', () => {
    it('should return true for request (has id)', () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test',
      };

      expect(JSONRPCHandler.isRequest(request)).toBe(true);
    });

    it('should return false for notification (no id)', () => {
      const notification = {
        jsonrpc: '2.0' as const,
        method: 'test',
      };

      expect(JSONRPCHandler.isRequest(notification)).toBe(false);
    });
  });

  describe('validateParams', () => {
    it('should validate object params', () => {
      const params = { foo: 'bar' };
      expect(JSONRPCHandler.validateParams(params, 'object')).toBe(true);
    });

    it('should reject array when expecting object', () => {
      const params = ['foo', 'bar'];
      expect(JSONRPCHandler.validateParams(params, 'object')).toBe(false);
    });

    it('should validate array params', () => {
      const params = [1, 2, 3];
      expect(JSONRPCHandler.validateParams(params, 'array')).toBe(true);
    });

    it('should reject object when expecting array', () => {
      const params = { foo: 'bar' };
      expect(JSONRPCHandler.validateParams(params, 'array')).toBe(false);
    });

    it('should reject null', () => {
      expect(JSONRPCHandler.validateParams(null, 'object')).toBe(false);
      expect(JSONRPCHandler.validateParams(null, 'array')).toBe(false);
    });
  });
});
