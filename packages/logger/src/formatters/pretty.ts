import type { Formatter, LogEntry, LogLevel } from '../types';

/**
 * ANSI color codes
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const levelColors: Record<LogLevel, string> = {
  trace: colors.gray,
  debug: colors.cyan,
  info: colors.blue,
  warn: colors.yellow,
  error: colors.red,
  fatal: colors.magenta,
};

const levelLabels: Record<LogLevel, string> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  fatal: 'FATAL',
};

/**
 * Level icons using basic Unicode symbols
 * These work reliably across all terminals
 */
const levelIcons: Record<LogLevel | 'success', string> = {
  trace: '»', // double angle - drilling down
  debug: '○', // white circle - investigating
  info: '●', // black circle - solid info
  success: '✔', // checkmark - success
  warn: '▲', // triangle - attention
  error: '✖', // heavy X - problem
  fatal: '✘', // heavy ballot X - critical
};

/**
 * Level icons using emoji
 * More expressive but may not render consistently
 */
const levelEmoji: Record<LogLevel | 'success', string> = {
  trace: '🔍',
  debug: '🐛',
  info: 'ℹ️ ',
  success: '✅',
  warn: '⚠️ ',
  error: '❌',
  fatal: '💀',
};

export interface PrettyFormatterOptions {
  /** Enable/disable ANSI colors (auto-detected by default) */
  colors?: boolean;
  /** Show icons before log level: 'unicode' for symbols, 'emoji' for emoji, false to disable (default: false) */
  icons?: boolean | 'unicode' | 'emoji';
}

/**
 * Pretty formatter - outputs human-readable colored output
 *
 * Output format (default):
 * [14:32:05] INFO  Server started
 * [14:32:05] DEBUG Listening {"port":3000}
 *
 * Output format (with unicode icons):
 * [14:32:05] ● INFO  Server started
 * [14:32:05] ○ DEBUG Listening {"port":3000}
 *
 * Output format (with emoji icons):
 * [14:32:05] ℹ️  INFO  Server started
 * [14:32:05] 🐛 DEBUG Listening {"port":3000}
 */
export class PrettyFormatter implements Formatter {
  private useColors: boolean;
  private iconStyle: false | 'unicode' | 'emoji';

  constructor(options: PrettyFormatterOptions = {}) {
    // Auto-detect color support if not specified
    this.useColors = options.colors ?? this.detectColorSupport();
    // Normalize icons option: true defaults to 'unicode'
    this.iconStyle = options.icons === true ? 'unicode' : options.icons || false;
  }

  private detectColorSupport(): boolean {
    // Check for NO_COLOR env var (https://no-color.org/)
    if (process.env.NO_COLOR !== undefined) return false;
    // Check for FORCE_COLOR env var
    if (process.env.FORCE_COLOR !== undefined) return true;
    // Check if stdout is a TTY
    return process.stdout.isTTY ?? false;
  }

  private colorize(text: string, color: string): string {
    if (!this.useColors) return text;
    return `${color}${text}${colors.reset}`;
  }

  format(entry: LogEntry): string {
    const time = this.formatTime(entry.time);
    const isSuccess = entry.context._success === true;
    const level = this.formatLevel(entry.level, isSuccess);
    const context = this.formatContext(entry.context);
    const message = entry.msg;

    let line = `${time} ${level} ${context}${message}`;

    // Add extra context data if present (filter out internal keys)
    const extraKeys = Object.keys(entry.context).filter(
      (k) => k !== 'requestId' && k !== 'component' && k !== '_success'
    );
    if (extraKeys.length > 0) {
      const extras = Object.fromEntries(extraKeys.map((k) => [k, entry.context[k]]));
      line += ` ${this.colorize(JSON.stringify(extras), colors.dim)}`;
    }

    // Add error stack if present
    if (entry.error) {
      line += `\n${this.colorize(entry.error.stack ?? entry.error.message, colors.red)}`;
    }

    return line;
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const timeStr = `[${hours}:${minutes}:${seconds}]`;
    return this.colorize(timeStr, colors.dim);
  }

  private formatLevel(level: LogLevel, isSuccess?: boolean): string {
    const iconKey = isSuccess ? 'success' : level;
    let icon = '';
    if (this.iconStyle === 'unicode') {
      icon = `${levelIcons[iconKey]} `;
    } else if (this.iconStyle === 'emoji') {
      icon = `${levelEmoji[iconKey]} `;
    }
    const label = levelLabels[level];
    const color = isSuccess ? colors.cyan : levelColors[level];
    return `${icon}${this.colorize(label, color)}`;
  }

  private formatContext(context: Record<string, unknown>): string {
    const parts: string[] = [];

    // Show requestId in parentheses if present
    if (context.requestId) {
      parts.push(this.colorize(`(${context.requestId})`, colors.dim));
    }

    // Show component in brackets if present
    if (context.component) {
      parts.push(this.colorize(`[${context.component}]`, colors.cyan));
    }

    return parts.length > 0 ? `${parts.join(' ')} ` : '';
  }
}
