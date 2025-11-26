/**
 * Retry Logic with Exponential Backoff
 *
 * Handles transient failures with intelligent retry strategies.
 * Includes jitter to prevent thundering herd problem.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds (default: 100) */
  initialDelay: number;
  /** Maximum delay in milliseconds (default: 5000) */
  maxDelay: number;
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter: boolean;
  /** Custom function to determine if error is retriable */
  isRetriable?: (error: unknown) => boolean;
  /** Callback invoked before each retry */
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Default retry predicate - determines if error is worth retrying
 */
function defaultIsRetriable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const retriablePatterns = [
    'etimedout',
    'econnreset',
    'econnrefused',
    'enotfound',
    'rate limit',
    'too many requests',
    'service unavailable',
    'gateway timeout',
    'temporary failure',
  ];

  return retriablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Execute function with retry logic and exponential backoff
 *
 * @param fn Function to execute (can be async)
 * @param options Retry configuration
 * @returns Promise resolving to function result
 * @throws RetryError if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
    isRetriable: defaultIsRetriable,
    onRetry: () => {}, // No-op by default
    ...options,
  };

  let lastError: Error | undefined;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on final attempt or non-retriable errors
      if (attempt >= config.maxRetries || !config.isRetriable(error)) {
        throw lastError;
      }

      // Calculate delay with jitter
      const jitterAmount = config.jitter ? delay * 0.25 * (Math.random() - 0.5) : 0;
      const actualDelay = Math.min(delay + jitterAmount, config.maxDelay);

      // Notify before retry
      config.onRetry(attempt + 1, actualDelay, error);

      // Wait before retry
      await sleep(actualDelay);

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new RetryError(
    `Failed after ${config.maxRetries} retries`,
    config.maxRetries,
    lastError ?? new Error('Unknown error')
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry predicate builders for common scenarios
 */
export const RetryPredicates = {
  /** Retry all errors */
  always: (_error: unknown) => true,

  /** Never retry */
  never: (_error: unknown) => false,

  /** Retry only network errors */
  networkOnly: (error: unknown) => {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('etimedout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    );
  },

  /** Retry only rate limit errors */
  rateLimitOnly: (error: unknown) => {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return message.includes('rate limit') || message.includes('too many requests');
  },

  /** Custom predicate from error codes */
  fromCodes: (codes: string[]) => (error: unknown) => {
    if (!(error instanceof Error)) return false;
    const errorWithCode = error as Error & { code?: string };
    return errorWithCode.code ? codes.includes(errorWithCode.code) : false;
  },
};

/**
 * Retry with specific delays (no backoff)
 */
export async function retryWithDelays<T>(fn: () => Promise<T>, delays: number[]): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < delays.length) {
        await sleep(delays[i]);
      }
    }
  }

  throw lastError ?? new Error('All retries failed');
}
