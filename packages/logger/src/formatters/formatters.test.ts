import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../types';
import { JsonFormatter } from './json';
import { PrettyFormatter } from './pretty';

const createEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  level: 'info',
  levelValue: 30,
  time: 1732505525000,
  msg: 'Test message',
  context: {},
  ...overrides,
});

describe('JsonFormatter', () => {
  const formatter = new JsonFormatter();

  it('formats a basic log entry', () => {
    const entry = createEntry();
    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe(30);
    expect(parsed.time).toBe(1732505525000);
    expect(parsed.msg).toBe('Test message');
  });

  it('includes context in output', () => {
    const entry = createEntry({
      context: { userId: 42, action: 'login' },
    });
    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.userId).toBe(42);
    expect(parsed.action).toBe('login');
  });

  it('formats errors correctly', () => {
    const error = new Error('Something failed');
    const entry = createEntry({
      error,
      msg: 'Operation failed',
    });
    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.err.type).toBe('Error');
    expect(parsed.err.message).toBe('Something failed');
    expect(parsed.err.stack).toContain('Error: Something failed');
  });

  it('puts msg at the end (Pino convention)', () => {
    const entry = createEntry({ context: { a: 1 } });
    const output = formatter.format(entry);

    // msg should be the last key
    expect(output.endsWith('"msg":"Test message"}')).toBe(true);
  });
});

