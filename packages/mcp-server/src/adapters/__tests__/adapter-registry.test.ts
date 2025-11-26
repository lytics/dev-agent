/**
 * Tests for Adapter Registry
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { AdapterRegistry } from '../adapter-registry';
import type { AdapterContext } from '../types';
import { MockAdapter } from './mock-adapter';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;
  let mockAdapter: MockAdapter;
  let context: AdapterContext;

  beforeEach(() => {
    registry = new AdapterRegistry();
    mockAdapter = new MockAdapter();
    context = {
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      config: {
        repositoryPath: '/test/repo',
      },
    };
  });

  describe('register', () => {
    it('should register adapter', () => {
      registry.register(mockAdapter);

      expect(registry.hasTool('mock_echo')).toBe(true);
    });

    it('should throw if adapter already registered', () => {
      registry.register(mockAdapter);

      expect(() => registry.register(mockAdapter)).toThrow('Adapter already registered: mock_echo');
    });
  });

  describe('unregister', () => {
    it('should unregister adapter', async () => {
      registry.register(mockAdapter);
      await registry.initializeAll(context);

      await registry.unregister('mock_echo');

      expect(registry.hasTool('mock_echo')).toBe(false);
    });

    it('should call shutdown on unregister', async () => {
      registry.register(mockAdapter);
      await registry.initializeAll(context);

      await registry.unregister('mock_echo');

      const counts = mockAdapter.getCallCounts();
      expect(counts.shutdown).toBe(1);
    });

    it('should not throw if adapter not found', async () => {
      await expect(registry.unregister('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('initializeAll', () => {
    it('should initialize all adapters', async () => {
      registry.register(mockAdapter);

      await registry.initializeAll(context);

      const counts = mockAdapter.getCallCounts();
      expect(counts.initialize).toBe(1);
    });

    it('should initialize multiple adapters', async () => {
      const adapter1 = new MockAdapter();
      const adapter2 = new MockAdapter();

      // Change name to avoid conflict
      adapter2.metadata.name = 'mock-adapter-2';
      adapter2.getToolDefinition = () => ({
        name: 'mock_echo_2',
        description: 'Second mock',
        inputSchema: { type: 'object', properties: {} },
      });

      registry.register(adapter1);
      registry.register(adapter2);

      await registry.initializeAll(context);

      expect(adapter1.getCallCounts().initialize).toBe(1);
      expect(adapter2.getCallCounts().initialize).toBe(1);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return empty array when no adapters', () => {
      expect(registry.getToolDefinitions()).toEqual([]);
    });

    it('should return tool definitions', () => {
      registry.register(mockAdapter);

      const definitions = registry.getToolDefinitions();

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe('mock_echo');
    });
  });

  describe('executeTool', () => {
    beforeEach(async () => {
      registry.register(mockAdapter);
      await registry.initializeAll(context);
    });

    it('should execute tool successfully', async () => {
      const result = await registry.executeTool('mock_echo', { message: 'hello' }, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        echo: 'hello',
        timestamp: expect.any(String),
      });
    });

    it('should return error for nonexistent tool', async () => {
      const result = await registry.executeTool('nonexistent', {}, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('-32000');
      expect(result.error?.message).toContain('not found');
    });

    it('should validate arguments if adapter has validate', async () => {
      const result = await registry.executeTool(
        'mock_echo',
        { message: 123 }, // Invalid: should be string
        context
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('-32602');
      expect(result.error?.message).toBe('message must be a string');
    });

    it('should include execution time in metadata', async () => {
      const result = await registry.executeTool('mock_echo', { message: 'test' }, context);

      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle tool execution errors', async () => {
      // Create adapter that throws
      const errorAdapter = new MockAdapter();
      errorAdapter.validate = () => ({ valid: true }); // Skip validation
      errorAdapter.execute = async () => {
        throw new Error('Tool failed');
      };
      errorAdapter.getToolDefinition = () => ({
        name: 'error_tool',
        description: 'Fails',
        inputSchema: { type: 'object' },
      });

      registry.register(errorAdapter);
      await registry.initializeAll(context);

      const result = await registry.executeTool('error_tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('-32001');
      expect(result.error?.message).toContain('Tool failed');
    });
  });

  describe('getAdapter', () => {
    it('should return adapter by name', () => {
      registry.register(mockAdapter);

      const adapter = registry.getAdapter('mock_echo');

      expect(adapter).toBe(mockAdapter);
    });

    it('should return undefined for nonexistent adapter', () => {
      expect(registry.getAdapter('nonexistent')).toBeUndefined();
    });
  });

  describe('getToolNames', () => {
    it('should return empty array when no adapters', () => {
      expect(registry.getToolNames()).toEqual([]);
    });

    it('should return all tool names', () => {
      registry.register(mockAdapter);

      expect(registry.getToolNames()).toEqual(['mock_echo']);
    });
  });

  describe('hasTool', () => {
    it('should return false when tool not registered', () => {
      expect(registry.hasTool('mock_echo')).toBe(false);
    });

    it('should return true when tool is registered', () => {
      registry.register(mockAdapter);

      expect(registry.hasTool('mock_echo')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return stats', () => {
      registry.register(mockAdapter);

      const stats = registry.getStats();

      expect(stats.totalAdapters).toBe(1);
      expect(stats.toolNames).toEqual(['mock_echo']);
    });
  });

  describe('shutdownAll', () => {
    it('should shutdown all adapters', async () => {
      registry.register(mockAdapter);
      await registry.initializeAll(context);

      await registry.shutdownAll();

      const counts = mockAdapter.getCallCounts();
      expect(counts.shutdown).toBe(1);
    });

    it('should clear all adapters', async () => {
      registry.register(mockAdapter);
      await registry.initializeAll(context);

      await registry.shutdownAll();

      expect(registry.getStats().totalAdapters).toBe(0);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limits by default', async () => {
      const limitedRegistry = new AdapterRegistry({
        rateLimitCapacity: 3,
        rateLimitRefillRate: 1,
      });

      limitedRegistry.register(mockAdapter);
      await limitedRegistry.initializeAll(context);

      const executionContext = { logger: context.logger, requestId: 'test' };

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const result = await limitedRegistry.executeTool(
          'mock_echo',
          { message: 'test' },
          executionContext
        );
        expect(result.success).toBe(true);
      }

      // 4th request should be rate limited
      const result = await limitedRegistry.executeTool(
        'mock_echo',
        { message: 'test' },
        executionContext
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('429');
      expect(result.error?.message).toContain('Rate limit exceeded');
    });

    it('should allow disabling rate limiting', async () => {
      const unlimitedRegistry = new AdapterRegistry({
        enableRateLimiting: false,
      });

      unlimitedRegistry.register(mockAdapter);
      await unlimitedRegistry.initializeAll(context);

      const executionContext = { logger: context.logger, requestId: 'test' };

      // Should allow unlimited requests
      for (let i = 0; i < 100; i++) {
        const result = await unlimitedRegistry.executeTool(
          'mock_echo',
          { message: 'test' },
          executionContext
        );
        expect(result.success).toBe(true);
      }
    });

    it('should track rate limits per tool independently', async () => {
      const multiToolRegistry = new AdapterRegistry({
        rateLimitCapacity: 2,
        rateLimitRefillRate: 1,
      });

      const secondAdapter = new MockAdapter('mock_echo_2');
      multiToolRegistry.register(mockAdapter);
      multiToolRegistry.register(secondAdapter);
      await multiToolRegistry.initializeAll(context);

      const executionContext = { logger: context.logger, requestId: 'test' };

      // Exhaust first tool
      await multiToolRegistry.executeTool('mock_echo', { message: 'test' }, executionContext);
      await multiToolRegistry.executeTool('mock_echo', { message: 'test' }, executionContext);

      // First tool should be rate limited
      const result1 = await multiToolRegistry.executeTool(
        'mock_echo',
        { message: 'test' },
        executionContext
      );
      expect(result1.success).toBe(false);
      expect(result1.error?.code).toBe('429');

      // Second tool should still work
      const result2 = await multiToolRegistry.executeTool(
        'mock_echo_2',
        { message: 'test' },
        executionContext
      );
      expect(result2.success).toBe(true);
    });

    it('should provide rate limit status', () => {
      const statusRegistry = new AdapterRegistry({
        rateLimitCapacity: 10,
        rateLimitRefillRate: 1,
      });

      const status = statusRegistry.getRateLimitStatus();
      expect(status).not.toBeNull();
      expect(status instanceof Map).toBe(true);
    });

    it('should allow resetting rate limits', async () => {
      const resetRegistry = new AdapterRegistry({
        rateLimitCapacity: 2,
        rateLimitRefillRate: 1,
      });

      resetRegistry.register(mockAdapter);
      await resetRegistry.initializeAll(context);

      const executionContext = { logger: context.logger, requestId: 'test' };

      // Exhaust rate limit
      await resetRegistry.executeTool('mock_echo', { message: 'test' }, executionContext);
      await resetRegistry.executeTool('mock_echo', { message: 'test' }, executionContext);

      // Should be rate limited
      let result = await resetRegistry.executeTool(
        'mock_echo',
        { message: 'test' },
        executionContext
      );
      expect(result.success).toBe(false);

      // Reset rate limit
      resetRegistry.resetRateLimit('mock_echo');

      // Should work again
      result = await resetRegistry.executeTool('mock_echo', { message: 'test' }, executionContext);
      expect(result.success).toBe(true);
    });
  });
});
