import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetryError, RetryPredicates, retryWithDelays, withRetry } from '../retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('success cases', () => {
    it('should return result on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return result after retry', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should work with multiple retries', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(fn, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('failure cases', () => {
    it('should throw after max retries exhausted', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      const promise = withRetry(fn, { maxRetries: 2 });
      const runTimers = vi.runAllTimersAsync();
      await Promise.all([runTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow('ETIMEDOUT');
      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should not retry non-retriable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid input'));

      const promise = withRetry(fn, { maxRetries: 3 });
      const runTimers = vi.runAllTimersAsync();
      await Promise.all([runTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow('Invalid input');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should respect custom isRetriable predicate', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Custom error'));

      const promise = withRetry(fn, {
        maxRetries: 2,
        isRetriable: (error) => {
          return error instanceof Error && error.message.includes('Custom');
        },
      });
      const runTimers = vi.runAllTimersAsync();
      await Promise.all([runTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow('Custom error');
      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('exponential backoff', () => {
    it('should use exponential backoff delays', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      const delays: number[] = [];
      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        jitter: false, // Disable jitter for predictable testing
        onRetry: (_attempt, delay) => {
          delays.push(delay);
        },
      });

      await vi.runAllTimersAsync();
      await promise;

      // First retry: 100ms, Second retry: 200ms
      expect(delays).toEqual([100, 200]);
    });

    it('should cap delay at maxDelay', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      const delays: number[] = [];
      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 1500,
        backoffMultiplier: 2,
        jitter: false,
        onRetry: (_attempt, delay) => {
          delays.push(delay);
        },
      });

      await vi.runAllTimersAsync();
      await promise;

      // First retry: 1000ms, Second retry: capped at 1500ms (not 2000ms)
      expect(delays).toEqual([1000, 1500]);
    });

    it('should add jitter to prevent thundering herd', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      const delays: number[] = [];
      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        jitter: true,
        onRetry: (_attempt, delay) => {
          delays.push(delay);
        },
      });

      await vi.runAllTimersAsync();
      await promise;

      // With jitter, delays should be within ±25% of base delay
      // First retry: 1000 ± 250 = [750, 1250]
      expect(delays[0]).toBeGreaterThanOrEqual(750);
      expect(delays[0]).toBeLessThanOrEqual(1250);

      // Second retry: 2000 ± 500 = [1500, 2500]
      expect(delays[1]).toBeGreaterThanOrEqual(1500);
      expect(delays[1]).toBeLessThanOrEqual(2500);
    });
  });

  describe('onRetry callback', () => {
    it('should invoke callback before each retry', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success');

      const retryLog: Array<{ attempt: number; delay: number }> = [];
      const promise = withRetry(fn, {
        maxRetries: 3,
        jitter: false,
        onRetry: (attempt, delay) => {
          retryLog.push({ attempt, delay });
        },
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(retryLog).toHaveLength(2);
      expect(retryLog[0].attempt).toBe(1);
      expect(retryLog[1].attempt).toBe(2);
    });

    it('should include error information in callback', async () => {
      // Use real timers for this test to avoid async/timer conflicts
      vi.useRealTimers();

      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('ETIMEDOUT'); // Use retriable error
        }
        return 'success';
      };

      let capturedError: unknown;
      const result = await withRetry(fn, {
        maxRetries: 1,
        initialDelay: 1, // Very short delay
        jitter: false,
        onRetry: (_attempt, _delay, error) => {
          capturedError = error;
        },
      });

      expect(result).toBe('success');
      expect(capturedError).toBeInstanceOf(Error);
      expect((capturedError as Error).message).toBe('ETIMEDOUT');

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });
  });

  describe('default retry predicates', () => {
    it('should retry network timeout errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      const promise = withRetry(fn, { maxRetries: 1 });
      const runTimers = vi.runAllTimersAsync();
      await Promise.all([runTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow('ETIMEDOUT');
      expect(fn).toHaveBeenCalledTimes(2); // Retried
    });

    it('should retry connection reset errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

      const promise = withRetry(fn, { maxRetries: 1 });
      const runTimers = vi.runAllTimersAsync();
      await Promise.all([runTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow('ECONNRESET');
      expect(fn).toHaveBeenCalledTimes(2); // Retried
    });

    it('should retry rate limit errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));

      const promise = withRetry(fn, { maxRetries: 1 });
      const runTimers = vi.runAllTimersAsync();
      await Promise.all([runTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow('Rate limit exceeded');
      expect(fn).toHaveBeenCalledTimes(2); // Retried
    });

    it('should not retry validation errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid input'));

      const promise = withRetry(fn, { maxRetries: 3 });
      const runTimers = vi.runAllTimersAsync();
      await Promise.all([runTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow('Invalid input');
      expect(fn).toHaveBeenCalledTimes(1); // Not retried
    });
  });
});