describe('PrettyFormatter', () => {
  // Disable colors for predictable testing
  const formatter = new PrettyFormatter({ colors: false });

  it('formats a basic log entry', () => {
    const entry = createEntry();
    const output = formatter.format(entry);

    expect(output).toContain('INFO');
    expect(output).toContain('Test message');
  });

  it('includes time in brackets', () => {
    const entry = createEntry({
      time: new Date('2024-11-25T14:32:05.000Z').getTime(),
    });
    const output = formatter.format(entry);

    // Time format depends on timezone, just check brackets exist
    expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
  });

  it('shows requestId in parentheses', () => {
    const entry = createEntry({
      context: { requestId: 'abc-123' },
    });
    const output = formatter.format(entry);

    expect(output).toContain('(abc-123)');
  });

  it('shows component in brackets', () => {
    const entry = createEntry({
      context: { component: 'database' },
    });
    const output = formatter.format(entry);

    expect(output).toContain('[database]');
  });

  it('shows extra context as JSON', () => {
    const entry = createEntry({
      context: { port: 3000, host: 'localhost' },
    });
    const output = formatter.format(entry);

    expect(output).toContain('{"port":3000,"host":"localhost"}');
  });

  it('includes error stack', () => {
    const error = new Error('Test error');
    const entry = createEntry({
      level: 'error',
      levelValue: 50,
      error,
    });
    const output = formatter.format(entry);

    expect(output).toContain('Error: Test error');
  });

  it('formats different log levels', () => {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

    for (const level of levels) {
      const entry = createEntry({ level, levelValue: 10 });
      const output = formatter.format(entry);
      expect(output.toUpperCase()).toContain(level.toUpperCase());
    }
  });

  describe('color detection', () => {
    const originalEnv = process.env;
    const originalIsTTY = process.stdout.isTTY;

    beforeEach(() => {
      // Reset env for each test
      process.env = { ...originalEnv };
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;
    });

    afterEach(() => {
      process.env = originalEnv;
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        writable: true,
      });
    });

    it('disables colors when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1';
      const formatter = new PrettyFormatter();
      const entry = createEntry();
      const output = formatter.format(entry);

      // Should not contain ANSI escape codes
      expect(output).not.toContain('\x1b[');
    });

    it('enables colors when FORCE_COLOR is set', () => {
      process.env.FORCE_COLOR = '1';
      const formatter = new PrettyFormatter();
      const entry = createEntry();
      const output = formatter.format(entry);

      // Should contain ANSI escape codes
      expect(output).toContain('\x1b[');
    });

    it('enables colors when stdout is a TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
      });
      const formatter = new PrettyFormatter();
      const entry = createEntry();
      const output = formatter.format(entry);

      // Should contain ANSI escape codes
      expect(output).toContain('\x1b[');
    });

    it('disables colors when stdout is not a TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
      });
      const formatter = new PrettyFormatter();
      const entry = createEntry();
      const output = formatter.format(entry);

      // Should not contain ANSI escape codes
      expect(output).not.toContain('\x1b[');
    });

    it('explicit colors option overrides detection', () => {
      process.env.NO_COLOR = '1'; // Would normally disable
      const formatter = new PrettyFormatter({ colors: true });
      const entry = createEntry();
      const output = formatter.format(entry);

      // Should contain ANSI escape codes despite NO_COLOR
      expect(output).toContain('\x1b[');
    });
  });

  describe('icons option', () => {
    it('does not show icons by default', () => {
      const formatter = new PrettyFormatter({ colors: false });
      const entry = createEntry({ level: 'info', levelValue: 30 });
      const output = formatter.format(entry);

      // Should not contain unicode icons or emoji
      expect(output).not.toContain('●');
      expect(output).not.toContain('ℹ️');
    });

    it('shows unicode icons when icons=true', () => {
      const formatter = new PrettyFormatter({ colors: false, icons: true });
      const entry = createEntry({ level: 'info', levelValue: 30 });
      const output = formatter.format(entry);

      // true defaults to unicode
      expect(output).toContain('●');
    });

    it('shows unicode icons when icons="unicode"', () => {
      const formatter = new PrettyFormatter({ colors: false, icons: 'unicode' });
      const entry = createEntry({ level: 'info', levelValue: 30 });
      const output = formatter.format(entry);

      expect(output).toContain('●');
    });

    it('shows emoji icons when icons="emoji"', () => {
      const formatter = new PrettyFormatter({ colors: false, icons: 'emoji' });
      const entry = createEntry({ level: 'info', levelValue: 30 });
      const output = formatter.format(entry);

      expect(output).toContain('ℹ️');
    });

    it('shows correct unicode icon for each level', () => {
      const formatter = new PrettyFormatter({ colors: false, icons: 'unicode' });
      const iconMap: Record<string, string> = {
        trace: '»',
        debug: '○',
        info: '●',
        warn: '▲',
        error: '✖',
        fatal: '✘',
      };

      for (const [level, icon] of Object.entries(iconMap)) {
        const entry = createEntry({ level: level as LogEntry['level'], levelValue: 10 });
        const output = formatter.format(entry);
        expect(output).toContain(icon);
      }
    });

    it('shows correct emoji icon for each level', () => {
      const formatter = new PrettyFormatter({ colors: false, icons: 'emoji' });
      const emojiMap: Record<string, string> = {
        trace: '🔍',
        debug: '🐛',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        fatal: '💀',
      };

      for (const [level, emoji] of Object.entries(emojiMap)) {
        const entry = createEntry({ level: level as LogEntry['level'], levelValue: 10 });
        const output = formatter.format(entry);
        expect(output).toContain(emoji);
      }
    });

    it('shows success icon when _success context is true (unicode)', () => {
      const formatter = new PrettyFormatter({ colors: false, icons: 'unicode' });
      const entry = createEntry({
        level: 'info',
        levelValue: 30,
        context: { _success: true },
      });
      const output = formatter.format(entry);

      expect(output).toContain('✔');
      expect(output).not.toContain('●'); // Not regular info icon
    });

    it('shows success icon when _success context is true (emoji)', () => {
      const formatter = new PrettyFormatter({ colors: false, icons: 'emoji' });
      const entry = createEntry({
        level: 'info',
        levelValue: 30,
        context: { _success: true },
      });
      const output = formatter.format(entry);

      expect(output).toContain('✅');
    });

    it('does not show _success in extra context output', () => {
      const formatter = new PrettyFormatter({ colors: false, icons: 'unicode' });
      const entry = createEntry({
        level: 'info',
        levelValue: 30,
        context: { _success: true, otherData: 'visible' },
      });
      const output = formatter.format(entry);

      expect(output).toContain('otherData');
      expect(output).not.toContain('_success');
    });
  });
});
