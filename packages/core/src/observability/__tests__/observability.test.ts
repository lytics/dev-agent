/**
 * Observability Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncEventBus } from '../../events';
import { createLogger, ObservableLoggerImpl } from '../logger';
import { createRequestTracker, RequestTracker } from '../request-tracker';

describe('ObservableLoggerImpl', () => {
  let logger: ObservableLoggerImpl;
  let stdoutSpy: unknown;
  let stderrSpy: unknown;
  let capturedOutput: string[];

  beforeEach(() => {
    capturedOutput = [];
    logger = new ObservableLoggerImpl({ component: 'test', level: 'debug' });
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        capturedOutput.push(chunk.toString());
        return true;
      });
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        capturedOutput.push(chunk.toString());
        return true;
      });
  });

  afterEach(() => {
    (stdoutSpy as ReturnType<typeof vi.spyOn>).mockRestore();
    (stderrSpy as ReturnType<typeof vi.spyOn>).mockRestore();
  });

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      logger.debug('debug message');
      const output = capturedOutput.join('');
      expect(output).toContain('debug message');
    });

    it('should not log debug messages when level is info', () => {
      logger.setLevel('info');
      capturedOutput.length = 0;
      logger.debug('debug message');
      const output = capturedOutput.join('');
      expect(output).not.toContain('debug message');
    });

    it('should log info messages when level is info', () => {
      logger.setLevel('info');
      capturedOutput.length = 0;
      logger.info('info message');
      const output = capturedOutput.join('');
      expect(output).toContain('info message');
    });

    it('should log warn messages', () => {
      logger.warn('warn message');
      const output = capturedOutput.join('');
      expect(output).toContain('warn message');
    });

    it('should log error messages with error object', () => {
      const error = new Error('test error');
      logger.error('error message', error);
      const output = capturedOutput.join('');
      expect(output).toContain('error message');
    });
  });

  describe('child logger', () => {
    it('should create child logger with combined component name', () => {
      const child = logger.child('sub');
      capturedOutput.length = 0;
      child.info('child message');

      const output = capturedOutput.join('');
      expect(output).toContain('child message');
    });

    it('should inherit request ID from parent', () => {
      const scoped = logger.withRequest('req-123');
      const child = scoped.child('sub');
      capturedOutput.length = 0;
      child.info('message');

      const output = capturedOutput.join('');
      expect(output).toContain('req-123');
    });
  });

  describe('withRequest', () => {
    it('should include request ID in output', () => {
      const scoped = logger.withRequest('req-abc123');
      capturedOutput.length = 0;
      scoped.info('message');

      const output = capturedOutput.join('');
      expect(output).toContain('req-abc123');
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
      capturedOutput.length = 0;
      const result = await logger.time('async-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 'done';
      });

      expect(result).toBe('done');
      const output = capturedOutput.join('');
      expect(output).toContain('async-op');
    });

    it('should log error on failed timed operation', async () => {
      capturedOutput.length = 0;
      await expect(
        logger.time('failing-op', async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');

      // Should have logged the error
      const output = capturedOutput.join('');
      expect(output).toContain('failing-op');
      expect(output).toContain('failed');
    });
  });

  describe('JSON format', () => {
    it('should output valid JSON', () => {
      capturedOutput.length = 0;
      const jsonLogger = new ObservableLoggerImpl({
        component: 'test',
        format: 'json',
        level: 'info',
      });

      jsonLogger.info('test message', { key: 'value' });

      const output = capturedOutput.join('').trim();
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe(30); // info level in kero is 30
      expect(parsed.msg).toBe('test message');
      expect(parsed.key).toBe('value');
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
      const ctx2 = tracker.startRequest('dev_inspect', { action: 'compare' });

      expect(ctx1.requestId).not.toBe(ctx2.requestId);
      expect(ctx1.tool).toBe('dev_search');
      expect(ctx2.tool).toBe('dev_inspect');
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
      const child = tracker.startRequest('dev_inspect', { action: 'compare' }, parent.requestId);

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

      const ctx = tracker.startRequest('dev_inspect', {});
      tracker.failRequest(ctx.requestId, 'error');

      const metrics = tracker.getMetrics();
      expect(metrics.total).toBe(6);
      expect(metrics.success).toBe(5);
      expect(metrics.failed).toBe(1);
      expect(metrics.avgDuration).toBeGreaterThan(0);
      expect(metrics.byTool.dev_search.count).toBe(5);
      expect(metrics.byTool.dev_inspect.count).toBe(1);
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
