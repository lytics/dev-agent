/**
 * Async Event Bus Implementation
 *
 * Node.js-native event bus built on EventEmitter.
 * Designed for async handlers and non-blocking communication.
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type {
  EmitOptions,
  EventBus,
  EventHandler,
  EventMeta,
  SubscriptionOptions,
  Unsubscribe,
} from './types';

/**
 * Internal handler wrapper with priority
 */
interface HandlerEntry<T = unknown> {
  handler: EventHandler<T>;
  priority: number;
  once: boolean;
}

/**
 * Configuration options for AsyncEventBus
 */
export interface AsyncEventBusOptions {
  /** Maximum number of listeners per event (default: 100) */
  maxListeners?: number;
  /** Default timeout for waitFor (default: 30000ms) */
  defaultTimeout?: number;
  /** Source identifier for event metadata */
  source?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Async Event Bus
 *
 * Features:
 * - Async handler support (all handlers can be async)
 * - Priority-based handler ordering
 * - waitFor() for Promise-based event waiting
 * - Type-safe with generics
 * - Built on Node.js EventEmitter for performance
 */
export class AsyncEventBus implements EventBus {
  private emitter: EventEmitter;
  private handlers: Map<string, HandlerEntry[]> = new Map();
  private options: Required<AsyncEventBusOptions>;

  constructor(options: AsyncEventBusOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners ?? 100,
      defaultTimeout: options.defaultTimeout ?? 30000,
      source: options.source ?? 'event-bus',
      debug: options.debug ?? false,
    };

    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(this.options.maxListeners);
  }

