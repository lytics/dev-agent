import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import type { LogEntry } from '../types';
import { ConsoleTransport } from './console';

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    transport = new ConsoleTransport();
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  const createEntry = (level: LogEntry['level'], levelValue: number): LogEntry => ({
    level,
    levelValue,
    time: Date.now(),
    msg: 'Test message',
    context: {},
  });

  it('writes info level to stdout', () => {
    const entry = createEntry('info', 30);
    transport.write(entry, 'formatted output');

    expect(stdoutSpy).toHaveBeenCalledWith('formatted output\n');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('writes debug level to stdout', () => {
    const entry = createEntry('debug', 20);
    transport.write(entry, 'debug message');

    expect(stdoutSpy).toHaveBeenCalledWith('debug message\n');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('writes trace level to stdout', () => {
    const entry = createEntry('trace', 10);
    transport.write(entry, 'trace message');

    expect(stdoutSpy).toHaveBeenCalledWith('trace message\n');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('writes warn level to stderr', () => {
    const entry = createEntry('warn', 40);
    transport.write(entry, 'warning message');

    expect(stderrSpy).toHaveBeenCalledWith('warning message\n');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('writes error level to stderr', () => {
    const entry = createEntry('error', 50);
    transport.write(entry, 'error message');

    expect(stderrSpy).toHaveBeenCalledWith('error message\n');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('writes fatal level to stderr', () => {
    const entry = createEntry('fatal', 60);
    transport.write(entry, 'fatal message');

    expect(stderrSpy).toHaveBeenCalledWith('fatal message\n');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('flush is a no-op', () => {
    // Just verify it doesn't throw
    expect(() => transport.flush()).not.toThrow();
  });
});
