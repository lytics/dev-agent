/**
 * Rate Limiter - Token Bucket Algorithm
 *
 * Prevents resource exhaustion by limiting request rates per tool.
 * Uses token bucket algorithm for smooth rate limiting with burst capacity.
 */

export interface RateLimitConfig {
  /** Maximum tokens (burst capacity) */
  capacity: number;
  /** Tokens refilled per second */
  refillRate: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until next token available
  remainingTokens?: number;
}

/**
 * Token Bucket - Core rate limiting primitive
 *
 * Allows burst traffic up to capacity, then enforces steady rate.
 * Tokens refill continuously at specified rate.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number
  ) {
    if (capacity <= 0) {
      throw new Error('TokenBucket capacity must be > 0');
    }
    if (refillRate <= 0) {
      throw new Error('TokenBucket refillRate must be > 0');
    }

    this.tokens = capacity; // Start with full bucket
    this.lastRefillTime = Date.now();
  }

  /**
   * Try to consume tokens from bucket
   * @param tokens Number of tokens to consume (default: 1)
   * @returns true if tokens were consumed, false if insufficient
   */
  tryConsume(tokens = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Get current number of available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Calculate seconds until next token is available
   */
  getRetryAfter(): number {
    this.refill();

    if (this.tokens >= 1) {
      return 0; // Tokens available now
    }

    // Time needed to refill 1 token
    return Math.ceil(1 / this.refillRate);
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;

    // Add tokens proportional to elapsed time
    const tokensToAdd = elapsedSeconds * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

    this.lastRefillTime = now;
  }

  /**
   * Reset bucket to full capacity (for testing/admin)
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTime = Date.now();
  }
}

/**
 * Rate Limiter - Manages multiple token buckets
 *
 * One bucket per tool/key for independent rate limiting.
 */
export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly defaultCapacity: number = 100,
    private readonly defaultRefillRate: number = 10, // 10 req/sec = 600 req/min
    private readonly customLimits: Map<string, RateLimitConfig> = new Map()
  ) {}

  /**
   * Check if request is allowed for given key (tool name)
   */
  check(key: string): RateLimitResult {
    const bucket = this.getBucket(key);
    const allowed = bucket.tryConsume();

    if (allowed) {
      return {
        allowed: true,
        remainingTokens: bucket.getAvailableTokens(),
      };
    }

    return {
      allowed: false,
      retryAfter: bucket.getRetryAfter(),
      remainingTokens: 0,
    };
  }

  /**
   * Get or create bucket for key
   */
  private getBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      const config = this.customLimits.get(key);
      const capacity = config?.capacity ?? this.defaultCapacity;
      const refillRate = config?.refillRate ?? this.defaultRefillRate;

      bucket = new TokenBucket(capacity, refillRate);
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  /**
   * Set custom limit for specific key
   */
  setLimit(key: string, config: RateLimitConfig): void {
    this.customLimits.set(key, config);

    // Remove existing bucket so new config applies
    this.buckets.delete(key);
  }

  /**
   * Get current status for all buckets
   */
  getStatus(): Map<string, { available: number; capacity: number }> {
    const status = new Map<string, { available: number; capacity: number }>();

    for (const [key, bucket] of this.buckets.entries()) {
      const config = this.customLimits.get(key);
      status.set(key, {
        available: bucket.getAvailableTokens(),
        capacity: config?.capacity ?? this.defaultCapacity,
      });
    }

    return status;
  }

  /**
   * Reset specific bucket (for testing/admin)
   */
  reset(key: string): void {
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.reset();
    }
  }

  /**
   * Reset all buckets (for testing/admin)
   */
  resetAll(): void {
    for (const bucket of this.buckets.values()) {
      bucket.reset();
    }
  }
}