describe('RetryPredicates', () => {
  describe('always', () => {
    it('should always return true', () => {
      const predicate = RetryPredicates.always;
      expect(predicate(new Error('any error'))).toBe(true);
      expect(predicate('string error')).toBe(true);
    });
  });

  describe('never', () => {
    it('should always return false', () => {
      const predicate = RetryPredicates.never;
      expect(predicate(new Error('any error'))).toBe(false);
      expect(predicate('string error')).toBe(false);
    });
  });

  describe('networkOnly', () => {
    it('should return true for network errors', () => {
      const predicate = RetryPredicates.networkOnly;
      expect(predicate(new Error('ETIMEDOUT'))).toBe(true);
      expect(predicate(new Error('ECONNRESET'))).toBe(true);
      expect(predicate(new Error('ECONNREFUSED'))).toBe(true);
      expect(predicate(new Error('ENOTFOUND'))).toBe(true);
    });

    it('should return false for non-network errors', () => {
      const predicate = RetryPredicates.networkOnly;
      expect(predicate(new Error('Invalid input'))).toBe(false);
      expect(predicate(new Error('Not found'))).toBe(false);
    });
  });

  describe('rateLimitOnly', () => {
    it('should return true for rate limit errors', () => {
      const predicate = RetryPredicates.rateLimitOnly;
      expect(predicate(new Error('Rate limit exceeded'))).toBe(true);
      expect(predicate(new Error('Too many requests'))).toBe(true);
    });

    it('should return false for other errors', () => {
      const predicate = RetryPredicates.rateLimitOnly;
      expect(predicate(new Error('ETIMEDOUT'))).toBe(false);
      expect(predicate(new Error('Invalid input'))).toBe(false);
    });
  });

  describe('fromCodes', () => {
    it('should match specific error codes', () => {
      const predicate = RetryPredicates.fromCodes(['ENOENT', 'EACCES']);

      const error1 = Object.assign(new Error('File not found'), { code: 'ENOENT' });
      expect(predicate(error1)).toBe(true);

      const error2 = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      expect(predicate(error2)).toBe(true);

      const error3 = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' });
      expect(predicate(error3)).toBe(false);
    });
  });
});

describe('retryWithDelays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use specific delays', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValueOnce('success');

    const promise = retryWithDelays(fn, [100, 200, 300]);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after all delays exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

    const promise = retryWithDelays(fn, [10, 20]);

    // Run timers and wait for promise to reject
    const runTimers = vi.runAllTimersAsync();
    await Promise.all([runTimers, promise.catch(() => {})]);

    await expect(promise).rejects.toThrow('Always fails');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

describe('RetryError', () => {
  it('should include attempt count and last error', () => {
    const originalError = new Error('Original error');
    const retryError = new RetryError('Failed after retries', 3, originalError);

    expect(retryError.message).toBe('Failed after retries');
    expect(retryError.attempts).toBe(3);
    expect(retryError.lastError).toBe(originalError);
    expect(retryError.name).toBe('RetryError');
  });
});

describe('real-world scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle vector search with transient failures', async () => {
    let attemptCount = 0;
    const vectorSearch = async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('ETIMEDOUT: Vector database timeout');
      }
      return { results: ['result1', 'result2'] };
    };

    const promise = withRetry(vectorSearch, {
      maxRetries: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
      jitter: false,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.results).toEqual(['result1', 'result2']);
    expect(attemptCount).toBe(3);
  });

  it('should handle GitHub API rate limits with backoff', async () => {
    const attempts: number[] = [];
    const githubAPI = async () => {
      attempts.push(Date.now());
      if (attempts.length < 3) {
        throw new Error('API rate limit exceeded');
      }
      return { data: 'success' };
    };

    const promise = withRetry(githubAPI, {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      jitter: false,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.data).toBe('success');
    expect(attempts.length).toBe(3);
  });

  it('should not retry permanent failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Invalid query syntax'));

    const promise = withRetry(fn, { maxRetries: 5 });

    // Run timers and wait for promise to reject
    const runTimers = vi.runAllTimersAsync();
    await Promise.all([runTimers, promise.catch(() => {})]);

    await expect(promise).rejects.toThrow('Invalid query syntax');
    // Should fail immediately, not retry 5 times
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