  /**
   * Subscribe to an event
   */
  on<T = unknown>(
    eventName: string,
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): Unsubscribe {
    const entry: HandlerEntry<T> = {
      handler,
      priority: options.priority ?? 0,
      once: options.once ?? false,
    };

    // Get or create handler list
    let handlerList = this.handlers.get(eventName);
    if (!handlerList) {
      handlerList = [];
      this.handlers.set(eventName, handlerList);
    }

    // Add handler and sort by priority (descending)
    handlerList.push(entry as HandlerEntry);
    handlerList.sort((a, b) => b.priority - a.priority);

    // Register with internal emitter
    const wrappedHandler = this.createWrappedHandler(eventName, entry);
    if (options.once) {
      this.emitter.once(eventName, wrappedHandler);
    } else {
      this.emitter.on(eventName, wrappedHandler);
    }

    // Store reference for removal
    (entry as HandlerEntry & { _wrapped: typeof wrappedHandler })._wrapped = wrappedHandler;

    if (this.options.debug) {
      console.debug(`[EventBus] Subscribed to "${eventName}" (priority: ${entry.priority})`);
    }

    // Return unsubscribe function
    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe once (auto-unsubscribes after first trigger)
   */
  once<T = unknown>(eventName: string, handler: EventHandler<T>): Unsubscribe {
    return this.on(eventName, handler, { once: true });
  }

  /**
   * Unsubscribe from an event
   */
  off<T = unknown>(eventName: string, handler: EventHandler<T>): void {
    const handlerList = this.handlers.get(eventName);
    if (!handlerList) return;

    const index = handlerList.findIndex((entry) => entry.handler === handler);
    if (index !== -1) {
      const entry = handlerList[index] as HandlerEntry & {
        _wrapped?: (...args: unknown[]) => void;
      };
      if (entry._wrapped) {
        this.emitter.off(eventName, entry._wrapped);
      }
      handlerList.splice(index, 1);

      if (this.options.debug) {
        console.debug(`[EventBus] Unsubscribed from "${eventName}"`);
      }
    }
  }

  /**
   * Emit an event
   */
  async emit<T = unknown>(eventName: string, payload: T, options: EmitOptions = {}): Promise<void> {
    const meta: EventMeta = {
      eventId: randomUUID(),
      timestamp: Date.now(),
      source: this.options.source,
    };

    if (this.options.debug) {
      console.debug(`[EventBus] Emitting "${eventName}"`, { payload, meta });
    }

    if (options.waitForHandlers) {
      // Wait for all handlers to complete
      await this.emitAndWait(eventName, payload, meta, options.timeout);
    } else {
      // Fire and forget (handlers run async)
      this.emitter.emit(eventName, payload, meta);
    }
  }

  /**
   * Wait for an event to occur
   */
  waitFor<T = unknown>(eventName: string, timeout?: number): Promise<T> {
    const timeoutMs = timeout ?? this.options.defaultTimeout;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(eventName, handler);
        reject(new Error(`Timeout waiting for event "${eventName}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler: EventHandler<T> = (payload) => {
        clearTimeout(timer);
        resolve(payload);
      };

      this.once(eventName, handler);
    });
  }

  /**
   * Get listener count for an event
   */
  listenerCount(eventName: string): number {
    return this.handlers.get(eventName)?.length ?? 0;
  }

  /**
   * Get all registered event names
   */
  eventNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.handlers.delete(eventName);
      this.emitter.removeAllListeners(eventName);
    } else {
      this.handlers.clear();
      this.emitter.removeAllListeners();
    }

    if (this.options.debug) {
      console.debug(`[EventBus] Removed all listeners${eventName ? ` for "${eventName}"` : ''}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a wrapped handler that supports async execution
   */
  private createWrappedHandler<T>(
    eventName: string,
    entry: HandlerEntry<T>
  ): (payload: T, meta: EventMeta) => void {
    return (payload: T, _meta: EventMeta) => {
      // Execute handler (may be async)
      const result = entry.handler(payload);

      // Handle promise rejection
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error(`[EventBus] Handler error for "${eventName}":`, error);
        });
      }
    };
  }

  /**
   * Emit and wait for all handlers to complete
   */
  private async emitAndWait<T>(
    eventName: string,
    payload: T,
    meta: EventMeta,
    timeout?: number
  ): Promise<void> {
    const handlerList = this.handlers.get(eventName);
    if (!handlerList || handlerList.length === 0) {
      return;
    }

    const timeoutMs = timeout ?? this.options.defaultTimeout;

    // Execute all handlers and collect promises
    const promises = handlerList.map(async (entry) => {
      try {
        await entry.handler(payload);
      } catch (error) {
        console.error(`[EventBus] Handler error for "${eventName}":`, error);
      }
    });

    // Wait with timeout
    await Promise.race([
      Promise.all(promises),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout waiting for handlers of "${eventName}"`)),
          timeoutMs
        )
      ),
    ]);

    // Clean up once handlers
    const onceHandlers = handlerList.filter((entry) => entry.once);
    for (const entry of onceHandlers) {
      this.off(eventName, entry.handler);
    }
  }
}

/**
 * Create a typed event bus for system events
 * Provides compile-time type checking for event names and payloads
 */
export function createTypedEventBus<EventMap extends object>(
  options?: AsyncEventBusOptions
): TypedEventBus<EventMap> {
  return new AsyncEventBus(options) as unknown as TypedEventBus<EventMap>;
}

/**
 * Typed event bus interface
 * Provides type safety for known event names while still allowing unknown events
 */
export interface TypedEventBus<EventMap extends object> {
  // Type-safe methods for known events
  on<K extends keyof EventMap & string>(
    eventName: K,
    handler: EventHandler<EventMap[K]>,
    options?: SubscriptionOptions
  ): Unsubscribe;

  once<K extends keyof EventMap & string>(
    eventName: K,
    handler: EventHandler<EventMap[K]>
  ): Unsubscribe;

  off<K extends keyof EventMap & string>(eventName: K, handler: EventHandler<EventMap[K]>): void;

  emit<K extends keyof EventMap & string>(
    eventName: K,
    payload: EventMap[K],
    options?: EmitOptions
  ): Promise<void>;

  waitFor<K extends keyof EventMap & string>(eventName: K, timeout?: number): Promise<EventMap[K]>;

  // Generic methods (inherited from EventBus)
  listenerCount(eventName: string): number;
  eventNames(): string[];
  removeAllListeners(eventName?: string): void;
}
