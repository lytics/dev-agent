import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepositoryIndexer } from '@lytics/dev-agent-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextManagerImpl } from '../../coordinator/context-manager';
import { CoordinatorLogger } from '../../logger';
import type { AgentContext, Message } from '../../types';
import { ExplorerAgent } from '../index';

describe('ExplorerAgent', () => {
  let explorer: ExplorerAgent;
  let tempDir: string;
  let indexer: RepositoryIndexer;
  let contextManager: ContextManagerImpl;
  let context: AgentContext;

  beforeEach(async () => {
    // Create temp directory with test files
    tempDir = await mkdtemp(join(tmpdir(), 'explorer-test-'));

    // Create test files
    await writeFile(
      join(tempDir, 'auth.ts'),
      `export class AuthService {
        async authenticate(user: string, password: string) {
          // Authentication logic
          return true;
        }
      }`
    );

    await writeFile(
      join(tempDir, 'user.ts'),
      `export class UserService {
        async getUser(id: string) {
          // User retrieval logic
          return { id, name: 'Test' };
        }
      }`
    );

    // Initialize indexer
    indexer = new RepositoryIndexer({
      repositoryPath: tempDir,
      vectorStorePath: join(tempDir, '.vectors'),
      embeddingDimension: 384,
    });

    await indexer.initialize();
    await indexer.index();

    // Create context manager
    contextManager = new ContextManagerImpl();
    contextManager.setIndexer(indexer);

    // Create agent context
    const logger = new CoordinatorLogger('test-explorer', 'error');
    context = {
      agentName: 'explorer',
      contextManager,
      sendMessage: vi.fn(),
      broadcastMessage: vi.fn(),
      logger,
    };

    // Initialize explorer
    explorer = new ExplorerAgent();
    await explorer.initialize(context);
  });

  afterEach(async () => {
    await indexer.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const agent = new ExplorerAgent();
      await expect(agent.initialize(context)).resolves.toBeUndefined();
    });

    it('should have correct capabilities', () => {
      expect(explorer.capabilities).toContain('explore');
      expect(explorer.capabilities).toContain('analyze-patterns');
      expect(explorer.capabilities).toContain('find-similar');
    });

    it('should set agent name from context', () => {
      expect(explorer.name).toBe('explorer');
    });
  });

  describe('pattern search', () => {
    it('should search for patterns', async () => {
      const message: Message = {
        id: 'msg-1',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'authentication',
          limit: 5,
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');
      expect(response?.correlationId).toBe('msg-1');

      const result = response?.payload as { action: string; results: unknown[] };
      expect(result.action).toBe('pattern');
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should filter results by file types', async () => {
      const message: Message = {
        id: 'msg-2',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'class',
          fileTypes: ['.ts'],
          limit: 10,
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      expect(response).toBeDefined();
      const result = response?.payload as { results: unknown[] };
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const message: Message = {
        id: 'msg-3',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'function',
          limit: 2,
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      const result = response?.payload as { results: unknown[]; totalFound: number };
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should use custom threshold', async () => {
      const message: Message = {
        id: 'msg-threshold',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'service',
          threshold: 0.5,
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      expect(response).toBeDefined();
      expect(response?.type).toBe('response');
    });

    it('should handle empty file types array', async () => {
      const message: Message = {
        id: 'msg-empty-types',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'class',
          fileTypes: [],
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      expect(response).toBeDefined();
      const result = response?.payload as { results: unknown[] };
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('similar code search', () => {
    it('should find similar code', async () => {
      const message: Message = {
        id: 'msg-4',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'similar',
          filePath: 'auth.ts',
          limit: 5,
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');

      const result = response?.payload as { action: string; similar: unknown[] };
      expect(result.action).toBe('similar');
      expect(Array.isArray(result.similar)).toBe(true);
    });

    it('should exclude the reference file itself', async () => {
      const message: Message = {
        id: 'msg-5',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'similar',
          filePath: 'auth.ts',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      const result = response?.payload as { similar: Array<{ metadata: { path: string } }> };

      // None of the similar results should be the reference file itself
      const hasSelfReference = result.similar.some((r) => r.metadata.path === 'auth.ts');
      expect(hasSelfReference).toBe(false);
    });

    it('should use custom threshold for similarity', async () => {
      const message: Message = {
        id: 'msg-similar-threshold',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'similar',
          filePath: 'user.ts',
          threshold: 0.8,
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      expect(response).toBeDefined();
      const result = response?.payload as { similar: unknown[] };
      expect(Array.isArray(result.similar)).toBe(true);
    });

    it('should handle non-existent file gracefully', async () => {
      const message: Message = {
        id: 'msg-nonexistent',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'similar',
          filePath: 'nonexistent.ts',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      expect(response).toBeDefined();
      const result = response?.payload as { similar: unknown[] };
      expect(Array.isArray(result.similar)).toBe(true);
    });
  });

  describe('relationship discovery', () => {
    it('should find component relationships', async () => {
      const message: Message = {
        id: 'msg-6',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'relationships',
          component: 'AuthService',
          type: 'all',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      expect(response).toBeDefined();

      const result = response?.payload as { action: string; relationships: unknown[] };
      expect(result.action).toBe('relationships');
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it('should support different relationship types', async () => {
      const types = ['imports', 'exports', 'usages', 'all'] as const;

      for (const type of types) {
        const message: Message = {
          id: `msg-rel-${type}`,
          type: 'request',
          sender: 'test',
          recipient: 'explorer',
          payload: {
            action: 'relationships',
            component: 'UserService',
            type,
          },
          priority: 5,
          timestamp: Date.now(),
        };

        const response = await explorer.handleMessage(message);
        expect(response).toBeDefined();
        expect(response?.type).toBe('response');
      }
    });

    it('should handle dependencies relationship type', async () => {
      const message: Message = {
        id: 'msg-rel-deps',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'relationships',
          component: 'AuthService',
          type: 'dependencies',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      expect(response).toBeDefined();
      const result = response?.payload as { relationships: unknown[] };
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it('should respect limit for relationships', async () => {
      const message: Message = {
        id: 'msg-rel-limit',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'relationships',
          component: 'Service',
          limit: 5,
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      const result = response?.payload as { relationships: unknown[] };
      expect(result.relationships.length).toBeLessThanOrEqual(5);
    });

    it('should handle no type specified (defaults to all)', async () => {
      const message: Message = {
        id: 'msg-rel-default',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'relationships',
          component: 'UserService',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      expect(response).toBeDefined();
      const result = response?.payload as { relationships: unknown[] };
      expect(Array.isArray(result.relationships)).toBe(true);
    });
  });

  describe('insights', () => {
    it('should gather codebase insights', async () => {
      const message: Message = {
        id: 'msg-7',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'insights',
          type: 'all',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      expect(response).toBeDefined();

      const result = response?.payload as {
        action: string;
        insights: {
          fileCount: number;
          componentCount: number;
          topPatterns: unknown[];
        };
      };

      expect(result.action).toBe('insights');
      expect(result.insights.fileCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.insights.topPatterns)).toBe(true);
    });

    it('should include coverage information if data exists', async () => {
      const message: Message = {
        id: 'msg-8',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'insights',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      const result = response?.payload as {
        insights: {
          fileCount: number;
          componentCount: number;
          coverage?: {
            indexed: number;
            total: number;
            percentage: number;
          };
        };
      };

      // Coverage is optional - depends on indexer state
      expect(result.insights.fileCount).toBeGreaterThanOrEqual(0);
      expect(result.insights.componentCount).toBeGreaterThanOrEqual(0);

      if (result.insights.coverage) {
        expect(result.insights.coverage.indexed).toBeGreaterThanOrEqual(0);
        expect(result.insights.coverage.percentage).toBeGreaterThanOrEqual(0);
      }
    });

    it('should support different insight types', async () => {
      const types = ['patterns', 'complexity', 'coverage', 'all'] as const;

      for (const type of types) {
        const message: Message = {
          id: `msg-insight-${type}`,
          type: 'request',
          sender: 'test',
          recipient: 'explorer',
          payload: {
            action: 'insights',
            type,
          },
          priority: 5,
          timestamp: Date.now(),
        };

        const response = await explorer.handleMessage(message);
        expect(response).toBeDefined();
        expect(response?.type).toBe('response');

        const result = response?.payload as { insights: { fileCount: number } };
        expect(result.insights.fileCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle insights with no type specified', async () => {
      const message: Message = {
        id: 'msg-insight-default',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'insights',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      expect(response).toBeDefined();

      const result = response?.payload as { insights: { topPatterns: unknown[] } };
      expect(Array.isArray(result.insights.topPatterns)).toBe(true);
    });

    it('should analyze pattern frequency in codebase', async () => {
      // Add more files to ensure pattern analysis
      await writeFile(
        join(tempDir, 'helper.ts'),
        `export class Helper {
          async process() {
            const data = await fetch();
            return data;
          }
        }`
      );

      // Reindex
      await indexer.update();

      const message: Message = {
        id: 'msg-pattern-freq',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'insights',
          type: 'patterns',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      const result = response?.payload as {
        insights: {
          topPatterns: Array<{ pattern: string; count: number; files: string[] }>;
        };
      };

      expect(result.insights.topPatterns).toBeDefined();
      expect(Array.isArray(result.insights.topPatterns)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle unknown actions', async () => {
      // Suppress error logs for this intentional error test
      const errorSpy = vi.spyOn(CoordinatorLogger.prototype, 'error').mockImplementation(() => {});

      const message: Message = {
        id: 'msg-9',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'unknown-action',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      expect(response).toBeDefined();
      expect(response?.type).toBe('error');

      const result = response?.payload as { error?: string };
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid exploration request');

      errorSpy.mockRestore();
    });

    it('should return error response on failure', async () => {
      // Suppress error logs for this intentional error test
      const errorSpy = vi.spyOn(CoordinatorLogger.prototype, 'error').mockImplementation(() => {});

      // Create explorer without initialization
      const uninitializedExplorer = new ExplorerAgent();

      const message: Message = {
        id: 'msg-10',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'test',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      await expect(uninitializedExplorer.handleMessage(message)).rejects.toThrow();

      errorSpy.mockRestore();
    });

    it('should ignore non-request messages', async () => {
      const message: Message = {
        id: 'msg-11',
        type: 'event',
        sender: 'test',
        recipient: 'explorer',
        payload: {},
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);
      expect(response).toBeNull();
    });

    it('should handle errors during pattern search', async () => {
      // Close the indexer to cause an error
      await indexer.close();

      // Mock the logger to suppress expected error output
      const errorSpy = vi.spyOn(context.logger, 'error').mockImplementation(() => {});

      const message: Message = {
        id: 'msg-error-1',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'test',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      const response = await explorer.handleMessage(message);

      expect(response).toBeDefined();
      expect(response?.type).toBe('error');
      expect(response?.payload).toHaveProperty('error');
      expect(errorSpy).toHaveBeenCalled();

      // Restore logger and reinitialize for other tests
      errorSpy.mockRestore();
      await indexer.initialize();
      await indexer.index();
    });

    it('should include priority in error responses', async () => {
      const uninitializedExplorer = new ExplorerAgent();

      const message: Message = {
        id: 'msg-priority-error',
        type: 'request',
        sender: 'test',
        recipient: 'explorer',
        payload: {
          action: 'pattern',
          query: 'test',
        },
        priority: 5,
        timestamp: Date.now(),
      };

      await expect(uninitializedExplorer.handleMessage(message)).rejects.toThrow(
        'Explorer not initialized'
      );
    });
  });

  describe('health check', () => {
    it('should check health status', async () => {
      const healthy = await explorer.healthCheck();
      // Health check depends on indexer state - just verify it returns boolean
      expect(typeof healthy).toBe('boolean');
    });

    it('should return false when not initialized', async () => {
      const uninitializedExplorer = new ExplorerAgent();
      const healthy = await uninitializedExplorer.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return false when indexer has no data', async () => {
      // Create empty indexer
      const emptyDir = await mkdtemp(join(tmpdir(), 'empty-'));
      const emptyIndexer = new RepositoryIndexer({
        repositoryPath: emptyDir,
        vectorStorePath: join(emptyDir, '.vectors'),
      });

      await emptyIndexer.initialize();

      const emptyContext = new ContextManagerImpl();
      emptyContext.setIndexer(emptyIndexer);

      const emptyExplorer = new ExplorerAgent();
      await emptyExplorer.initialize({
        ...context,
        contextManager: emptyContext,
      });

      const healthy = await emptyExplorer.healthCheck();
      expect(healthy).toBe(false);

      await emptyIndexer.close();
      await rm(emptyDir, { recursive: true, force: true });
    });

    it('should return false when indexer throws error', async () => {
      // Create a context with a broken indexer
      const brokenContext = new ContextManagerImpl();
      const brokenIndexer = new RepositoryIndexer({
        repositoryPath: tempDir,
        vectorStorePath: join(tempDir, '.broken'),
      });
      // Don't initialize - will cause errors
      brokenContext.setIndexer(brokenIndexer);

      const testExplorer = new ExplorerAgent();
      await testExplorer.initialize({
        ...context,
        contextManager: brokenContext,
      });

      const healthy = await testExplorer.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(explorer.shutdown()).resolves.toBeUndefined();
    });

    it('should handle shutdown when not initialized', async () => {
      const uninitializedExplorer = new ExplorerAgent();
      await expect(uninitializedExplorer.shutdown()).resolves.toBeUndefined();
    });
  });
});
