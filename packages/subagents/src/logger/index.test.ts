import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoordinatorLogger } from './index';

describe('CoordinatorLogger', () => {
  let logger: CoordinatorLogger;
  let consoleSpy: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    logger = new CoordinatorLogger('test', 'debug');
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message', { key: 'value' });

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      const call = consoleSpy.debug.mock.calls[0][0] as string;
      expect(call).toContain('DEBUG');
      expect(call).toContain('Debug message');
      expect(call).toContain('"key":"value"');
    });

    it('should log info messages', () => {
      logger.info('Info message', { key: 'value' });

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const call = consoleSpy.info.mock.calls[0][0] as string;
      expect(call).toContain('INFO');
      expect(call).toContain('Info message');
      expect(call).toContain('"key":"value"');
    });

    it('should log warn messages', () => {
      logger.warn('Warning message', { key: 'value' });

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const call = consoleSpy.warn.mock.calls[0][0] as string;
      expect(call).toContain('WARN');
      expect(call).toContain('Warning message');
      expect(call).toContain('"key":"value"');
    });

    it('should log error messages with error object', () => {
      const error = new Error('Test error');
      logger.error('Error message', error, { key: 'value' });

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const call = consoleSpy.error.mock.calls[0][0] as string;
      expect(call).toContain('ERROR');
      expect(call).toContain('Error message');
      expect(call).toContain('"key":"value"');
      expect(call).toContain('Test error');
    });

    it('should log error messages without error object', () => {
      logger.error('Error message', undefined, { key: 'value' });

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const call = consoleSpy.error.mock.calls[0][0] as string;
      expect(call).toContain('ERROR');
      expect(call).toContain('Error message');
      expect(call).toContain('"key":"value"');
    });

    it('should log messages without metadata', () => {
      logger.info('Simple message');

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const call = consoleSpy.info.mock.calls[0][0] as string;
      expect(call).toContain('INFO');
      expect(call).toContain('Simple message');
    });
  });

  describe('log level filtering', () => {
    it('should not log debug when level is info', () => {
      const infoLogger = new CoordinatorLogger('test', 'info');
      vi.spyOn(console, 'debug').mockImplementation(() => {});

      infoLogger.debug('Should not appear');
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should log info when level is info', () => {
      const infoLogger = new CoordinatorLogger('test', 'info');
      vi.spyOn(console, 'info').mockImplementation(() => {});

      infoLogger.info('Should appear');
      expect(console.info).toHaveBeenCalled();
    });

    it('should only log errors when level is error', () => {
      const errorLogger = new CoordinatorLogger('test', 'error');
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      errorLogger.debug('Should not appear');
      errorLogger.info('Should not appear');
      errorLogger.warn('Should not appear');
      errorLogger.error('Should appear');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('should include context in log messages', () => {
      const contextLogger = new CoordinatorLogger('my-agent', 'info');
      vi.spyOn(console, 'info').mockImplementation(() => {});

      contextLogger.info('Test message');

      const call = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(call).toContain('[my-agent]');
    });

    it('should support child loggers with additional context', () => {
      const child = logger.child('child-component');
      vi.spyOn(console, 'info').mockImplementation(() => {});

      child.info('Child message');

      const call = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(call).toContain('[test:child-component]');
    });
  });

  describe('timestamp formatting', () => {
    it('should format timestamp consistently', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Test message');

      const call = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });
  });
});
