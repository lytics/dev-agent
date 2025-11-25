/**
 * Observability Tests
 */

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { AsyncEventBus } from '../events';
import { createLogger, ObservableLoggerImpl } from './logger';
import { createRequestTracker, RequestTracker } from './request-tracker';

describe('ObservableLoggerImpl', () => {
  let logger: ObservableLoggerImpl;
  let consoleSpy: MockInstance;

  beforeEach(() => {
    logger = new ObservableLoggerImpl({ component: 'test', level: 'debug' });
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      logger.debug('debug message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not log debug messages when level is info', () => {
      logger.setLevel('info');
      logger.debug('debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log info messages when level is info', () => {
      logger.setLevel('info');
      logger.info('info message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('warn message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages with error object', () => {
      const error = new Error('test error');
      logger.error('error message', error);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('child logger', () => {
    it('should create child logger with combined component name', () => {
      const child = logger.child('sub');
      child.info('child message');

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('[test:sub]');
    });

    it('should inherit request ID from parent', () => {
      const scoped = logger.withRequest('req-123');
      const child = scoped.child('sub');
      child.info('message');

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('(req-123');
    });
  });

  describe('withRequest', () => {
    it('should include request ID in output', () => {
      const scoped = logger.withRequest('req-abc123');
      scoped.info('message');

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('(req-abc1');
    });
  });

  describe('timing', () => {
    it('should measure duration with startTimer', async () => {
      const timer = logger.startTimer('operation');
      await new Promise((resolve) => setTimeout(resolve, 50));
      const duration = timer.stop();

      expect(duration).toBeGreaterThanOrEqual(40);
      expect(duration).toBeLessThan(200);
    });

    it('should return elapsed time without stopping', async () => {
      const timer = logger.startTimer('operation');
      await new Promise((resolve) => setTimeout(resolve, 30));
      const elapsed = timer.elapsed();
      await new Promise((resolve) => setTimeout(resolve, 30));
      const duration = timer.stop();

      expect(elapsed).toBeLessThan(duration);
    });

    it('should time async operations', async () => {
      const result = await logger.time('async-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 'done';
      });

      expect(result).toBe('done');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error on failed timed operation', async () => {
      await expect(
        logger.time('failing-op', async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');

      // Should have logged the error
      const calls = consoleSpy.mock.calls;
      const errorCall = calls.find((call) => call[0].includes('ERROR'));
      expect(errorCall).toBeDefined();
    });
  });

  describe('JSON format', () => {
    it('should output valid JSON', () => {
      const jsonLogger = new ObservableLoggerImpl({
        component: 'test',
        format: 'json',
        level: 'info',
      });

      jsonLogger.info('test message', { key: 'value' });

      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test message');
      expect(parsed.component).toBe('test');
      expect(parsed.data).toEqual({ key: 'value' });
    });
  });
});

describe('RequestTracker', () => {
  let tracker: RequestTracker;
  let eventBus: AsyncEventBus;

  beforeEach(() => {
    eventBus = new AsyncEventBus();
    tracker = new RequestTracker({ eventBus, maxHistory: 100 });
  });

  describe('startRequest', () => {
    it('should create request context with unique ID', () => {
      const ctx1 = tracker.startRequest('dev_search', { query: 'auth' });
      const ctx2 = tracker.startRequest('dev_explore', { action: 'pattern' });

      expect(ctx1.requestId).not.toBe(ctx2.requestId);
      expect(ctx1.tool).toBe('dev_search');
      expect(ctx2.tool).toBe('dev_explore');
    });

    it('should emit request.started event', async () => {
      const handler = vi.fn();
      eventBus.on('request.started', handler);

      tracker.startRequest('dev_search', { query: 'auth' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'dev_search',
          args: { query: 'auth' },
        })
      );
    });

    it('should track parent ID for nested requests', () => {
      const parent = tracker.startRequest('dev_plan', { issue: 1 });
      const child = tracker.startRequest('dev_explore', { action: 'pattern' }, parent.requestId);

      expect(child.parentId).toBe(parent.requestId);
    });
  });

  describe('completeRequest', () => {
    it('should remove request from active', () => {
      const ctx = tracker.startRequest('dev_search', {});
      expect(tracker.getActiveCount()).toBe(1);

      tracker.completeRequest(ctx.requestId);
      expect(tracker.getActiveCount()).toBe(0);
    });

    it('should emit request.completed event', async () => {
      const handler = vi.fn();
      eventBus.on('request.completed', handler);

      const ctx = tracker.startRequest('dev_search', {});
      tracker.completeRequest(ctx.requestId, 500);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: ctx.requestId,
          tool: 'dev_search',
          success: true,
          tokenEstimate: 500,
        })
      );
    });
  });

  describe('failRequest', () => {
    it('should remove request from active', () => {
      const ctx = tracker.startRequest('dev_search', {});
      tracker.failRequest(ctx.requestId, 'test error');
      expect(tracker.getActiveCount()).toBe(0);
    });

    it('should emit request.failed event', async () => {
      const handler = vi.fn();
      eventBus.on('request.failed', handler);

      const ctx = tracker.startRequest('dev_search', {});
      tracker.failRequest(ctx.requestId, 'test error');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: ctx.requestId,
          tool: 'dev_search',
          error: 'test error',
        })
      );
    });
  });

  describe('getMetrics', () => {
    it('should return empty metrics when no requests', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.total).toBe(0);
      expect(metrics.avgDuration).toBe(0);
    });

    it('should calculate metrics from completed requests', async () => {
      // Create and complete some requests
      for (let i = 0; i < 5; i++) {
        const ctx = tracker.startRequest('dev_search', {});
        await new Promise((resolve) => setTimeout(resolve, 10));
        tracker.completeRequest(ctx.requestId);
      }

      const ctx = tracker.startRequest('dev_explore', {});
      tracker.failRequest(ctx.requestId, 'error');

      const metrics = tracker.getMetrics();
      expect(metrics.total).toBe(6);
      expect(metrics.success).toBe(5);
      expect(metrics.failed).toBe(1);
      expect(metrics.avgDuration).toBeGreaterThan(0);
      expect(metrics.byTool['dev_search'].count).toBe(5);
      expect(metrics.byTool['dev_explore'].count).toBe(1);
    });

    it('should calculate percentiles', async () => {
      // Create requests with varying durations
      for (let i = 0; i < 10; i++) {
        const ctx = tracker.startRequest('dev_search', {});
        await new Promise((resolve) => setTimeout(resolve, i * 5));
        tracker.completeRequest(ctx.requestId);
      }

      const metrics = tracker.getMetrics();
      expect(metrics.p50Duration).toBeLessThanOrEqual(metrics.p95Duration);
      expect(metrics.p95Duration).toBeLessThanOrEqual(metrics.p99Duration);
    });
  });

  describe('history management', () => {
    it('should limit history to maxHistory', () => {
      const smallTracker = new RequestTracker({ maxHistory: 5 });

      for (let i = 0; i < 10; i++) {
        const ctx = smallTracker.startRequest('dev_search', {});
        smallTracker.completeRequest(ctx.requestId);
      }

      const metrics = smallTracker.getMetrics();
      expect(metrics.total).toBe(5);
    });

    it('should clear history', () => {
      const ctx = tracker.startRequest('dev_search', {});
      tracker.completeRequest(ctx.requestId);

      expect(tracker.getMetrics().total).toBe(1);
      tracker.clearHistory();
      expect(tracker.getMetrics().total).toBe(0);
    });
  });
});

describe('createLogger', () => {
  it('should create a logger with defaults', () => {
    const logger = createLogger();
    expect(logger.getLevel()).toBe('info');
  });

  it('should accept configuration', () => {
    const logger = createLogger({ level: 'debug', component: 'test' });
    expect(logger.getLevel()).toBe('debug');
  });
});

describe('createRequestTracker', () => {
  it('should create a tracker with defaults', () => {
    const tracker = createRequestTracker();
    expect(tracker.getActiveCount()).toBe(0);
  });
});
