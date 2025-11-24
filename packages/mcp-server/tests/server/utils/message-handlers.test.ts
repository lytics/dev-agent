/**
 * Tests for Message Handler Utilities
 */

import { describe, expect, it } from 'vitest';
import type { ServerInfo } from '../../../src/server/protocol/types';
import {
  createInitializeResult,
  extractToolCallParams,
  isSupportedMethod,
  validateRequest,
} from '../../../src/server/utils/message-handlers';

describe('messageHandlers', () => {
  describe('createInitializeResult', () => {
    it('should create valid initialize result', () => {
      const serverInfo: ServerInfo = {
        name: 'test-server',
        version: '1.0.0',
      };

      const capabilities = {
        tools: { dynamicRegistration: false },
        resources: { dynamicRegistration: false },
        prompts: { dynamicRegistration: false },
      };

      const result = createInitializeResult(serverInfo, capabilities);

      expect(result.protocolVersion).toBe('1.0.0');
      expect(result.serverInfo).toBe(serverInfo);
      expect(result.capabilities).toBe(capabilities);
    });
  });

  describe('extractToolCallParams', () => {
    it('should extract valid tool call params', () => {
      const params = {
        name: 'test_tool',
        arguments: { foo: 'bar' },
      };

      const result = extractToolCallParams(params);

      expect(result).toEqual({
        name: 'test_tool',
        arguments: { foo: 'bar' },
      });
    });

    it('should return null for missing name', () => {
      const params = {
        arguments: { foo: 'bar' },
      };

      const result = extractToolCallParams(params);

      expect(result).toBeNull();
    });

    it('should return null for non-string name', () => {
      const params = {
        name: 123,
        arguments: { foo: 'bar' },
      };

      const result = extractToolCallParams(params);

      expect(result).toBeNull();
    });

    it('should return null for missing arguments', () => {
      const params = {
        name: 'test_tool',
      };

      const result = extractToolCallParams(params);

      expect(result).toBeNull();
    });

    it('should return null for non-object arguments', () => {
      const params = {
        name: 'test_tool',
        arguments: 'not an object',
      };

      const result = extractToolCallParams(params);

      expect(result).toBeNull();
    });

    it('should return null for null arguments', () => {
      const params = {
        name: 'test_tool',
        arguments: null,
      };

      const result = extractToolCallParams(params);

      expect(result).toBeNull();
    });

    it('should return null for undefined params', () => {
      const result = extractToolCallParams(undefined);

      expect(result).toBeNull();
    });

    it('should return null for null params', () => {
      const result = extractToolCallParams(null);

      expect(result).toBeNull();
    });

    it('should return null for non-object params', () => {
      const result = extractToolCallParams('not an object');

      expect(result).toBeNull();
    });
  });

  describe('validateRequest', () => {
    it('should validate valid request', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should validate notification (no id)', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject missing jsonrpc', () => {
      const request = {
        id: 1,
        method: 'test',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject wrong jsonrpc version', () => {
      const request = {
        jsonrpc: '1.0',
        id: 1,
        method: 'test',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject missing method', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject non-string method', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 123,
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject null request', () => {
      expect(validateRequest(null)).toBe(false);
    });

    it('should reject undefined request', () => {
      expect(validateRequest(undefined)).toBe(false);
    });

    it('should reject non-object request', () => {
      expect(validateRequest('not an object')).toBe(false);
    });
  });

  describe('isSupportedMethod', () => {
    it('should return true for initialize', () => {
      expect(isSupportedMethod('initialize')).toBe(true);
    });

    it('should return true for tools/list', () => {
      expect(isSupportedMethod('tools/list')).toBe(true);
    });

    it('should return true for tools/call', () => {
      expect(isSupportedMethod('tools/call')).toBe(true);
    });

    it('should return false for unsupported method', () => {
      expect(isSupportedMethod('unknown/method')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isSupportedMethod('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isSupportedMethod('Initialize')).toBe(false);
      expect(isSupportedMethod('TOOLS/LIST')).toBe(false);
    });
  });
});
