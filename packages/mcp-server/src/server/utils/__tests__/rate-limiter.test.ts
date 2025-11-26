import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter, TokenBucket } from '../rate-limiter';

describe('TokenBucket', () => {
  describe('constructor', () => {
    it('should create bucket with specified capacity and refill rate', () => {
      const bucket = new TokenBucket(100, 10);
      expect(bucket.getAvailableTokens()).toBe(100);
    });

    it('should throw error for invalid capacity', () => {
      expect(() => new TokenBucket(0, 10)).toThrow('capacity must be > 0');
      expect(() => new TokenBucket(-1, 10)).toThrow('capacity must be > 0');
    });

    it('should throw error for invalid refill rate', () => {
      expect(() => new TokenBucket(100, 0)).toThrow('refillRate must be > 0');
      expect(() => new TokenBucket(100, -1)).toThrow('refillRate must be > 0');
    });
  });

  describe('tryConsume', () => {
    it('should consume tokens when available', () => {
      const bucket = new TokenBucket(10, 1);

      expect(bucket.tryConsume(1)).toBe(true);
      expect(bucket.getAvailableTokens()).toBe(9);

      expect(bucket.tryConsume(5)).toBe(true);
      expect(bucket.getAvailableTokens()).toBe(4);
    });

    it('should reject when insufficient tokens', () => {
      const bucket = new TokenBucket(5, 1);

      expect(bucket.tryConsume(3)).toBe(true); // 2 left
      expect(bucket.tryConsume(3)).toBe(false); // Insufficient
      expect(bucket.getAvailableTokens()).toBe(2); // Unchanged
    });

    it('should handle exact capacity consumption', () => {
      const bucket = new TokenBucket(10, 1);

      expect(bucket.tryConsume(10)).toBe(true);
      expect(bucket.getAvailableTokens()).toBe(0);
      expect(bucket.tryConsume(1)).toBe(false);
    });

    it('should default to consuming 1 token', () => {
      const bucket = new TokenBucket(10, 1);

      expect(bucket.tryConsume()).toBe(true);
      expect(bucket.getAvailableTokens()).toBe(9);
    });
  });

  describe('refill', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should refill tokens over time', () => {
      const bucket = new TokenBucket(100, 10); // 10 tokens/sec

      // Consume some tokens
      bucket.tryConsume(50);
      expect(bucket.getAvailableTokens()).toBe(50);

      // Wait 1 second -> should refill 10 tokens
      vi.advanceTimersByTime(1000);
      expect(bucket.getAvailableTokens()).toBe(60);

      // Wait another 2 seconds -> should refill 20 more
      vi.advanceTimersByTime(2000);
      expect(bucket.getAvailableTokens()).toBe(80);
    });

    it('should not exceed capacity when refilling', () => {
      const bucket = new TokenBucket(100, 10);

      // Start with full bucket
      expect(bucket.getAvailableTokens()).toBe(100);

      // Wait 10 seconds (would add 100 tokens, but capped at capacity)
      vi.advanceTimersByTime(10000);
      expect(bucket.getAvailableTokens()).toBe(100);
    });

    it('should refill to capacity after full consumption', () => {
      const bucket = new TokenBucket(50, 5); // 5 tokens/sec

      // Consume all
      bucket.tryConsume(50);
      expect(bucket.getAvailableTokens()).toBe(0);

      // Wait 10 seconds -> should refill to full capacity
      vi.advanceTimersByTime(10000);
      expect(bucket.getAvailableTokens()).toBe(50);
    });

    it('should handle fractional refill rates', () => {
      const bucket = new TokenBucket(100, 0.5); // 0.5 tokens/sec

      bucket.tryConsume(50);
      expect(bucket.getAvailableTokens()).toBe(50);

      // Wait 10 seconds -> should refill 5 tokens
      vi.advanceTimersByTime(10000);
      expect(bucket.getAvailableTokens()).toBe(55);
    });
  });

  describe('getRetryAfter', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return 0 when tokens are available', () => {
      const bucket = new TokenBucket(10, 1);
      expect(bucket.getRetryAfter()).toBe(0);
    });

    it('should calculate retry time when no tokens available', () => {
      const bucket = new TokenBucket(5, 1); // 1 token/sec

      bucket.tryConsume(5); // Consume all
      expect(bucket.getAvailableTokens()).toBe(0);
      expect(bucket.getRetryAfter()).toBe(1); // 1 second until next token
    });

    it('should update after time passes', () => {
      const bucket = new TokenBucket(10, 2); // 2 tokens/sec

      bucket.tryConsume(10); // Consume all

      expect(bucket.getRetryAfter()).toBe(1); // 0.5 sec, rounded up to 1

      // Wait 0.5 seconds (1 token refilled)
      vi.advanceTimersByTime(500);
      expect(bucket.getRetryAfter()).toBe(0); // Token now available
    });
  });

  describe('reset', () => {
    it('should restore bucket to full capacity', () => {
      const bucket = new TokenBucket(100, 10);

      bucket.tryConsume(70);
      expect(bucket.getAvailableTokens()).toBe(30);

      bucket.reset();
      expect(bucket.getAvailableTokens()).toBe(100);
    });
  });
});

