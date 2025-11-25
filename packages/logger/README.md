# @lytics/kero

Zero-dependency TypeScript logger inspired by Pino.

## Installation

```bash
pnpm add @lytics/kero
```

## Quick Start

```typescript
import { kero } from '@lytics/kero';

// Basic logging
kero.info('Server started');
kero.success('Deployment complete');
kero.debug({ port: 3000 }, 'Listening');
kero.error(new Error('Failed'), 'Request failed');
```

## Creating a Logger

```typescript
import { createLogger } from '@lytics/kero';

const logger = createLogger({
  level: 'debug',        // Minimum level: trace, debug, info, warn, error, fatal
  format: 'pretty',      // Output format: 'pretty' or 'json'
});
```

## Presets

```typescript
import { createLogger } from '@lytics/kero';

// Development: pretty output, debug level
const devLogger = createLogger({ preset: 'development' });

// Production: JSON output, info level
const prodLogger = createLogger({ preset: 'production' });

// Test: JSON output, warn level (minimal noise)
const testLogger = createLogger({ preset: 'test' });
```

## Child Loggers

Child loggers inherit parent configuration and add context:

```typescript
const logger = createLogger({ level: 'info' });
const reqLogger = logger.child({ requestId: 'abc-123' });

reqLogger.info('Processing'); // Includes requestId in output
```

## Structured Logging

Pass an object as the first argument for structured data:

```typescript
logger.info({ userId: 42, action: 'login' }, 'User authenticated');
// JSON: {"level":30,"time":1732505525000,"userId":42,"action":"login","msg":"User authenticated"}
// Pretty: [14:32:05] INFO  User authenticated {"userId":42,"action":"login"}
```

## Error Logging

Pass an Error as the first argument:

```typescript
try {
  riskyOperation();
} catch (err) {
  logger.error(err, 'Operation failed');
}
```

## Timing

Measure operation duration:

```typescript
const done = logger.startTimer('database-query');
await db.query(sql);
done(); // Logs: "database-query completed (42ms)"
```

## Log Levels

From lowest to highest priority:

| Level   | Value | Description              |
|---------|-------|--------------------------|
| `trace` | 10    | Detailed tracing         |
| `debug` | 20    | Debug information        |
| `info`  | 30    | Normal operations        |
| `warn`  | 40    | Warning conditions       |
| `error` | 50    | Error conditions         |
| `fatal` | 60    | System is unusable       |

## Output Formats

### Pretty (Development)

```
[14:32:05] INFO  Server started
[14:32:05] DEBUG Listening {"port":3000}
[14:32:06] INFO  (abc-123) Processing
```

### Pretty with Icons

Enable icons for visual scanning:

```typescript
import { createLogger, PrettyFormatter } from '@lytics/kero';

// Unicode icons (default when icons=true) - works everywhere
const logger = createLogger({
  formatter: new PrettyFormatter({ icons: true }),
});

// Or explicitly: icons: 'unicode' or icons: 'emoji'
```

**Unicode icons** (terminal-safe):
```
[14:32:05] » TRACE Detailed info
[14:32:05] ○ DEBUG Listening {"port":3000}
[14:32:05] ● INFO  Server started
[14:32:05] ✔ INFO  Deployment complete  (success)
[14:32:06] ▲ WARN  Memory usage high
[14:32:07] ✖ ERROR Request failed
```

| Level     | Unicode | Emoji |
|-----------|---------|-------|
| `trace`   | »       | 🔍    |
| `debug`   | ○       | 🐛    |
| `info`    | ●       | ℹ️     |
| `success` | ✔       | ✅    |
| `warn`    | ▲       | ⚠️     |
| `error`   | ✖       | ❌    |
| `fatal`   | ✘       | 💀    |

### JSON (Production)

```json
{"level":30,"time":1732505525000,"msg":"Server started"}
{"level":20,"time":1732505525001,"port":3000,"msg":"Listening"}
{"level":30,"time":1732505526000,"requestId":"abc-123","msg":"Processing"}
```

## Custom Formatters

Implement the `Formatter` interface:

```typescript
import { createLogger, Formatter, LogEntry } from '@lytics/kero';

const myFormatter: Formatter = {
  format(entry: LogEntry): string {
    return `[${entry.level}] ${entry.msg}`;
  }
};

const logger = createLogger({ formatter: myFormatter });
```

## Custom Transports

Implement the `Transport` interface:

```typescript
import { createLogger, Transport, LogEntry } from '@lytics/kero';

const myTransport: Transport = {
  write(entry: LogEntry, formatted: string): void {
    // Send to your logging service
    fetch('/logs', { method: 'POST', body: formatted });
  }
};

const logger = createLogger({ transports: [myTransport] });
```

## API Reference

### `createLogger(config?)`

Creates a new logger instance.

**Options:**
- `level`: Minimum log level (default: `'info'`)
- `format`: Output format `'pretty'` | `'json'` (default: `'pretty'`)
- `formatter`: Custom formatter instance
- `transports`: Array of transports (default: `[ConsoleTransport]`)
- `context`: Default context for all log entries
- `preset`: Preset name `'development'` | `'production'` | `'test'`

### `kero`

Default logger instance with `development` preset.

### Logger Methods

- `trace(msg)` / `trace(obj, msg)` - Log at trace level
- `debug(msg)` / `debug(obj, msg)` - Log at debug level
- `info(msg)` / `info(obj, msg)` - Log at info level
- `success(msg)` / `success(obj, msg)` - Log success at info level (with ✔ icon)
- `warn(msg)` / `warn(obj, msg)` - Log at warn level
- `error(msg)` / `error(err, msg)` / `error(obj, msg)` - Log at error level
- `fatal(msg)` / `fatal(err, msg)` / `fatal(obj, msg)` - Log at fatal level
- `child(context)` - Create child logger with added context
- `startTimer(label)` - Start a timer, returns function to stop and log
- `isLevelEnabled(level)` - Check if level would be logged
- `level` - Get current log level

## Zero Dependencies

This package has zero runtime dependencies. It uses only Node.js built-ins:
- `process.stdout` / `process.stderr` for output
- `process.env` for color detection

## License

MIT

