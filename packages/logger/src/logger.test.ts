import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger, kero } from './logger';
import type { LogEntry, Transport } from './types';

// Mock transport to capture log output
class MockTransport implements Transport {
  entries: Array<{ entry: LogEntry; formatted: string }> = [];

  write(entry: LogEntry, formatted: string): void {
    this.entries.push({ entry, formatted });
  }

  clear(): void {
    this.entries = [];
  }

  get lastEntry(): LogEntry | undefined {
    return this.entries[this.entries.length - 1]?.entry;
  }

  get lastFormatted(): string | undefined {
    return this.entries[this.entries.length - 1]?.formatted;
  }
}

describe('KeroLogger', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  afterEach(() => {
    transport.clear();
  });

  describe('createLogger', () => {
    it('creates a logger with default settings', () => {
      const logger = createLogger({ transports: [transport] });
      expect(logger.level).toBe('info');
    });

    it('creates a logger with custom level', () => {
      const logger = createLogger({ level: 'debug', transports: [transport] });
      expect(logger.level).toBe('debug');
    });

    it('creates a logger with preset', () => {
      const logger = createLogger({
        preset: 'production',
        transports: [transport],
      });
      expect(logger.level).toBe('info');
    });

    it('explicit config overrides preset', () => {
      const logger = createLogger({
        preset: 'production',
        level: 'debug',
        transports: [transport],
      });
      expect(logger.level).toBe('debug');
    });
  });

  describe('log levels', () => {
    it('logs at info level by default', () => {
      const logger = createLogger({ transports: [transport] });

      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      logger.fatal('fatal message');

      // trace and debug should be filtered out
      expect(transport.entries).toHaveLength(4);
      expect(transport.entries.map((e) => e.entry.level)).toEqual([
        'info',
        'warn',
        'error',
        'fatal',
      ]);
    });

    it('logs all levels when set to trace', () => {
      const logger = createLogger({ level: 'trace', transports: [transport] });

      logger.trace('trace');
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      logger.fatal('fatal');

      expect(transport.entries).toHaveLength(6);
    });

    it('isLevelEnabled returns correct values', () => {
      const logger = createLogger({ level: 'warn', transports: [transport] });

      expect(logger.isLevelEnabled('trace')).toBe(false);
      expect(logger.isLevelEnabled('debug')).toBe(false);
      expect(logger.isLevelEnabled('info')).toBe(false);
      expect(logger.isLevelEnabled('warn')).toBe(true);
      expect(logger.isLevelEnabled('error')).toBe(true);
      expect(logger.isLevelEnabled('fatal')).toBe(true);
    });
  });

  describe('log messages', () => {
    it('logs a simple string message', () => {
      const logger = createLogger({ transports: [transport] });
      logger.info('Hello, world!');

      expect(transport.lastEntry?.msg).toBe('Hello, world!');
      expect(transport.lastEntry?.level).toBe('info');
    });

    it('logs with context object', () => {
      const logger = createLogger({ transports: [transport] });
      logger.info({ userId: 42, action: 'login' }, 'User action');

      expect(transport.lastEntry?.msg).toBe('User action');
      expect(transport.lastEntry?.context).toEqual({
        userId: 42,
        action: 'login',
      });
    });

    it('logs an error', () => {
      const logger = createLogger({ transports: [transport] });
      const error = new Error('Something went wrong');
      logger.error(error, 'Operation failed');

      expect(transport.lastEntry?.msg).toBe('Operation failed');
      expect(transport.lastEntry?.error).toBe(error);
    });

    it('uses error message if no message provided', () => {
      const logger = createLogger({ transports: [transport] });
      const error = new Error('Something went wrong');
      logger.error(error, '');

      // Should still work, just with empty message
      expect(transport.lastEntry?.error).toBe(error);
    });
  });

  describe('success method', () => {
    it('logs at info level with _success context', () => {
      const logger = createLogger({ transports: [transport] });
      logger.success('Deployment complete');

      expect(transport.lastEntry?.level).toBe('info');
      expect(transport.lastEntry?.msg).toBe('Deployment complete');
      expect(transport.lastEntry?.context._success).toBe(true);
    });

    it('logs with context object and _success', () => {
      const logger = createLogger({ transports: [transport] });
      logger.success({ duration: 42 }, 'Build finished');

      expect(transport.lastEntry?.level).toBe('info');
      expect(transport.lastEntry?.msg).toBe('Build finished');
      expect(transport.lastEntry?.context._success).toBe(true);
      expect(transport.lastEntry?.context.duration).toBe(42);
    });

    it('respects log level filtering', () => {
      const logger = createLogger({ level: 'warn', transports: [transport] });
      logger.success('Should not appear');

      expect(transport.entries).toHaveLength(0);
    });
  });

  describe('child loggers', () => {
    it('creates a child logger with inherited context', () => {
      const logger = createLogger({
        transports: [transport],
        context: { service: 'api' },
      });
      const child = logger.child({ requestId: 'abc-123' });

      child.info('Processing');

      expect(transport.lastEntry?.context).toEqual({
        service: 'api',
        requestId: 'abc-123',
      });
    });

    it('child can override parent context', () => {
      const logger = createLogger({
        transports: [transport],
        context: { env: 'dev' },
      });
      const child = logger.child({ env: 'test' });

      child.info('Test');

      expect(transport.lastEntry?.context.env).toBe('test');
    });

    it('child inherits parent level', () => {
      const logger = createLogger({
        level: 'warn',
        transports: [transport],
      });
      const child = logger.child({ component: 'db' });

      child.debug('Should not appear');
      child.warn('Should appear');

      expect(transport.entries).toHaveLength(1);
      expect(transport.lastEntry?.level).toBe('warn');
    });
  });

  describe('timing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('logs duration when timer is stopped', () => {
      const logger = createLogger({ transports: [transport] });

      const done = logger.startTimer('db-query');
      vi.advanceTimersByTime(150);
      done();

      expect(transport.lastEntry?.msg).toBe('db-query completed (150ms)');
      expect(transport.lastEntry?.context.duration).toBe(150);
      expect(transport.lastEntry?.context.label).toBe('db-query');
    });

    it('measures accurate time', () => {
      const logger = createLogger({ transports: [transport] });

      const done = logger.startTimer('operation');
      vi.advanceTimersByTime(42);
      done();

      expect(transport.lastEntry?.context.duration).toBe(42);
    });
  });

  describe('timestamp', () => {
    it('includes timestamp in log entry', () => {
      const logger = createLogger({ transports: [transport] });
      const before = Date.now();
      logger.info('Test');
      const after = Date.now();

      expect(transport.lastEntry?.time).toBeGreaterThanOrEqual(before);
      expect(transport.lastEntry?.time).toBeLessThanOrEqual(after);
    });
  });

  describe('default export', () => {
    it('kero is a ready-to-use logger', () => {
      // Just verify it exists and has the expected interface
      expect(kero.level).toBe('debug'); // development preset
      expect(typeof kero.info).toBe('function');
      expect(typeof kero.child).toBe('function');
    });
  });
});
