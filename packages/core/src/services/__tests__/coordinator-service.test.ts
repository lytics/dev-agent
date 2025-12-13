/**
 * Tests for CoordinatorService
 */

import { describe, expect, it, vi } from 'vitest';
import type { RepositoryIndexer } from '../../indexer/index.js';
import type { SubagentCoordinator } from '../coordinator-service.js';
import { CoordinatorService } from '../coordinator-service.js';

describe('CoordinatorService', () => {
  describe('createCoordinator', () => {
    it('should create and configure coordinator with all agents', async () => {
      const mockIndexer = {} as RepositoryIndexer;

      const mockContextManager = {
        setIndexer: vi.fn(),
      };

      const mockCoordinator: SubagentCoordinator = {
        registerAgent: vi.fn().mockResolvedValue(undefined),
        getContextManager: vi.fn().mockReturnValue(mockContextManager),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      const mockExplorerAgent = { name: 'explorer' };
      const mockPlannerAgent = { name: 'planner' };
      const mockPrAgent = { name: 'pr' };

      const factories = {
        createCoordinator: vi.fn().mockResolvedValue(mockCoordinator),
        createExplorerAgent: vi.fn().mockResolvedValue(mockExplorerAgent),
        createPlannerAgent: vi.fn().mockResolvedValue(mockPlannerAgent),
        createPrAgent: vi.fn().mockResolvedValue(mockPrAgent),
      };

      const service = new CoordinatorService(
        {
          repositoryPath: '/test/repo',
          maxConcurrentTasks: 10,
          defaultMessageTimeout: 60000,
          logLevel: 'debug',
        },
        factories
      );

      const coordinator = await service.createCoordinator(mockIndexer);

      // Verify coordinator factory called with correct config
      expect(factories.createCoordinator).toHaveBeenCalledWith({
        maxConcurrentTasks: 10,
        defaultMessageTimeout: 60000,
        logLevel: 'debug',
      });

      // Verify context manager setup
      expect(mockCoordinator.getContextManager).toHaveBeenCalledOnce();
      expect(mockContextManager.setIndexer).toHaveBeenCalledWith(mockIndexer);

      // Verify all agents created
      expect(factories.createExplorerAgent).toHaveBeenCalledOnce();
      expect(factories.createPlannerAgent).toHaveBeenCalledOnce();
      expect(factories.createPrAgent).toHaveBeenCalledOnce();

      // Verify all agents registered
      expect(mockCoordinator.registerAgent).toHaveBeenCalledTimes(3);
      expect(mockCoordinator.registerAgent).toHaveBeenCalledWith(mockExplorerAgent);
      expect(mockCoordinator.registerAgent).toHaveBeenCalledWith(mockPlannerAgent);
      expect(mockCoordinator.registerAgent).toHaveBeenCalledWith(mockPrAgent);

      expect(coordinator).toBe(mockCoordinator);
    });

    it('should use default configuration when not provided', async () => {
      const mockIndexer = {} as RepositoryIndexer;
      const mockContextManager = { setIndexer: vi.fn() };
      const mockCoordinator: SubagentCoordinator = {
        registerAgent: vi.fn().mockResolvedValue(undefined),
        getContextManager: vi.fn().mockReturnValue(mockContextManager),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      const factories = {
        createCoordinator: vi.fn().mockResolvedValue(mockCoordinator),
        createExplorerAgent: vi.fn().mockResolvedValue({}),
        createPlannerAgent: vi.fn().mockResolvedValue({}),
        createPrAgent: vi.fn().mockResolvedValue({}),
      };

      const service = new CoordinatorService({ repositoryPath: '/test/repo' }, factories);

      await service.createCoordinator(mockIndexer);

      // Verify default configuration used
      expect(factories.createCoordinator).toHaveBeenCalledWith({
        maxConcurrentTasks: 5, // default
        defaultMessageTimeout: 30000, // default
        logLevel: 'info', // default
      });
    });

    it('should register agents in order', async () => {
      const mockIndexer = {} as RepositoryIndexer;
      const mockContextManager = { setIndexer: vi.fn() };

      const registrationOrder: string[] = [];
      const mockCoordinator: SubagentCoordinator = {
        registerAgent: vi.fn().mockImplementation((agent: { name: string }) => {
          registrationOrder.push(agent.name);
          return Promise.resolve();
        }),
        getContextManager: vi.fn().mockReturnValue(mockContextManager),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      const factories = {
        createCoordinator: vi.fn().mockResolvedValue(mockCoordinator),
        createExplorerAgent: vi.fn().mockResolvedValue({ name: 'explorer' }),
        createPlannerAgent: vi.fn().mockResolvedValue({ name: 'planner' }),
        createPrAgent: vi.fn().mockResolvedValue({ name: 'pr' }),
      };

      const service = new CoordinatorService({ repositoryPath: '/test/repo' }, factories);

      await service.createCoordinator(mockIndexer);

      expect(registrationOrder).toEqual(['explorer', 'planner', 'pr']);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const service = new CoordinatorService({
        repositoryPath: '/test/repo',
        maxConcurrentTasks: 5,
        defaultMessageTimeout: 30000,
        logLevel: 'info',
      });

      service.updateConfig({
        maxConcurrentTasks: 10,
        logLevel: 'debug',
      });

      const config = service.getConfig();
      expect(config.maxConcurrentTasks).toBe(10);
      expect(config.defaultMessageTimeout).toBe(30000); // unchanged
      expect(config.logLevel).toBe('debug');
    });

    it('should partially update configuration', () => {
      const service = new CoordinatorService({
        repositoryPath: '/test/repo',
      });

      service.updateConfig({ maxConcurrentTasks: 15 });

      const config = service.getConfig();
      expect(config.maxConcurrentTasks).toBe(15);
      expect(config.defaultMessageTimeout).toBe(30000); // default
      expect(config.logLevel).toBe('info'); // default
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const service = new CoordinatorService({
        repositoryPath: '/test/repo',
        maxConcurrentTasks: 7,
        defaultMessageTimeout: 45000,
        logLevel: 'warn',
      });

      const config = service.getConfig();

      expect(config).toEqual({
        maxConcurrentTasks: 7,
        defaultMessageTimeout: 45000,
        logLevel: 'warn',
      });
    });

    it('should return default configuration when not specified', () => {
      const service = new CoordinatorService({ repositoryPath: '/test/repo' });

      const config = service.getConfig();

      expect(config).toEqual({
        maxConcurrentTasks: 5,
        defaultMessageTimeout: 30000,
        logLevel: 'info',
      });
    });
  });
});
