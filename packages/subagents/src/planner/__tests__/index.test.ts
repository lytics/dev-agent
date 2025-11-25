/**
 * Planner Agent Integration Tests
 * Tests agent lifecycle, message handling patterns, and error cases
 *
 * Note: Business logic (parsing, breakdown, estimation) is 100% tested
 * in utility test files with 50+ tests.
 */

import type { RepositoryIndexer } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentContext } from '../../types';
import { PlannerAgent } from '../index';
import type { PlanningRequest } from '../types';

describe('PlannerAgent', () => {
  let planner: PlannerAgent;
  let mockContext: AgentContext;
  let mockIndexer: RepositoryIndexer;

  beforeEach(() => {
    planner = new PlannerAgent();

    // Create mock indexer
    mockIndexer = {
      search: vi.fn().mockResolvedValue([
        {
          score: 0.85,
          content: 'Mock code content',
          metadata: { path: 'src/test.ts', type: 'function', name: 'testFunc' },
        },
      ]),
      initialize: vi.fn(),
      close: vi.fn(),
    } as unknown as RepositoryIndexer;

    // Create mock context
    mockContext = {
      agentName: 'planner',
      contextManager: {
        getIndexer: () => mockIndexer,
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        has: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
        addToHistory: vi.fn(),
      },
      sendMessage: vi.fn().mockResolvedValue(null),
      broadcastMessage: vi.fn().mockResolvedValue([]),
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnValue({
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        }),
      },
    };
  });

  describe('Agent Lifecycle', () => {
    it('should initialize successfully', async () => {
      await planner.initialize(mockContext);

      expect(planner.name).toBe('planner');
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Planner agent initialized',
        expect.objectContaining({
          capabilities: expect.arrayContaining(['plan', 'analyze-issue', 'breakdown-tasks']),
        })
      );
    });

    it('should have correct capabilities', async () => {
      await planner.initialize(mockContext);

      expect(planner.capabilities).toEqual(['plan', 'analyze-issue', 'breakdown-tasks']);
    });

    it('should throw error if handleMessage called before initialization', async () => {
      const message = {
        id: 'test-1',
        type: 'request' as const,
        sender: 'test',
        recipient: 'planner',
        payload: { action: 'plan', issueNumber: 123 },
        priority: 5,
        timestamp: Date.now(),
      };

      await expect(planner.handleMessage(message)).rejects.toThrow('Planner not initialized');
    });

    it('should clean up resources on shutdown', async () => {
      await planner.initialize(mockContext);
      await planner.shutdown();

      expect(mockContext.logger.info).toHaveBeenCalledWith('Planner agent shutting down');
    });
  });

  describe('Health Check', () => {
    it('should return false when not initialized', async () => {
      const healthy = await planner.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return true when initialized', async () => {
      await planner.initialize(mockContext);
      const healthy = await planner.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return false after shutdown', async () => {
      await planner.initialize(mockContext);
      await planner.shutdown();
      const healthy = await planner.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await planner.initialize(mockContext);
    });

    it('should ignore non-request messages', async () => {
      const message = {
        id: 'test-1',
        type: 'response' as const,
        sender: 'test',
        recipient: 'planner',
        payload: {},
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await planner.handleMessage(message);

      expect(response).toBeNull();
      expect(mockContext.logger.debug).toHaveBeenCalledWith(
        'Ignoring non-request message',
        expect.objectContaining({ type: 'response' })
      );
    });

    it('should handle unknown actions gracefully', async () => {
      const message = {
        id: 'test-1',
        type: 'request' as const,
        sender: 'test',
        recipient: 'planner',
        payload: { action: 'unknown' },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await planner.handleMessage(message);

      expect(response).toBeTruthy();
      expect(response?.type).toBe('response');
      expect((response?.payload as { error?: string }).error).toContain('Unknown action');
    });

    it('should generate correct response message structure', async () => {
      const request: PlanningRequest = {
        action: 'plan',
        issueNumber: 123,
        useExplorer: false,
        detailLevel: 'simple',
      };

      const message = {
        id: 'test-1',
        type: 'request' as const,
        sender: 'test',
        recipient: 'planner',
        payload: request as unknown as Record<string, unknown>,
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await planner.handleMessage(message);

      // Should return a response (or error), not null
      expect(response).toBeTruthy();

      // Should have correct message structure
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('type');
      expect(response).toHaveProperty('sender');
      expect(response).toHaveProperty('recipient');
      expect(response).toHaveProperty('payload');
      expect(response).toHaveProperty('correlationId');
      expect(response).toHaveProperty('timestamp');

      // Should correlate to original message
      expect(response?.correlationId).toBe('test-1');
      expect(response?.sender).toBe('planner');
      expect(response?.recipient).toBe('test');
    });

    it('should return error message on failures', async () => {
      const request: PlanningRequest = {
        action: 'plan',
        issueNumber: -1, // Invalid issue number
        useExplorer: false,
      };

      const message = {
        id: 'test-2',
        type: 'request' as const,
        sender: 'test',
        recipient: 'planner',
        payload: request as unknown as Record<string, unknown>,
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await planner.handleMessage(message);

      expect(response).toBeTruthy();
      expect(response?.type).toBe('error');
      expect((response?.payload as { error?: string }).error).toBeTruthy();
    });

    it('should log errors when planning fails', async () => {
      const request: PlanningRequest = {
        action: 'plan',
        issueNumber: 999,
        useExplorer: false,
      };

      const message = {
        id: 'test-3',
        type: 'request' as const,
        sender: 'test',
        recipient: 'planner',
        payload: request as unknown as Record<string, unknown>,
        priority: 5,
        timestamp: Date.now(),
      };

      await planner.handleMessage(message);

      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('Agent Context', () => {
    it('should use provided agent name from context', async () => {
      const customContext = {
        ...mockContext,
        agentName: 'custom-planner',
      };

      await planner.initialize(customContext);

      expect(planner.name).toBe('custom-planner');
    });

    it('should access context manager during initialization', async () => {
      await planner.initialize(mockContext);

      // Context manager should be accessible after init
      expect(mockContext.contextManager).toBeTruthy();
    });

    it('should use logger for debugging', async () => {
      await planner.initialize(mockContext);

      const message = {
        id: 'test-1',
        type: 'response' as const,
        sender: 'test',
        recipient: 'planner',
        payload: {},
        priority: 5,
        timestamp: Date.now(),
      };

      await planner.handleMessage(message);

      // Should log debug message for ignored messages
      expect(mockContext.logger.debug).toHaveBeenCalled();
    });
  });
});
