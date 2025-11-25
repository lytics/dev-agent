import type { LogEntry, Transport } from '../types';
import { LOG_LEVELS } from '../types';

/**
 * Console transport - writes to stdout/stderr
 *
 * - trace, debug, info -> stdout
 * - warn, error, fatal -> stderr
 */
export class ConsoleTransport implements Transport {
  write(entry: LogEntry, formatted: string): void {
    const stream = entry.levelValue >= LOG_LEVELS.warn ? process.stderr : process.stdout;

    stream.write(`${formatted}\n`);
  }

  flush(): void {
    // No-op for console, writes are synchronous
  }
}
