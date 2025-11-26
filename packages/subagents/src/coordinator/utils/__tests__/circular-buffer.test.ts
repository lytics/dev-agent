import { describe, expect, it } from 'vitest';
import { CircularBuffer } from '../circular-buffer';

describe('CircularBuffer', () => {
  describe('constructor', () => {
    it('should create buffer with specified size', () => {
      const buffer = new CircularBuffer<number>(5);
      expect(buffer.getMaxSize()).toBe(5);
      expect(buffer.size()).toBe(0);
    });

    it('should throw error for invalid size', () => {
      expect(() => new CircularBuffer<number>(0)).toThrow('maxSize must be > 0');
      expect(() => new CircularBuffer<number>(-1)).toThrow('maxSize must be > 0');
    });
  });

  describe('push and getAll', () => {
    it('should add items to empty buffer', () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.getAll()).toEqual([1, 2, 3]);
      expect(buffer.size()).toBe(3);
    });

    it('should maintain insertion order', () => {
      const buffer = new CircularBuffer<string>(3);
      buffer.push('a');
      buffer.push('b');
      buffer.push('c');

      expect(buffer.getAll()).toEqual(['a', 'b', 'c']);
    });

    it('should overwrite oldest items when full', () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // Overwrites 1
      buffer.push(5); // Overwrites 2

      expect(buffer.getAll()).toEqual([3, 4, 5]);
      expect(buffer.size()).toBe(3);
      expect(buffer.isFull()).toBe(true);
    });

    it('should handle filling buffer multiple times', () => {
      const buffer = new CircularBuffer<number>(2);

      // Fill once
      buffer.push(1);
      buffer.push(2);
      expect(buffer.getAll()).toEqual([1, 2]);

      // Fill again
      buffer.push(3);
      buffer.push(4);
      expect(buffer.getAll()).toEqual([3, 4]);

      // Fill again
      buffer.push(5);
      buffer.push(6);
      expect(buffer.getAll()).toEqual([5, 6]);
    });

    it('should handle complex objects', () => {
      interface Item {
        id: number;
        name: string;
      }

      const buffer = new CircularBuffer<Item>(2);
      buffer.push({ id: 1, name: 'first' });
      buffer.push({ id: 2, name: 'second' });
      buffer.push({ id: 3, name: 'third' }); // Overwrites first

      expect(buffer.getAll()).toEqual([
        { id: 2, name: 'second' },
        { id: 3, name: 'third' },
      ]);
    });
  });

  describe('getRecent', () => {
    it('should return most recent N items', () => {
      const buffer = new CircularBuffer<number>(10);
      for (let i = 1; i <= 10; i++) {
        buffer.push(i);
      }

      expect(buffer.getRecent(3)).toEqual([8, 9, 10]);
      expect(buffer.getRecent(5)).toEqual([6, 7, 8, 9, 10]);
      expect(buffer.getRecent(1)).toEqual([10]);
    });

    it('should return all items if N > size', () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.getRecent(10)).toEqual([1, 2, 3]);
    });

    it('should work after buffer wraps around', () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // Wraps: [2, 3, 4]

      expect(buffer.getRecent(2)).toEqual([3, 4]);
    });
  });

  describe('size and isFull', () => {
    it('should track size correctly', () => {
      const buffer = new CircularBuffer<number>(3);
      expect(buffer.size()).toBe(0);

      buffer.push(1);
      expect(buffer.size()).toBe(1);

      buffer.push(2);
      expect(buffer.size()).toBe(2);

      buffer.push(3);
      expect(buffer.size()).toBe(3);

      buffer.push(4); // Wraps
      expect(buffer.size()).toBe(3); // Still 3 (not 4)
    });

    it('should identify when buffer is full', () => {
      const buffer = new CircularBuffer<number>(2);
      expect(buffer.isFull()).toBe(false);

      buffer.push(1);
      expect(buffer.isFull()).toBe(false);

      buffer.push(2);
      expect(buffer.isFull()).toBe(true);

      buffer.push(3); // Still full
      expect(buffer.isFull()).toBe(true);
    });
  });

  describe('clear', () => {
    it('should reset buffer to empty state', () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      buffer.clear();

      expect(buffer.size()).toBe(0);
      expect(buffer.isFull()).toBe(false);
      expect(buffer.getAll()).toEqual([]);
    });

    it('should allow reuse after clear', () => {
      const buffer = new CircularBuffer<number>(2);
      buffer.push(1);
      buffer.push(2);
      buffer.clear();

      buffer.push(3);
      buffer.push(4);

      expect(buffer.getAll()).toEqual([3, 4]);
    });
  });

  describe('edge cases', () => {
    it('should handle size-1 buffer', () => {
      const buffer = new CircularBuffer<number>(1);
      buffer.push(1);
      expect(buffer.getAll()).toEqual([1]);

      buffer.push(2);
      expect(buffer.getAll()).toEqual([2]);
    });

    it('should handle empty buffer operations', () => {
      const buffer = new CircularBuffer<number>(5);
      expect(buffer.getAll()).toEqual([]);
      expect(buffer.getRecent(10)).toEqual([]);
      expect(buffer.size()).toBe(0);
      expect(buffer.isFull()).toBe(false);
    });

    it('should handle large buffer', () => {
      const buffer = new CircularBuffer<number>(10000);

      // Fill completely
      for (let i = 0; i < 10000; i++) {
        buffer.push(i);
      }

      expect(buffer.size()).toBe(10000);
      expect(buffer.isFull()).toBe(true);

      // Wrap around
      buffer.push(10000);
      expect(buffer.size()).toBe(10000);
      expect(buffer.getAll()[0]).toBe(1); // First element is now 1 (0 was overwritten)
    });
  });

  describe('memory efficiency', () => {
    it('should maintain constant memory usage', () => {
      const buffer = new CircularBuffer<number>(100);

      // Add way more items than buffer size
      for (let i = 0; i < 10000; i++) {
        buffer.push(i);
      }

      // Should only contain last 100
      expect(buffer.size()).toBe(100);
      expect(buffer.getAll().length).toBe(100);

      // Should contain items 9900-9999
      const all = buffer.getAll();
      expect(all[0]).toBe(9900);
      expect(all[99]).toBe(9999);
    });
  });
});
