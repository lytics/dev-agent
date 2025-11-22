import { beforeEach, describe, expect, it } from 'vitest';
import { CoordinatorLogger } from '../logger';
import type { Task } from '../types';
import { TaskQueue } from './task-queue';

describe('TaskQueue', () => {
  let queue: TaskQueue;
  let logger: CoordinatorLogger;

  beforeEach(() => {
    logger = new CoordinatorLogger('test-queue', 'error'); // Quiet during tests
    queue = new TaskQueue(2, logger); // max 2 concurrent
  });

  const createMockTask = (id: string, priority = 5, type = 'test'): Task => ({
    id,
    type,
    agentName: 'test-agent',
    payload: { action: 'test' },
    priority,
    status: 'pending',
    createdAt: Date.now(),
    retries: 0,
    maxRetries: 3,
  });

  describe('task management', () => {
    it('should enqueue tasks', () => {
      const task = createMockTask('task-1');
      queue.enqueue(task);

      const retrieved = queue.get('task-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('task-1');
    });

    it('should throw when enqueueing duplicate task IDs', () => {
      const task = createMockTask('task-1');
      queue.enqueue(task);

      expect(() => queue.enqueue(task)).toThrow('already exists');
    });

    it('should retrieve task by id', () => {
      const task = createMockTask('task-1');
      queue.enqueue(task);

      const retrieved = queue.get('task-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('task-1');
    });

    it('should return undefined for non-existent task', () => {
      const task = queue.get('non-existent');
      expect(task).toBeUndefined();
    });
  });

  describe('priority sorting', () => {
    it('should return highest priority task first (higher number = higher priority)', () => {
      queue.enqueue(createMockTask('task-low', 1));
      queue.enqueue(createMockTask('task-high', 10));
      queue.enqueue(createMockTask('task-med', 5));

      const next = queue.getNext();
      expect(next?.id).toBe('task-high');
    });

    it('should return oldest task when priorities are equal', async () => {
      queue.enqueue(createMockTask('task-1', 5));
      await new Promise((resolve) => setTimeout(resolve, 10));
      queue.enqueue(createMockTask('task-2', 5));

      const next = queue.getNext();
      expect(next?.id).toBe('task-1'); // Created first
    });

    it('should return null when no pending tasks', () => {
      const task = createMockTask('task-1');
      queue.enqueue(task);
      queue.markRunning('task-1');

      expect(queue.getNext()).toBeNull();
    });
  });

  describe('task status management', () => {
    it('should mark task as running', () => {
      const task = createMockTask('task-1');
      queue.enqueue(task);
      queue.markRunning('task-1');

      const updated = queue.get('task-1');
      expect(updated?.status).toBe('running');
      expect(updated?.startedAt).toBeDefined();
    });

    it('should mark task as completed', () => {
      const task = createMockTask('task-1');
      queue.enqueue(task);
      queue.markRunning('task-1');
      queue.markCompleted('task-1', { result: 'success' });

      const updated = queue.get('task-1');
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
      expect(updated?.result).toEqual({ result: 'success' });
    });

    it('should mark task as failed with error', () => {
      const task = createMockTask('task-1');
      queue.enqueue(task);
      queue.markRunning('task-1');

      const error = new Error('Test error');
      queue.markFailed('task-1', error);

      const updated = queue.get('task-1');
      expect(updated?.status).toBe('failed');
      expect(updated?.error).toBe(error);
    });

    it('should cancel task', () => {
      const task = createMockTask('task-1');
      queue.enqueue(task);
      queue.cancel('task-1');

      const updated = queue.get('task-1');
      expect(updated?.status).toBe('cancelled');
    });
  });

  describe('retry logic', () => {
    it('should check if task should be retried', () => {
      const task = createMockTask('task-1');
      task.maxRetries = 2;
      queue.enqueue(task);
      queue.markRunning('task-1');
      queue.markFailed('task-1', new Error('Test'));

      expect(queue.shouldRetry('task-1')).toBe(true);
    });

    it('should not retry task that exceeded max retries', () => {
      const task = createMockTask('task-1');
      task.maxRetries = 0;
      queue.enqueue(task);
      queue.markRunning('task-1');
      queue.markFailed('task-1', new Error('Test'));

      expect(queue.shouldRetry('task-1')).toBe(false);
    });

    it('should retry a failed task', () => {
      const task = createMockTask('task-1');
      task.maxRetries = 2;
      queue.enqueue(task);
      queue.markRunning('task-1');
      queue.markFailed('task-1', new Error('Test'));

      queue.retry('task-1');

      const updated = queue.get('task-1');
      expect(updated?.status).toBe('pending');
      expect(updated?.retries).toBe(1);
      expect(updated?.error).toBeUndefined();
    });

    it('should throw when retrying non-retriable task', () => {
      const task = createMockTask('task-1');
      task.maxRetries = 0;
      queue.enqueue(task);
      queue.markRunning('task-1');
      queue.markFailed('task-1', new Error('Test'));

      expect(() => queue.retry('task-1')).toThrow('cannot be retried');
    });
  });

  describe('concurrency control', () => {
    it('should track running tasks', () => {
      queue.enqueue(createMockTask('task-1'));
      queue.enqueue(createMockTask('task-2'));

      expect(queue.getRunningCount()).toBe(0);
      expect(queue.canRunMore()).toBe(true);

      queue.markRunning('task-1');
      expect(queue.getRunningCount()).toBe(1);
      expect(queue.canRunMore()).toBe(true);

      queue.markRunning('task-2');
      expect(queue.getRunningCount()).toBe(2);
      expect(queue.canRunMore()).toBe(false); // max is 2
    });

    it('should allow more tasks after completion', () => {
      queue.enqueue(createMockTask('task-1'));
      queue.enqueue(createMockTask('task-2'));

      queue.markRunning('task-1');
      queue.markRunning('task-2');
      expect(queue.canRunMore()).toBe(false);

      queue.markCompleted('task-1');
      expect(queue.canRunMore()).toBe(true);
      expect(queue.getRunningCount()).toBe(1);
    });
  });

  describe('statistics', () => {
    it('should return queue statistics', () => {
      queue.enqueue(createMockTask('task-1'));
      queue.enqueue(createMockTask('task-2'));
      queue.enqueue(createMockTask('task-3'));

      queue.markRunning('task-1');
      queue.markCompleted('task-1');
      queue.markRunning('task-2');
      queue.markFailed('task-2', new Error('Test'));
      queue.cancel('task-3');

      const stats = queue.getStats();
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.pending).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.maxConcurrent).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should clean up old completed tasks', async () => {
      queue.enqueue(createMockTask('task-1'));
      queue.enqueue(createMockTask('task-2'));

      queue.markRunning('task-1');
      queue.markCompleted('task-1');

      // Wait a bit, then cleanup tasks older than 10ms
      await new Promise((resolve) => setTimeout(resolve, 20));
      const cleaned = queue.cleanup(10);

      expect(cleaned).toBe(1);
      expect(queue.get('task-1')).toBeUndefined();
      expect(queue.get('task-2')).toBeDefined(); // Still pending
    });

    it('should not clean up running or pending tasks', () => {
      queue.enqueue(createMockTask('task-1'));
      queue.enqueue(createMockTask('task-2'));

      queue.markRunning('task-1');

      const cleaned = queue.cleanup(0); // Clean everything older than 0ms

      expect(cleaned).toBe(0);
      expect(queue.get('task-1')).toBeDefined();
      expect(queue.get('task-2')).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw when marking non-existent task as running', () => {
      expect(() => queue.markRunning('non-existent')).toThrow('not found');
    });

    it('should throw when marking non-existent task as completed', () => {
      expect(() => queue.markCompleted('non-existent')).toThrow('not found');
    });

    it('should throw when marking non-existent task as failed', () => {
      expect(() => queue.markFailed('non-existent', new Error('Test'))).toThrow('not found');
    });

    it('should throw when canceling non-existent task', () => {
      expect(() => queue.cancel('non-existent')).toThrow('not found');
    });
  });
});
