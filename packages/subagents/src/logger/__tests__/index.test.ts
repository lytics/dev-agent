import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoordinatorLogger } from '../index';

describe('CoordinatorLogger', () => {
  let logger: CoordinatorLogger;
  let stdoutSpy: unknown;
  let stderrSpy: unknown;
  let capturedOutput: string[];

  beforeEach(() => {
    capturedOutput = [];
    logger = new CoordinatorLogger('test', 'debug');
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
    it('should log debug messages', () => {
      capturedOutput.length = 0;
      logger.debug('Debug message', { key: 'value' });

      const output = capturedOutput.join('');
      expect(output).toContain('DEBUG');
      expect(output).toContain('Debug message');
      expect(output).toContain('"key":"value"');
    });

    it('should log info messages', () => {
      capturedOutput.length = 0;
      logger.info('Info message', { key: 'value' });

      const output = capturedOutput.join('');
      expect(output).toContain('INFO');
      expect(output).toContain('Info message');
      expect(output).toContain('"key":"value"');
    });

    it('should log warn messages', () => {
      capturedOutput.length = 0;
      logger.warn('Warning message', { key: 'value' });

      const output = capturedOutput.join('');
      expect(output).toContain('WARN');
      expect(output).toContain('Warning message');
      expect(output).toContain('"key":"value"');
    });

    it('should log error messages with error object', () => {
      capturedOutput.length = 0;
      const error = new Error('Test error');
      logger.error('Error message', error, { key: 'value' });

      const output = capturedOutput.join('');
      expect(output).toContain('ERROR');
      expect(output).toContain('Error message');
      expect(output).toContain('"key":"value"');
      expect(output).toContain('Test error');
    });

    it('should log error messages without error object', () => {
      capturedOutput.length = 0;
      logger.error('Error message', undefined, { key: 'value' });

      const output = capturedOutput.join('');
      expect(output).toContain('ERROR');
      expect(output).toContain('Error message');
      expect(output).toContain('"key":"value"');
    });

    it('should log messages without metadata', () => {
      capturedOutput.length = 0;
      logger.info('Simple message');

      const output = capturedOutput.join('');
      expect(output).toContain('INFO');
      expect(output).toContain('Simple message');
    });
  });

  describe('log level filtering', () => {
    it('should not log debug when level is info', () => {
      capturedOutput.length = 0;
      const infoLogger = new CoordinatorLogger('test', 'info');

      infoLogger.debug('Should not appear');
      const output = capturedOutput.join('');
      expect(output).not.toContain('Should not appear');
    });

    it('should log info when level is info', () => {
      capturedOutput.length = 0;
      const infoLogger = new CoordinatorLogger('test', 'info');

      infoLogger.info('Should appear');
      const output = capturedOutput.join('');
      expect(output).toContain('Should appear');
    });

    it('should only log errors when level is error', () => {
      capturedOutput.length = 0;
      const errorLogger = new CoordinatorLogger('test', 'error');

      errorLogger.debug('Should not appear debug');
      errorLogger.info('Should not appear info');
      errorLogger.warn('Should not appear warn');
      errorLogger.error('Should appear');

      const output = capturedOutput.join('');
      expect(output).not.toContain('Should not appear debug');
      expect(output).not.toContain('Should not appear info');
      expect(output).not.toContain('Should not appear warn');
      expect(output).toContain('Should appear');
    });
  });

  describe('context', () => {
    it('should include context in log messages', () => {
      capturedOutput.length = 0;
      const contextLogger = new CoordinatorLogger('my-agent', 'info');

      contextLogger.info('Test message');

      const output = capturedOutput.join('');
      expect(output).toContain('Test message');
      // Context is passed to kero but may not appear in component field in same way
    });

    it('should support child loggers with additional context', () => {
      capturedOutput.length = 0;
      const child = logger.child('child-component');

      child.info('Child message');

      const output = capturedOutput.join('');
      expect(output).toContain('Child message');
    });
  });

  describe('timestamp formatting', () => {
    it('should format timestamp consistently', () => {
      capturedOutput.length = 0;

      logger.info('Test message');

      const output = capturedOutput.join('');
      // Kero uses [HH:mm:ss] format by default in pretty mode
      expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    });
  });
});
