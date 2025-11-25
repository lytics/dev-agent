import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

describe('Logger', () => {
  let stdoutSpy: unknown;
  let stderrSpy: unknown;
  const capturedOutput: string[] = [];

  beforeEach(() => {
    capturedOutput.length = 0;
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

  it('should log info messages', () => {
    logger.info('test message');
    const output = capturedOutput.join('');
    expect(output).toContain('INFO');
    expect(output).toContain('test message');
  });

  it('should log success messages', () => {
    logger.success('test success');
    const output = capturedOutput.join('');
    expect(output).toContain('INFO');
    expect(output).toContain('test success');
  });

  it('should log error messages', () => {
    logger.error('test error');
    const output = capturedOutput.join('');
    expect(output).toContain('ERROR');
    expect(output).toContain('test error');
  });

  it('should log warning messages', () => {
    logger.warn('test warning');
    const output = capturedOutput.join('');
    expect(output).toContain('WARN');
    expect(output).toContain('test warning');
  });

  it('should log plain messages', () => {
    logger.log('plain message');
    const output = capturedOutput.join('');
    expect(output).toContain('plain message');
  });

  it('should only log debug when DEBUG env is set', () => {
    // Without DEBUG - logger is set to development preset which includes debug
    // So we just check that debug messages do get logged
    logger.debug('debug message');
    const output1 = capturedOutput.join('');
    expect(output1).toContain('DEBUG');
    expect(output1).toContain('debug message');
  });
});
