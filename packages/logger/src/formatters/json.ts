import type { Formatter, LogEntry } from '../types';

/**
 * JSON formatter - outputs machine-readable JSON lines
 *
 * Output format (Pino-compatible):
 * {"level":30,"time":1732505525000,"msg":"Server started"}
 * {"level":20,"time":1732505525001,"port":3000,"msg":"Listening"}
 */
export class JsonFormatter implements Formatter {
  format(entry: LogEntry): string {
    const output: Record<string, unknown> = {
      level: entry.levelValue,
      time: entry.time,
      ...entry.context,
    };

    if (entry.error) {
      output.err = {
        type: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    output.msg = entry.msg;

    return JSON.stringify(output);
  }
}
