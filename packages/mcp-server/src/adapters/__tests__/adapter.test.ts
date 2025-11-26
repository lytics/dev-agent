import type { SubagentCoordinator } from '@lytics/dev-agent-subagents';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Adapter } from '../adapter';
import type { AdapterContext, AdapterMetadata } from '../types';

// Concrete implementation for testing
class TestAdapter extends Adapter {
  metadata: AdapterMetadata = {
    name: 'test-adapter',
    version: '1.0.0',
    description: 'Test adapter',
  };

  async initialize(context: AdapterContext): Promise<void> {
    this.initializeBase(context);
  }

  // Expose protected methods for testing
  public testDispatchToAgent(agentName: string, payload: Record<string, unknown>) {
    return this.dispatchToAgent(agentName, payload);
  }

  public testHasCoordinator() {
    return this.hasCoordinator();
  }

  public testSetContext(key: string, value: unknown) {
    return this.setContext(key, value);
  }

  public testGetContext<T>(key: string) {
    return this.getContext<T>(key);
  }

  public testHasContext(key: string) {
    return this.hasContext(key);
  }

  public testSetPersistent(key: string, value: unknown) {
    return this.setPersistent(key, value);
  }

  public testGetPersistent<T>(key: string) {
    return this.getPersistent<T>(key);
  }

  public testHasPersistent(key: string) {
    return this.hasPersistent(key);
  }

  public testDeletePersistent(key: string) {
    return this.deletePersistent(key);
  }

  public testGetHistory(limit?: number) {
    return this.getHistory(limit);
  }
}

