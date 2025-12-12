/**
 * Integration Tests: Coordinator → Explorer
 * Tests the full flow from Coordinator to Explorer Agent
 */

import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepositoryIndexer } from '@lytics/dev-agent-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerAgent } from '../../explorer';
import { CoordinatorLogger } from '../../logger';
import { SubagentCoordinator } from '../coordinator';

describe('Coordinator → Explorer Integration', () => {
  let coordinator: SubagentCoordinator;
  let explorer: ExplorerAgent;
  let indexer: RepositoryIndexer;
  let testVectorPath: string;

  beforeEach(async () => {
    // Create temporary vector store
    testVectorPath = join(tmpdir(), `test-vectors-${Date.now()}`);
    await mkdir(testVectorPath, { recursive: true });

    // Initialize coordinator
    coordinator = new SubagentCoordinator({
      logLevel: 'error', // Quiet during tests
      healthCheckInterval: 0, // Disable periodic checks
    });

    // Initialize indexer (without indexing - tests will mock/stub as needed)
    indexer = new RepositoryIndexer({
      repositoryPath: process.cwd(),
      vectorStorePath: testVectorPath,
    });
    await indexer.initialize();

    // Note: NOT indexing the full repo to avoid OOM in tests
    // Tests will use the indexer API without real data

    // Set indexer in coordinator context
    coordinator.getContextManager().setIndexer(indexer);

    // Create and register Explorer
    explorer = new ExplorerAgent();
    await coordinator.registerAgent(explorer);

    coordinator.start();
  });

  afterEach(async () => {
    await coordinator.stop();
    await indexer.close();
    await rm(testVectorPath, { recursive: true, force: true });
  });

  describe('Agent Registration', () => {
    it('should register Explorer successfully', () => {
      const agents = coordinator.getAgents();
      expect(agents).toContain('explorer');
    });

    it('should initialize Explorer with context', async () => {
      // Explorer is initialized but reports unhealthy without indexed data
      const healthCheck = await explorer.healthCheck();
      expect(healthCheck).toBe(false); // No vectors stored yet

      // But it's still registered and can receive messages
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: { action: 'pattern', query: 'test' },
        priority: 5,
      });
      expect(response).toBeDefined();
    });

    it('should prevent duplicate registration', async () => {
      const duplicate = new ExplorerAgent();
      await expect(coordinator.registerAgent(duplicate)).rejects.toThrow('already registered');
    });
  });

  describe('Message Routing', () => {
    it('should route pattern search request to Explorer', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'RepositoryIndexer',
          limit: 5,
          threshold: 0.7,
        },
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');
      expect(response?.sender).toBe('explorer');

      const result = response?.payload as { action: string; results?: unknown[] };
      expect(result.action).toBe('pattern');
      // Results array exists (may be empty without indexed data)
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should route similar code request to Explorer', async () => {
      // Suppress error logs for validation failures (missing filePath)
      const errorSpy = vi.spyOn(CoordinatorLogger.prototype, 'error').mockImplementation(() => {});

      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'similar',
          content: 'export class RepositoryIndexer { constructor() { } }',
          limit: 3,
          threshold: 0.5,
        },
        priority: 5,
      });

      expect(response).toBeDefined();
      // May be error or response depending on indexer state
      expect(['response', 'error']).toContain(response?.type);

      if (response?.type === 'response') {
        const result = response.payload as { action: string; results?: unknown[] };
        expect(result.action).toBe('similar');
        expect(Array.isArray(result.results)).toBe(true);
      }

      errorSpy.mockRestore();
    });

    it('should route relationships request to Explorer', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'relationships',
          component: 'RepositoryIndexer',
          depth: 1,
        },
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');

      const result = response?.payload as { action: string; relationships?: unknown[] };
      expect(result.action).toBe('relationships');
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it('should route insights request to Explorer', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'insights',
          scope: 'repository',
          includePatterns: true,
        },
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');

      const result = response?.payload as { action: string; insights?: unknown };
      expect(result.action).toBe('insights');
      expect(result.insights).toBeDefined();
    });

    it('should handle unknown actions gracefully', async () => {
      // Suppress error logs for this intentional error test
      const errorSpy = vi.spyOn(CoordinatorLogger.prototype, 'error').mockImplementation(() => {});

      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'unknown-action',
        },
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('error');

      const result = response?.payload as { error?: string };
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid exploration request');

      errorSpy.mockRestore();
    });

    it('should handle non-existent agent gracefully', async () => {
      // Suppress error logs for this intentional error test
      const errorSpy = vi.spyOn(CoordinatorLogger.prototype, 'error').mockImplementation(() => {});

      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'non-existent-agent',
        payload: {},
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('error');

      const error = response?.payload as { error: string };
      expect(error.error).toContain('not found');

      errorSpy.mockRestore();
    });
  });

  describe('Task Execution', () => {
    it('should execute pattern search task via task queue', async () => {
      const taskId = coordinator.submitTask({
        type: 'pattern-search',
        agentName: 'explorer',
        payload: {
          action: 'pattern',
          query: 'SubagentCoordinator',
          limit: 5,
        },
        priority: 10,
        maxRetries: 3,
      });

      expect(taskId).toBeDefined();

      // Wait for task to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const task = coordinator.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe('completed');
    });

    it('should track task statistics', async () => {
      coordinator.submitTask({
        type: 'insights',
        agentName: 'explorer',
        payload: {
          action: 'insights',
          scope: 'repository',
        },
        priority: 5,
        maxRetries: 3,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = coordinator.getStats();
      expect(stats.tasksCompleted).toBeGreaterThan(0);
    });
  });

  describe('Health Checks', () => {
    it('should report Explorer health status based on indexed data', async () => {
      // Without indexed data, health check returns false
      const isHealthy = await explorer.healthCheck();
      expect(isHealthy).toBe(false);

      // Note: In production with indexed data, this would return true
    });

    it('should track message statistics', async () => {
      await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'test',
        },
        priority: 5,
      });

      const stats = coordinator.getStats();
      expect(stats.messagesSent).toBeGreaterThan(0);
      expect(stats.messagesReceived).toBeGreaterThan(0);
    });
  });

  describe('Context Management', () => {
    it('should share indexer context between Coordinator and Explorer', async () => {
      const contextIndexer = coordinator.getContextManager().getIndexer();
      expect(contextIndexer).toBeDefined();
      expect(contextIndexer).toBe(indexer);
    });

    it('should allow Explorer to access shared context', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'test',
        },
        priority: 5,
      });

      // Should succeed because indexer is in shared context
      expect(response?.type).toBe('response');
    });
  });

  describe('Shutdown', () => {
    it('should gracefully unregister Explorer', async () => {
      await coordinator.unregisterAgent('explorer');

      const agents = coordinator.getAgents();
      expect(agents).not.toContain('explorer');
    });

    it('should stop coordinator and all agents', async () => {
      await coordinator.stop();

      const agents = coordinator.getAgents();
      expect(agents).toHaveLength(0);
    });

    it('should cleanup event listeners on stop', async () => {
      const eventBus = coordinator.getEventBus();
      let eventFired = false;

      // Subscribe to an event
      eventBus.on('test.event', () => {
        eventFired = true;
      });

      // Verify event listener works before stop
      await eventBus.emit('test.event', {});
      expect(eventFired).toBe(true);

      // Stop coordinator (should clean up listeners)
      await coordinator.stop();

      // Reset flag and try to emit again
      eventFired = false;
      await eventBus.emit('test.event', {});

      // Event listener should have been removed (event won't fire)
      expect(eventFired).toBe(false);
    });
  });
});
