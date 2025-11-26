/**
 * Circular Buffer - Fixed-size FIFO buffer
 * Prevents unbounded memory growth in long-running processes
 *
 * When buffer is full, oldest entries are automatically overwritten.
 */
export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private writeIndex = 0;
  private count = 0;

  constructor(private readonly maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('CircularBuffer maxSize must be > 0');
    }
    this.buffer = new Array(maxSize);
  }

  /**
   * Add item to buffer (overwrites oldest if full)
   */
  push(item: T): void {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.maxSize;

    if (this.count < this.maxSize) {
      this.count++;
    }
  }

  /**
   * Get all items in buffer (in insertion order)
   */
  getAll(): T[] {
    if (this.count === 0) {
      return [];
    }

    // If buffer isn't full yet, return only filled portion
    if (this.count < this.maxSize) {
      return this.buffer.slice(0, this.count) as T[];
    }

    // Buffer is full - reconstruct in order
    const oldestIndex = this.writeIndex;
    const result: T[] = [];

    for (let i = 0; i < this.maxSize; i++) {
      const index = (oldestIndex + i) % this.maxSize;
      result.push(this.buffer[index] as T);
    }

    return result;
  }

  /**
   * Get the most recent N items
   */
  getRecent(n: number): T[] {
    const all = this.getAll();
    return all.slice(-n);
  }

  /**
   * Get current number of items in buffer
   */
  size(): number {
    return this.count;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.count === this.maxSize;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.buffer = new Array(this.maxSize);
    this.writeIndex = 0;
    this.count = 0;
  }

  /**
   * Get maximum buffer size
   */
  getMaxSize(): number {
    return this.maxSize;
  }
}