describe('Adapter', () => {
  let adapter: TestAdapter;
  let mockCoordinator: SubagentCoordinator;
  let mockContext: AdapterContext;

  beforeEach(() => {
    adapter = new TestAdapter();

    // Mock coordinator
    mockCoordinator = {
      sendMessage: vi.fn().mockResolvedValue({
        id: 'response-1',
        type: 'response',
        sender: 'agent',
        recipient: 'adapter:test-adapter',
        payload: { result: 'success' },
        priority: 5,
        timestamp: Date.now(),
      }),
      getContextManager: vi.fn().mockReturnValue({
        get: vi.fn((key: string) => (key === 'existing-key' ? 'value' : undefined)),
        set: vi.fn(),
        has: vi.fn((key: string) => key === 'existing-key'),
        getHistory: vi.fn(() => [
          {
            id: '1',
            type: 'request',
            sender: 'user',
            recipient: 'agent',
            payload: {},
            priority: 5,
            timestamp: Date.now(),
          },
        ]),
        // Persistent methods
        getPersistent: vi.fn(async (key: string) =>
          key === 'persistent-key' ? 'persistent-value' : undefined
        ),
        setPersistent: vi.fn(),
        hasPersistent: vi.fn(async (key: string) => key === 'persistent-key'),
        deletePersistent: vi.fn(async () => true),
      }),
    } as unknown as SubagentCoordinator;

    mockContext = {
      coordinator: mockCoordinator,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as unknown as AdapterContext;
  });

  describe('metadata', () => {
    it('should have adapter metadata', () => {
      expect(adapter.metadata.name).toBe('test-adapter');
      expect(adapter.metadata.version).toBe('1.0.0');
      expect(adapter.metadata.description).toBe('Test adapter');
    });
  });

  describe('initialization', () => {
    it('should initialize with context', async () => {
      await adapter.initialize(mockContext);

      expect(adapter.testHasCoordinator()).toBe(true);
    });

    it('should store coordinator', async () => {
      await adapter.initialize(mockContext);

      const hasCoordinator = adapter.testHasCoordinator();
      expect(hasCoordinator).toBe(true);
    });

    it('should work without coordinator', async () => {
      const contextWithoutCoordinator = {
        ...mockContext,
        coordinator: undefined,
      };

      await adapter.initialize(contextWithoutCoordinator);

      expect(adapter.testHasCoordinator()).toBe(false);
    });
  });

  describe('hasCoordinator', () => {
    it('should return true when coordinator exists', async () => {
      await adapter.initialize(mockContext);

      expect(adapter.testHasCoordinator()).toBe(true);
    });

    it('should return false when coordinator does not exist', async () => {
      await adapter.initialize({ ...mockContext, coordinator: undefined });

      expect(adapter.testHasCoordinator()).toBe(false);
    });
  });

  describe('dispatchToAgent', () => {
    beforeEach(async () => {
      await adapter.initialize(mockContext);
    });

    it('should dispatch request to agent', async () => {
      const response = await adapter.testDispatchToAgent('explorer', { query: 'test' });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');
      expect(response?.payload.result).toBe('success');
    });

    it('should include sender information', async () => {
      await adapter.testDispatchToAgent('explorer', { query: 'test' });

      expect(mockCoordinator.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: 'adapter:test-adapter',
        })
      );
    });

    it('should include recipient', async () => {
      await adapter.testDispatchToAgent('planner', { issue: 42 });

      expect(mockCoordinator.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'planner',
        })
      );
    });

    it('should include payload', async () => {
      const payload = { query: 'test', limit: 10 };

      await adapter.testDispatchToAgent('explorer', payload);

      expect(mockCoordinator.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload,
        })
      );
    });

    it('should set priority to 5', async () => {
      await adapter.testDispatchToAgent('explorer', {});

      expect(mockCoordinator.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 5,
        })
      );
    });

    it('should return null when no coordinator', async () => {
      await adapter.initialize({ ...mockContext, coordinator: undefined });

      const response = await adapter.testDispatchToAgent('explorer', {});

      expect(response).toBeNull();
    });
  });

  describe('session context', () => {
    beforeEach(async () => {
      await adapter.initialize(mockContext);
    });

    it('should set context value', () => {
      adapter.testSetContext('key', 'value');

      const contextManager = mockCoordinator.getContextManager();
      expect(contextManager?.set).toHaveBeenCalledWith('key', 'value');
    });

    it('should get context value', () => {
      const value = adapter.testGetContext('existing-key');

      expect(value).toBe('value');
    });

    it('should return undefined for non-existent key', () => {
      const value = adapter.testGetContext('non-existent');

      expect(value).toBeUndefined();
    });

    it('should check if context key exists', () => {
      expect(adapter.testHasContext('existing-key')).toBe(true);
      expect(adapter.testHasContext('non-existent')).toBe(false);
    });

    it('should handle no coordinator gracefully', async () => {
      await adapter.initialize({ ...mockContext, coordinator: undefined });

      adapter.testSetContext('key', 'value');
      const value = adapter.testGetContext('key');
      const has = adapter.testHasContext('key');

      expect(value).toBeUndefined();
      expect(has).toBe(false);
    });
  });

  describe('persistent storage', () => {
    beforeEach(async () => {
      await adapter.initialize(mockContext);
    });

    it('should set persistent value', async () => {
      await adapter.testSetPersistent('key', 'value');

      const contextManager = mockCoordinator.getContextManager();
      expect(contextManager?.setPersistent).toHaveBeenCalledWith('key', 'value');
    });

    it('should get persistent value', async () => {
      const value = await adapter.testGetPersistent('persistent-key');

      expect(value).toBe('persistent-value');
    });

    it('should return undefined for non-existent key', async () => {
      const value = await adapter.testGetPersistent('non-existent');

      expect(value).toBeUndefined();
    });

    it('should check if persistent key exists', async () => {
      const exists = await adapter.testHasPersistent('persistent-key');
      const notExists = await adapter.testHasPersistent('non-existent');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should delete persistent value', async () => {
      const deleted = await adapter.testDeletePersistent('persistent-key');

      expect(deleted).toBe(true);
      expect(mockCoordinator.getContextManager()?.deletePersistent).toHaveBeenCalledWith(
        'persistent-key'
      );
    });

    it('should handle no coordinator gracefully', async () => {
      await adapter.initialize({ ...mockContext, coordinator: undefined });

      await adapter.testSetPersistent('key', 'value');
      const value = await adapter.testGetPersistent('key');
      const has = await adapter.testHasPersistent('key');
      const deleted = await adapter.testDeletePersistent('key');

      expect(value).toBeUndefined();
      expect(has).toBe(false);
      expect(deleted).toBe(false);
    });
  });

  describe('conversation history', () => {
    beforeEach(async () => {
      await adapter.initialize(mockContext);
    });

    it('should get conversation history', () => {
      const history = adapter.testGetHistory();

      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('request');
    });

    it('should respect limit parameter', () => {
      adapter.testGetHistory(5);

      expect(mockCoordinator.getContextManager()?.getHistory).toHaveBeenCalledWith(5);
    });

    it('should default to 10 messages', () => {
      adapter.testGetHistory();

      expect(mockCoordinator.getContextManager()?.getHistory).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no coordinator', async () => {
      await adapter.initialize({ ...mockContext, coordinator: undefined });

      const history = adapter.testGetHistory();

      expect(history).toEqual([]);
    });
  });

  describe('lifecycle methods', () => {
    it('should support optional shutdown', async () => {
      class ShutdownAdapter extends TestAdapter {
        shutdownCalled = false;
        async shutdown() {
          this.shutdownCalled = true;
        }
      }

      const adapter = new ShutdownAdapter();
      await adapter.shutdown?.();

      expect(adapter.shutdownCalled).toBe(true);
    });

    it('should support optional healthCheck', async () => {
      class HealthyAdapter extends TestAdapter {
        async healthCheck() {
          return true;
        }
      }

      const adapter = new HealthyAdapter();
      await adapter.initialize(mockContext);

      const healthy = await adapter.healthCheck?.();

      expect(healthy).toBe(true);
    });

    it('should handle missing optional methods', () => {
      expect(adapter.shutdown).toBeUndefined();
      expect(adapter.healthCheck).toBeUndefined();
    });
  });
});