describe('RateLimiter', () => {
  describe('constructor', () => {
    it('should create rate limiter with default limits', () => {
      const limiter = new RateLimiter(100, 10);
      const result = limiter.check('test-tool');

      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(99);
    });

    it('should support custom limits per key', () => {
      const customLimits = new Map([['expensive-tool', { capacity: 10, refillRate: 1 }]]);

      const limiter = new RateLimiter(100, 10, customLimits);

      // Expensive tool has lower limit
      const result1 = limiter.check('expensive-tool');
      expect(result1.allowed).toBe(true);
      expect(result1.remainingTokens).toBe(9);

      // Other tools use default
      const result2 = limiter.check('normal-tool');
      expect(result2.allowed).toBe(true);
      expect(result2.remainingTokens).toBe(99);
    });
  });

  describe('check', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter(10, 1);

      for (let i = 0; i < 10; i++) {
        const result = limiter.check('test-tool');
        expect(result.allowed).toBe(true);
      }
    });

    it('should reject requests exceeding limit', () => {
      const limiter = new RateLimiter(5, 1);

      // Consume all 5 tokens
      for (let i = 0; i < 5; i++) {
        limiter.check('test-tool');
      }

      // 6th request should be rejected
      const result = limiter.check('test-tool');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.remainingTokens).toBe(0);
    });

    it('should track separate limits per key', () => {
      const limiter = new RateLimiter(3, 1);

      // Consume tokens for tool-a
      limiter.check('tool-a');
      limiter.check('tool-a');
      limiter.check('tool-a');

      // tool-a is now exhausted
      expect(limiter.check('tool-a').allowed).toBe(false);

      // tool-b still has full capacity
      const result = limiter.check('tool-b');
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(2); // 3 capacity - 1 consumed = 2 remaining
    });

    it('should return retry-after time when rate limited', () => {
      const limiter = new RateLimiter(1, 2); // 2 tokens/sec

      limiter.check('test-tool'); // Consume only token

      const result = limiter.check('test-tool');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(1); // 0.5 sec rounded up
    });
  });

  describe('setLimit', () => {
    it('should update limit for specific key', () => {
      const limiter = new RateLimiter(100, 10);

      // Set lower limit for specific tool
      limiter.setLimit('limited-tool', { capacity: 5, refillRate: 1 });

      // Consume 5 tokens
      for (let i = 0; i < 5; i++) {
        limiter.check('limited-tool');
      }

      // 6th request should be rejected
      expect(limiter.check('limited-tool').allowed).toBe(false);
    });

    it('should reset existing bucket when limit changes', () => {
      const limiter = new RateLimiter(10, 1);

      // Consume some tokens
      limiter.check('tool');
      limiter.check('tool');

      // Change limit (should reset bucket)
      limiter.setLimit('tool', { capacity: 5, refillRate: 1 });

      // Should have fresh bucket with new capacity
      const result = limiter.check('tool');
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(4);
    });
  });

  describe('getStatus', () => {
    it('should return status for all active buckets', () => {
      const limiter = new RateLimiter(100, 10);

      limiter.check('tool-a');
      limiter.check('tool-b');
      limiter.check('tool-b');

      const status = limiter.getStatus();

      expect(status.get('tool-a')).toEqual({
        available: 99,
        capacity: 100,
      });

      expect(status.get('tool-b')).toEqual({
        available: 98,
        capacity: 100,
      });
    });

    it('should include custom capacities in status', () => {
      const customLimits = new Map([['special-tool', { capacity: 50, refillRate: 5 }]]);

      const limiter = new RateLimiter(100, 10, customLimits);
      limiter.check('special-tool');

      const status = limiter.getStatus();
      expect(status.get('special-tool')).toEqual({
        available: 49,
        capacity: 50,
      });
    });
  });

  describe('reset', () => {
    it('should reset specific bucket', () => {
      const limiter = new RateLimiter(10, 1);

      // Consume tokens
      for (let i = 0; i < 5; i++) {
        limiter.check('tool-a');
      }

      expect(limiter.check('tool-a').remainingTokens).toBe(4);

      // Reset
      limiter.reset('tool-a');

      // Should have full capacity again
      expect(limiter.check('tool-a').remainingTokens).toBe(9);
    });

    it('should not affect other buckets', () => {
      const limiter = new RateLimiter(10, 1);

      limiter.check('tool-a');
      limiter.check('tool-b');

      limiter.reset('tool-a');

      expect(limiter.check('tool-a').remainingTokens).toBe(9); // Reset
      expect(limiter.check('tool-b').remainingTokens).toBe(8); // Unchanged
    });
  });

  describe('resetAll', () => {
    it('should reset all buckets', () => {
      const limiter = new RateLimiter(10, 1);

      // Consume tokens from multiple tools
      for (let i = 0; i < 5; i++) {
        limiter.check('tool-a');
        limiter.check('tool-b');
      }

      limiter.resetAll();

      // All should be reset
      expect(limiter.check('tool-a').remainingTokens).toBe(9);
      expect(limiter.check('tool-b').remainingTokens).toBe(9);
    });
  });

  describe('real-world scenarios', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle burst then steady rate', () => {
      const limiter = new RateLimiter(10, 1); // Burst of 10, then 1/sec

      // Burst: consume all 10 tokens quickly
      for (let i = 0; i < 10; i++) {
        expect(limiter.check('api-call').allowed).toBe(true);
      }

      // 11th should be rejected
      expect(limiter.check('api-call').allowed).toBe(false);

      // Wait 1 second -> 1 token refilled
      vi.advanceTimersByTime(1000);
      expect(limiter.check('api-call').allowed).toBe(true);

      // Next one immediately should be rejected
      expect(limiter.check('api-call').allowed).toBe(false);
    });

    it('should handle 100 requests/minute limit', () => {
      const limiter = new RateLimiter(100, 100 / 60); // 100 per minute

      // Burst of 100 should succeed
      for (let i = 0; i < 100; i++) {
        expect(limiter.check('search').allowed).toBe(true);
      }

      // 101st should fail
      expect(limiter.check('search').allowed).toBe(false);

      // Wait 1 minute -> should refill to ~100
      vi.advanceTimersByTime(60000);

      // Should allow another 100
      for (let i = 0; i < 100; i++) {
        expect(limiter.check('search').allowed).toBe(true);
      }
    });
  });
});
