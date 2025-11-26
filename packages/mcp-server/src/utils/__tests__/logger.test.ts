import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger } from '../logger';

describe('ConsoleLogger', () => {
  let stderrSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  describe('constructor', () => {
    it('should create logger with default prefix', () => {
      const logger = new ConsoleLogger();

      logger.info('test message');

      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should create logger with custom prefix', () => {
      const logger = new ConsoleLogger('[Custom]');

      logger.info('test message');

      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should respect minimum log level', () => {
      const logger = new ConsoleLogger('[Test]', 'warn');

      logger.debug('should not appear');
      logger.info('should not appear');
      logger.warn('should appear');

      // Only warn should be logged (1 call)
      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });

    it('should default to info level', () => {
      const logger = new ConsoleLogger();

      logger.debug('should not appear');
      logger.info('should appear');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      const logger = new ConsoleLogger('[Test]', 'debug');

      logger.debug('debug message');

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('debug message');
    });

    it('should log debug with metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'debug');
      const meta = { userId: '123', action: 'test' };

      logger.debug('debug with meta', meta);

      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should handle debug without metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'debug');

      logger.debug('debug no meta');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      const logger = new ConsoleLogger('[Test]', 'info');

      logger.info('info message');

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('info message');
    });

    it('should log info with metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'info');
      const meta = { requestId: 'abc', duration: 123 };

      logger.info('info with meta', meta);

      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should handle info without metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'info');

      logger.info('info no meta');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      const logger = new ConsoleLogger('[Test]', 'warn');

      logger.warn('warning message');

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('warning message');
    });

    it('should log warning with metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'warn');
      const meta = { warning: 'slow query', threshold: 1000 };

      logger.warn('slow operation', meta);

      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should handle warn without metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'warn');

      logger.warn('warn no meta');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      const logger = new ConsoleLogger('[Test]', 'error');

      logger.error('error message');

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('error message');
    });

    it('should log error with metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'error');
      const meta = { code: 'ERR_NOT_FOUND', path: '/test' };

      logger.error('file not found', meta);

      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should handle Error object', () => {
      const logger = new ConsoleLogger('[Test]', 'error');
      const error = new Error('Something went wrong');

      logger.error(error);

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('Something went wrong');
    });

    it('should handle Error object with metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'error');
      const error = new Error('Operation failed');
      const meta = { operation: 'indexing', file: 'test.ts' };

      logger.error(error, meta);

      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should handle error string without metadata', () => {
      const logger = new ConsoleLogger('[Test]', 'error');

      logger.error('error no meta');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stderr transport', () => {
    it('should write all logs to stderr', () => {
      const logger = new ConsoleLogger('[Test]', 'debug');

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(stderrSpy).toHaveBeenCalledTimes(4);
    });

    it('should append newlines to log output', () => {
      const logger = new ConsoleLogger('[Test]', 'info');

      logger.info('test');

      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output.endsWith('\n')).toBe(true);
    });

    it('should not use stdout', () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const logger = new ConsoleLogger('[Test]', 'info');

      logger.info('test message');

      expect(stdoutSpy).not.toHaveBeenCalled();
      stdoutSpy.mockRestore();
    });
  });
});
