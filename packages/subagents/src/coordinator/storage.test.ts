/**
 * Storage Adapter Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CompositeStorageAdapter, MemoryStorageAdapter, type StorageAdapter } from './storage';

describe('MemoryStorageAdapter', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  describe('basic operations', () => {
    it('should set and get values', async () => {
      await storage.set('key1', 'value1');
      expect(await storage.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', async () => {
      expect(await storage.get('nonexistent')).toBeUndefined();
    });

    it('should store complex objects', async () => {
      const obj = { nested: { array: [1, 2, 3] } };
      await storage.set('complex', obj);
      expect(await storage.get('complex')).toEqual(obj);
    });

    it('should overwrite existing values', async () => {
      await storage.set('key', 'first');
      await storage.set('key', 'second');
      expect(await storage.get('key')).toBe('second');
    });
  });

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await storage.set('exists', 'value');
      expect(await storage.has('exists')).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      expect(await storage.has('missing')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', async () => {
      await storage.set('toDelete', 'value');
      const result = await storage.delete('toDelete');
      expect(result).toBe(true);
      expect(await storage.has('toDelete')).toBe(false);
    });

    it('should return false when deleting non-existent keys', async () => {
      const result = await storage.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('keys', () => {
    beforeEach(async () => {
      await storage.set('user:name', 'Alice');
      await storage.set('user:email', 'alice@example.com');
      await storage.set('config:theme', 'dark');
    });

    it('should return all keys when no prefix', async () => {
      const keys = await storage.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('user:name');
      expect(keys).toContain('user:email');
      expect(keys).toContain('config:theme');
    });

    it('should filter keys by prefix', async () => {
      const userKeys = await storage.keys('user:');
      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('user:name');
      expect(userKeys).toContain('user:email');
    });

    it('should return empty array for non-matching prefix', async () => {
      const keys = await storage.keys('nonexistent:');
      expect(keys).toHaveLength(0);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await storage.set('user:name', 'Alice');
      await storage.set('user:email', 'alice@example.com');
      await storage.set('config:theme', 'dark');
    });

    it('should clear all keys when no prefix', async () => {
      await storage.clear();
      expect(await storage.size()).toBe(0);
    });

    it('should clear only keys matching prefix', async () => {
      await storage.clear('user:');
      expect(await storage.size()).toBe(1);
      expect(await storage.has('config:theme')).toBe(true);
      expect(await storage.has('user:name')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty storage', async () => {
      expect(await storage.size()).toBe(0);
    });

    it('should return correct count', async () => {
      await storage.set('a', 1);
      await storage.set('b', 2);
      await storage.set('c', 3);
      expect(await storage.size()).toBe(3);
    });
  });

  describe('lifecycle', () => {
    it('should have no-op initialize and shutdown', async () => {
      await expect(storage.initialize()).resolves.toBeUndefined();
      await expect(storage.shutdown()).resolves.toBeUndefined();
    });
  });
});

describe('CompositeStorageAdapter', () => {
  let composite: CompositeStorageAdapter;
  let session: MemoryStorageAdapter;
  let persistent: MemoryStorageAdapter;

  beforeEach(() => {
    session = new MemoryStorageAdapter();
    persistent = new MemoryStorageAdapter();
    composite = new CompositeStorageAdapter({ session, persistent });
  });

  describe('routing', () => {
    it('should route session: prefixed keys to session storage', async () => {
      await composite.set('session:lastQuery', 'test');
      expect(await session.get('lastQuery')).toBe('test');
      expect(await persistent.has('lastQuery')).toBe(false);
    });

    it('should route persistent: prefixed keys to persistent storage', async () => {
      await composite.set('persistent:userPref', 'dark');
      expect(await persistent.get('userPref')).toBe('dark');
      expect(await session.has('userPref')).toBe(false);
    });

    it('should default unprefixed keys to session storage', async () => {
      await composite.set('unprefixed', 'value');
      expect(await session.get('unprefixed')).toBe('value');
      expect(await persistent.has('unprefixed')).toBe(false);
    });
  });

  describe('get', () => {
    it('should get from correct storage based on prefix', async () => {
      await session.set('query', 'session-value');
      await persistent.set('query', 'persistent-value');

      expect(await composite.get('session:query')).toBe('session-value');
      expect(await composite.get('persistent:query')).toBe('persistent-value');
    });
  });

  describe('has', () => {
    it('should check correct storage based on prefix', async () => {
      await session.set('exists', true);

      expect(await composite.has('session:exists')).toBe(true);
      expect(await composite.has('persistent:exists')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete from correct storage based on prefix', async () => {
      await session.set('toDelete', 'value');
      await persistent.set('toDelete', 'value');

      await composite.delete('session:toDelete');
      expect(await session.has('toDelete')).toBe(false);
      expect(await persistent.has('toDelete')).toBe(true);
    });
  });

  describe('keys', () => {
    beforeEach(async () => {
      await session.set('a', 1);
      await session.set('b', 2);
      await persistent.set('c', 3);
    });

    it('should return keys from both storages with prefixes', async () => {
      const keys = await composite.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('session:a');
      expect(keys).toContain('session:b');
      expect(keys).toContain('persistent:c');
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await session.set('a', 1);
      await persistent.set('b', 2);
    });

    it('should clear both storages', async () => {
      await composite.clear();
      expect(await session.size()).toBe(0);
      expect(await persistent.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return combined size', async () => {
      await session.set('a', 1);
      await session.set('b', 2);
      await persistent.set('c', 3);

      expect(await composite.size()).toBe(3);
    });
  });

  describe('lifecycle', () => {
    it('should initialize both adapters', async () => {
      let sessionInit = false;
      let persistentInit = false;

      const mockSession: StorageAdapter = {
        ...new MemoryStorageAdapter(),
        initialize: async () => {
          sessionInit = true;
        },
      };
      const mockPersistent: StorageAdapter = {
        ...new MemoryStorageAdapter(),
        initialize: async () => {
          persistentInit = true;
        },
      };

      const comp = new CompositeStorageAdapter({
        session: mockSession,
        persistent: mockPersistent,
      });

      await comp.initialize();
      expect(sessionInit).toBe(true);
      expect(persistentInit).toBe(true);
    });

    it('should shutdown both adapters', async () => {
      let sessionShutdown = false;
      let persistentShutdown = false;

      const mockSession: StorageAdapter = {
        ...new MemoryStorageAdapter(),
        shutdown: async () => {
          sessionShutdown = true;
        },
      };
      const mockPersistent: StorageAdapter = {
        ...new MemoryStorageAdapter(),
        shutdown: async () => {
          persistentShutdown = true;
        },
      };

      const comp = new CompositeStorageAdapter({
        session: mockSession,
        persistent: mockPersistent,
      });

      await comp.shutdown();
      expect(sessionShutdown).toBe(true);
      expect(persistentShutdown).toBe(true);
    });
  });

  describe('direct access', () => {
    it('should provide access to underlying adapters', () => {
      expect(composite.getSessionAdapter()).toBe(session);
      expect(composite.getPersistentAdapter()).toBe(persistent);
    });
  });
});
