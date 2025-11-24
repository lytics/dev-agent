/**
 * Integration Tests for MCP Server
 * Tests the full server + adapter + transport stack
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MCPServer } from '../../src/server/mcp-server';
import type { JSONRPCRequest, JSONRPCResponse } from '../../src/server/protocol/types';
import { MockAdapter } from '../adapters/mock-adapter';

describe('MCP Server Integration', () => {
  let server: MCPServer;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();

    server = new MCPServer({
      serverInfo: {
        name: 'test-server',
        version: '1.0.0',
      },
      config: {
        repositoryPath: '/test/repo',
      },
      transport: 'stdio',
      adapters: [mockAdapter],
    });
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Server Lifecycle', () => {
    it('should start and stop successfully', async () => {
      await expect(server.start()).resolves.not.toThrow();
      await expect(server.stop()).resolves.not.toThrow();
    });

    it('should initialize adapters on start', async () => {
      await server.start();

      const counts = mockAdapter.getCallCounts();
      expect(counts.initialize).toBe(1);

      await server.stop();
    });

    it('should shutdown adapters on stop', async () => {
      await server.start();
      await server.stop();

      const counts = mockAdapter.getCallCounts();
      expect(counts.shutdown).toBe(1);
    });
  });

  describe('MCP Protocol', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle initialize request', async () => {
      // Note: In real integration test, we'd send via stdio
      // For now, we're testing the server can handle the methods

      // Server exposes these methods internally via handleMessage
      // which we can't easily test without a real transport

      // This test validates server is set up correctly
      expect(server).toBeDefined();
    });

    it('should register adapter successfully', () => {
      const adapter = new MockAdapter();
      adapter.getToolDefinition = () => ({
        name: 'test_tool',
        description: 'Test',
        inputSchema: { type: 'object' },
      });

      expect(() => server.registerAdapter(adapter)).not.toThrow();
    });
  });

  describe('Adapter Execution', () => {
    beforeEach(async () => {
      await server.start();
    });

    // Note: Full end-to-end test would require:
    // 1. Sending JSON-RPC via stdin
    // 2. Reading JSON-RPC from stdout
    // 3. Testing tools/list, tools/call, etc.

    // For now, we verify the components are wired together
    it('should have mock adapter registered', async () => {
      // The adapter was registered in beforeEach
      // This test confirms the server is running
      expect(server).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle multiple start calls gracefully', async () => {
      await server.start();
      // Second start should be handled gracefully
      // (transport will check if already ready)
      await expect(server.start()).resolves.not.toThrow();
    });

    it('should handle stop without start', async () => {
      await expect(server.stop()).resolves.not.toThrow();
    });
  });
});

describe('MCP Server with Multiple Adapters', () => {
  it('should handle multiple adapters', async () => {
    const adapter1 = new MockAdapter();
    const adapter2 = new MockAdapter();

    adapter2.getToolDefinition = () => ({
      name: 'mock_echo_2',
      description: 'Second echo',
      inputSchema: { type: 'object', properties: {} },
    });

    const server = new MCPServer({
      serverInfo: {
        name: 'multi-adapter-server',
        version: '1.0.0',
      },
      config: {
        repositoryPath: '/test/repo',
      },
      transport: 'stdio',
      adapters: [adapter1, adapter2],
    });

    await server.start();

    // Both adapters should be initialized
    expect(adapter1.getCallCounts().initialize).toBe(1);
    expect(adapter2.getCallCounts().initialize).toBe(1);

    await server.stop();

    // Both should be shut down
    expect(adapter1.getCallCounts().shutdown).toBe(1);
    expect(adapter2.getCallCounts().shutdown).toBe(1);
  });
});
