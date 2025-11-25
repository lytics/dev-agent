import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepositoryIndexer } from '@lytics/dev-agent-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Message } from '../../types';
import { ContextManagerImpl } from '../context-manager';
import { MemoryStorageAdapter } from '../storage';

describe('ContextManagerImpl', () => {
  let contextManager: ContextManagerImpl;
  let tempDir: string;
  let indexer: RepositoryIndexer;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'context-manager-test-'));
    indexer = new RepositoryIndexer({
      repositoryPath: tempDir,
      vectorStorePath: join(tempDir, '.vector-store'),
      embeddingDimension: 384,
    });
    contextManager = new ContextManagerImpl();
    await contextManager.initialize();
  });

  afterEach(async () => {
    await contextManager.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('indexer management', () => {
    it('should set and get indexer', () => {
      contextManager.setIndexer(indexer);
      expect(contextManager.getIndexer()).toBe(indexer);
    });

    it('should throw if accessing indexer before setting', () => {
      expect(() => contextManager.getIndexer()).toThrow('Repository indexer not initialized');
    });

    it('should check if indexer exists', () => {
      expect(contextManager.hasIndexer()).toBe(false);
      contextManager.setIndexer(indexer);
      expect(contextManager.hasIndexer()).toBe(true);
    });
  });

  describe('session state management (async)', () => {
    it('should store and retrieve state', async () => {
      await contextManager.setAsync('test-key', { value: 42 });
      expect(await contextManager.getAsync('test-key')).toEqual({ value: 42 });
    });

    it('should return undefined for non-existent keys', async () => {
      expect(await contextManager.getAsync('non-existent')).toBeUndefined();
    });

    it('should overwrite existing state', async () => {
      await contextManager.setAsync('key', 'old-value');
      await contextManager.setAsync('key', 'new-value');
      expect(await contextManager.getAsync('key')).toBe('new-value');
    });

    it('should handle multiple keys independently', async () => {
      await contextManager.setAsync('key1', 'value1');
      await contextManager.setAsync('key2', 'value2');
      expect(await contextManager.getAsync('key1')).toBe('value1');
      expect(await contextManager.getAsync('key2')).toBe('value2');
    });

    it('should check if key exists', async () => {
      await contextManager.setAsync('key', 'value');
      expect(await contextManager.hasAsync('key')).toBe(true);
      expect(await contextManager.hasAsync('nonexistent')).toBe(false);
    });
  });

  describe('persistent state management', () => {
    it('should store and retrieve persistent state', async () => {
      await contextManager.setPersistent('pref:theme', 'dark');
      expect(await contextManager.getPersistent('pref:theme')).toBe('dark');
    });

    it('should return undefined for non-existent persistent keys', async () => {
      expect(await contextManager.getPersistent('nonexistent')).toBeUndefined();
    });

    it('should check if persistent key exists', async () => {
      await contextManager.setPersistent('key', 'value');
      expect(await contextManager.hasPersistent('key')).toBe(true);
      expect(await contextManager.hasPersistent('nonexistent')).toBe(false);
    });

    it('should delete persistent keys', async () => {
      await contextManager.setPersistent('key', 'value');
      expect(await contextManager.hasPersistent('key')).toBe(true);
      await contextManager.deletePersistent('key');
      expect(await contextManager.hasPersistent('key')).toBe(false);
    });

    it('should list persistent keys with prefix', async () => {
      await contextManager.setPersistent('user:name', 'Alice');
      await contextManager.setPersistent('user:email', 'alice@example.com');
      await contextManager.setPersistent('config:theme', 'dark');

      const userKeys = await contextManager.keysPersistent('user:');
      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('user:name');
      expect(userKeys).toContain('user:email');
    });
  });

  describe('message history', () => {
    let message: Message;

    beforeEach(() => {
      message = {
        id: 'msg-1',
        type: 'request',
        sender: 'test-sender',
        recipient: 'test-recipient',
        payload: { action: 'test' },
        priority: 5,
        timestamp: Date.now(),
      };
    });

    it('should start with empty history', () => {
      expect(contextManager.getHistory()).toEqual([]);
    });

    it('should add messages to history', () => {
      contextManager.addToHistory(message);
      expect(contextManager.getHistory()).toHaveLength(1);
      expect(contextManager.getHistory()[0]).toEqual(message);
    });

    it('should maintain message order', () => {
      const msg1 = { ...message, id: 'msg-1' };
      const msg2 = { ...message, id: 'msg-2' };
      const msg3 = { ...message, id: 'msg-3' };

      contextManager.addToHistory(msg1);
      contextManager.addToHistory(msg2);
      contextManager.addToHistory(msg3);

      const history = contextManager.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].id).toBe('msg-1');
      expect(history[1].id).toBe('msg-2');
      expect(history[2].id).toBe('msg-3');
    });

    it('should limit history to max size', async () => {
      const smallContext = new ContextManagerImpl({ maxHistorySize: 10 });
      await smallContext.initialize();

      // Add 20 messages
      for (let i = 0; i < 20; i++) {
        smallContext.addToHistory({
          ...message,
          id: `msg-${i}`,
        });
      }

      const history = smallContext.getHistory();
      expect(history).toHaveLength(10);
      expect(history[0].id).toBe('msg-10'); // Should start from 10th message
      expect(history[9].id).toBe('msg-19'); // Should end at 19th message

      await smallContext.shutdown();
    });

    it('should support history limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        contextManager.addToHistory({
          ...message,
          id: `msg-${i}`,
        });
      }

      const limited = contextManager.getHistory(5);
      expect(limited).toHaveLength(5);
      expect(limited[0].id).toBe('msg-5');
      expect(limited[4].id).toBe('msg-9');
    });

    it('should clear history', () => {
      contextManager.addToHistory(message);
      expect(contextManager.getHistory()).toHaveLength(1);
      contextManager.clearHistory();
      expect(contextManager.getHistory()).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should return context statistics', async () => {
      await contextManager.setAsync('key1', 'value1');
      await contextManager.setAsync('key2', 'value2');
      await contextManager.setPersistent('pref', 'value');
      contextManager.addToHistory({
        id: 'msg-1',
        type: 'request',
        sender: 'test',
        recipient: 'test',
        payload: {},
        priority: 5,
        timestamp: Date.now(),
      });

      const stats = await contextManager.getStats();
      expect(stats.sessionSize).toBe(2);
      expect(stats.persistentSize).toBe(1);
      expect(stats.historySize).toBe(1);
      expect(stats.hasIndexer).toBe(false);
      expect(stats.maxHistorySize).toBe(1000); // default

      contextManager.setIndexer(indexer);
      expect((await contextManager.getStats()).hasIndexer).toBe(true);
    });
  });

  describe('storage adapter access', () => {
    it('should provide access to session storage', () => {
      const sessionStorage = contextManager.getSessionStorage();
      expect(sessionStorage).toBeInstanceOf(MemoryStorageAdapter);
    });

    it('should provide access to persistent storage', () => {
      const persistentStorage = contextManager.getPersistentStorage();
      expect(persistentStorage).toBeInstanceOf(MemoryStorageAdapter);
    });

    it('should use custom storage adapters', async () => {
      const customSession = new MemoryStorageAdapter();
      const customPersistent = new MemoryStorageAdapter();

      const customContext = new ContextManagerImpl({
        sessionStorage: customSession,
        persistentStorage: customPersistent,
      });
      await customContext.initialize();

      expect(customContext.getSessionStorage()).toBe(customSession);
      expect(customContext.getPersistentStorage()).toBe(customPersistent);

      await customContext.shutdown();
    });
  });

  describe('lifecycle', () => {
    it('should initialize and shutdown cleanly', async () => {
      const ctx = new ContextManagerImpl();
      await expect(ctx.initialize()).resolves.toBeUndefined();
      await expect(ctx.shutdown()).resolves.toBeUndefined();
    });
  });
});
