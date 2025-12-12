/**
 * Event Bus Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncEventBus, createTypedEventBus } from '../event-bus';
import type { SystemEventMap } from '../types';

describe('AsyncEventBus', () => {
  let bus: AsyncEventBus;

  beforeEach(() => {
    bus = new AsyncEventBus();
  });

  afterEach(() => {
    bus.removeAllListeners();
  });

  describe('on/emit', () => {
    it('should subscribe and receive events', async () => {
      const handler = vi.fn();
      bus.on('test.event', handler);

      await bus.emit('test.event', { data: 'hello' });

      // Allow async handler to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'hello' });
    });

    it('should support multiple handlers for same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('test.event', handler1);
      bus.on('test.event', handler2);

      await bus.emit('test.event', { value: 42 });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should support async handlers', async () => {
      const results: number[] = [];

      bus.on('async.event', async (payload: { delay: number; value: number }) => {
        await new Promise((resolve) => setTimeout(resolve, payload.delay));
        results.push(payload.value);
      });

      await bus.emit('async.event', { delay: 10, value: 1 });
      await bus.emit('async.event', { delay: 5, value: 2 });

      // Wait for both handlers to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toContain(1);
      expect(results).toContain(2);
    });

    it('should execute handlers in priority order when waiting', async () => {
      const order: number[] = [];

      bus.on(
        'priority.event',
        () => {
          order.push(1);
        },
        { priority: 1 }
      );
      bus.on(
        'priority.event',
        () => {
          order.push(3);
        },
        { priority: 3 }
      );
      bus.on(
        'priority.event',
        () => {
          order.push(2);
        },
        { priority: 2 }
      );

      await bus.emit('priority.event', {}, { waitForHandlers: true });

      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe('once', () => {
    it('should only trigger once', async () => {
      const handler = vi.fn();
      bus.once('once.event', handler);

      await bus.emit('once.event', { first: true });
      await bus.emit('once.event', { second: true });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ first: true });
    });
  });

  describe('off', () => {
    it('should unsubscribe handler', async () => {
      const handler = vi.fn();
      bus.on('unsub.event', handler);

      await bus.emit('unsub.event', { before: true });
      await new Promise((resolve) => setTimeout(resolve, 10));

      bus.off('unsub.event', handler);

      await bus.emit('unsub.event', { after: true });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ before: true });
    });

    it('should unsubscribe via returned function', async () => {
      const handler = vi.fn();
      const unsubscribe = bus.on('unsub.event', handler);

      await bus.emit('unsub.event', { before: true });
      await new Promise((resolve) => setTimeout(resolve, 10));

      unsubscribe();

      await bus.emit('unsub.event', { after: true });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitFor', () => {
    it('should wait for event and resolve with payload', async () => {
      // Emit after a delay
      setTimeout(() => {
        bus.emit('wait.event', { value: 'resolved' });
      }, 50);

      const result = await bus.waitFor<{ value: string }>('wait.event', 1000);

      expect(result).toEqual({ value: 'resolved' });
    });

    it('should timeout if event not received', async () => {
      await expect(bus.waitFor('never.event', 50)).rejects.toThrow('Timeout');
    });
  });

  describe('listenerCount', () => {
    it('should return correct count', () => {
      expect(bus.listenerCount('count.event')).toBe(0);

      bus.on('count.event', () => {});
      expect(bus.listenerCount('count.event')).toBe(1);

      bus.on('count.event', () => {});
      expect(bus.listenerCount('count.event')).toBe(2);
    });
  });

  describe('eventNames', () => {
    it('should return all registered event names', () => {
      bus.on('event.a', () => {});
      bus.on('event.b', () => {});
      bus.on('event.c', () => {});

      const names = bus.eventNames();

      expect(names).toHaveLength(3);
      expect(names).toContain('event.a');
      expect(names).toContain('event.b');
      expect(names).toContain('event.c');
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for specific event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('remove.a', handler1);
      bus.on('remove.b', handler2);

      bus.removeAllListeners('remove.a');

      await bus.emit('remove.a', {});
      await bus.emit('remove.b', {});
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should remove all listeners when no event specified', () => {
      bus.on('event.a', () => {});
      bus.on('event.b', () => {});

      bus.removeAllListeners();

      expect(bus.eventNames()).toHaveLength(0);
    });
  });

  describe('waitForHandlers option', () => {
    it('should wait for all handlers to complete', async () => {
      const results: string[] = [];

      bus.on('wait.handlers', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        results.push('handler1');
      });

      bus.on('wait.handlers', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        results.push('handler2');
      });

      await bus.emit('wait.handlers', {}, { waitForHandlers: true });

      // Both handlers should have completed
      expect(results).toContain('handler1');
      expect(results).toContain('handler2');
    });
  });

  describe('error handling', () => {
    it('should not crash on handler error', async () => {
      // Mock console.error to suppress expected error logs in test output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const goodHandler = vi.fn();

      bus.on('error.event', errorHandler);
      bus.on('error.event', goodHandler);

      // Should not throw
      await bus.emit('error.event', {});
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
});

describe('createTypedEventBus', () => {
  it('should create a typed event bus', async () => {
    const bus = createTypedEventBus<SystemEventMap>();

    const handler = vi.fn();
    bus.on('index.updated', handler);

    await bus.emit('index.updated', {
      type: 'code',
      documentsCount: 100,
      duration: 1000,
      path: '/test',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(handler).toHaveBeenCalledWith({
      type: 'code',
      documentsCount: 100,
      duration: 1000,
      path: '/test',
    });
  });

  it('should provide type safety for event payloads', () => {
    const bus = createTypedEventBus<SystemEventMap>();

    // This compiles because the payload type is correct
    bus.on('health.changed', (event) => {
      // TypeScript knows event is HealthChangedEvent
      const _status: 'healthy' | 'degraded' | 'unhealthy' = event.currentStatus;
    });

    // Type checking happens at compile time, so we just verify it doesn't throw
    expect(true).toBe(true);
  });
});
