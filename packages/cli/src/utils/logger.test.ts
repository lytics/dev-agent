import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log info messages', () => {
    logger.info('test message');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ℹ'), 'test message');
  });

  it('should log success messages', () => {
    logger.success('test success');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✔'), 'test success');
  });

  it('should log error messages', () => {
    logger.error('test error');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✖'), 'test error');
  });

  it('should log warning messages', () => {
    logger.warn('test warning');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠'), 'test warning');
  });

  it('should log plain messages', () => {
    logger.log('plain message');
    expect(consoleLogSpy).toHaveBeenCalledWith('plain message');
  });

  it('should only log debug when DEBUG env is set', () => {
    const originalDebug = process.env.DEBUG;

    // Without DEBUG
    delete process.env.DEBUG;
    logger.debug('debug message');
    expect(consoleLogSpy).not.toHaveBeenCalled();

    // With DEBUG
    process.env.DEBUG = 'true';
    logger.debug('debug message 2');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🐛'),
      expect.stringContaining('debug message 2')
    );

    // Restore
    if (originalDebug !== undefined) {
      process.env.DEBUG = originalDebug;
    } else {
      delete process.env.DEBUG;
    }
  });
});
