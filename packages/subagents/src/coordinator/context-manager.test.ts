import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepositoryIndexer } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Message } from '../types';
import { ContextManagerImpl } from './context-manager';

describe('ContextManagerImpl', () => {
  let contextManager: ContextManagerImpl;
  let tempDir: string;
  let indexer: RepositoryIndexer;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'context-manager-test-'));
    indexer = new RepositoryIndexer({
      repositoryPath: tempDir,
      vectorStorePath: join(tempDir, '.vector-store'),
      dimension: 384,
    });
    contextManager = new ContextManagerImpl();
  });

  afterEach(async () => {
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

  describe('state management', () => {
    it('should store and retrieve state', () => {
      contextManager.set('test-key', { value: 42 });
      expect(contextManager.get('test-key')).toEqual({ value: 42 });
    });

    it('should return undefined for non-existent keys', () => {
      expect(contextManager.get('non-existent')).toBeUndefined();
    });

    it('should overwrite existing state', () => {
      contextManager.set('key', 'old-value');
      contextManager.set('key', 'new-value');
      expect(contextManager.get('key')).toBe('new-value');
    });

    it('should handle multiple keys independently', () => {
      contextManager.set('key1', 'value1');
      contextManager.set('key2', 'value2');
      expect(contextManager.get('key1')).toBe('value1');
      expect(contextManager.get('key2')).toBe('value2');
    });

    it('should delete keys', () => {
      contextManager.set('key', 'value');
      expect(contextManager.has('key')).toBe(true);
      contextManager.delete('key');
      expect(contextManager.has('key')).toBe(false);
    });

    it('should clear all state', () => {
      contextManager.set('key1', 'value1');
      contextManager.set('key2', 'value2');
      contextManager.clear();
      expect(contextManager.keys()).toHaveLength(0);
    });

    it('should list all keys', () => {
      contextManager.set('key1', 'value1');
      contextManager.set('key2', 'value2');
      expect(contextManager.keys()).toEqual(expect.arrayContaining(['key1', 'key2']));
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

    it('should limit history to max size', () => {
      const smallContext = new ContextManagerImpl({ maxHistorySize: 10 });

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
    it('should return context statistics', () => {
      contextManager.set('key1', 'value1');
      contextManager.set('key2', 'value2');
      contextManager.addToHistory({
        id: 'msg-1',
        type: 'request',
        sender: 'test',
        recipient: 'test',
        payload: {},
        timestamp: Date.now(),
      });

      const stats = contextManager.getStats();
      expect(stats.stateSize).toBe(2);
      expect(stats.historySize).toBe(1);
      expect(stats.hasIndexer).toBe(false);
      expect(stats.maxHistorySize).toBe(1000); // default

      contextManager.setIndexer(indexer);
      expect(contextManager.getStats().hasIndexer).toBe(true);
    });
  });
});
