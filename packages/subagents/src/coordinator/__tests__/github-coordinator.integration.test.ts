/**
 * GitHub Agent + Coordinator Integration Tests
 * Tests GitHub agent registration and message routing through the coordinator
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubAgentConfig } from '../../github/agent';
import { GitHubAgent } from '../../github/agent';
import type { GitHubContextResult, GitHubDocument } from '../../github/types';
import { CoordinatorLogger } from '../../logger';
import { SubagentCoordinator } from '../coordinator';

// Mock GitHub utilities to avoid actual gh CLI calls
vi.mock('../../github/utils/index', () => ({
  fetchAllDocuments: vi.fn(() => [
    {
      type: 'issue',
      number: 1,
      title: 'Test Issue',
      body: 'Test body',
      state: 'open',
      author: 'testuser',
      labels: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      url: 'https://github.com/test/repo/issues/1',
      relatedIssues: [],
      relatedPRs: [],
      linkedFiles: [],
      mentions: [],
      repository: 'lytics/dev-agent',
      comments: 0,
      reactions: {},
    },
  ]),
  enrichDocument: vi.fn((doc: GitHubDocument) => doc),
  getCurrentRepository: vi.fn(() => 'lytics/dev-agent'),
  calculateRelevance: vi.fn(() => 0.8),
  matchesQuery: vi.fn(() => true),
}));

describe('Coordinator → GitHub Integration', () => {
  let coordinator: SubagentCoordinator;
  let github: GitHubAgent;
  let tempDir: string;
  let errorSpy: any; // Mock spy for CoordinatorLogger.error

  beforeEach(async () => {
    // Suppress error logs globally for all tests (expected errors during test setup)
    errorSpy = vi.spyOn(CoordinatorLogger.prototype, 'error').mockImplementation(() => {});

    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), 'gh-coordinator-test-'));

    // Create coordinator
    coordinator = new SubagentCoordinator({
      logLevel: 'error', // Reduce noise in tests
    });

    // Create GitHub agent with vector storage config
    const config: GitHubAgentConfig = {
      repositoryPath: process.cwd(),
      vectorStorePath: join(tempDir, '.github-vectors'),
      statePath: join(tempDir, 'github-state.json'),
      autoUpdate: false, // Disable for tests
    };
    github = new GitHubAgent(config);

    // Register with coordinator
    await coordinator.registerAgent(github);
  });

  afterEach(async () => {
    errorSpy.mockRestore();
    await coordinator.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Agent Registration', () => {
    it('should register GitHub agent successfully', () => {
      const agents = coordinator.getAgents();
      expect(agents).toContain('github');
    });

    it('should initialize GitHub agent with context', async () => {
      const healthCheck = await github.healthCheck();
      expect(healthCheck).toBe(true);
    });

    it('should prevent duplicate registration', async () => {
      const duplicate = new GitHubAgent({
        repositoryPath: process.cwd(),
        vectorStorePath: join(tempDir, '.github-vectors-dup'),
      });
      await expect(coordinator.registerAgent(duplicate)).rejects.toThrow('already registered');
    });

    it('should expose GitHub capabilities', () => {
      expect(github.capabilities).toContain('github-index');
      expect(github.capabilities).toContain('github-search');
      expect(github.capabilities).toContain('github-context');
      expect(github.capabilities).toContain('github-related');
    });
  });

  describe('Message Routing', () => {
    it('should route get-stats request to GitHub agent', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'index',
        } as unknown as Record<string, unknown>,
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');
      expect(response?.sender).toBe('github');

      const result = response?.payload as unknown as GitHubContextResult;
      expect(result).toBeDefined();
      expect(result.action).toBe('index');
    });

    it('should route search request to GitHub agent', async () => {
      // Index first (required for search)
      const indexResponse = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'index',
          indexOptions: {},
        } as unknown as Record<string, unknown>,
        priority: 5,
      });

      // Verify index completed
      expect(indexResponse?.type).toBe('response');
      const indexResult = indexResponse?.payload as unknown as GitHubContextResult;
      expect(indexResult.action).toBe('index');

      // Now search
      const searchResponse = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'search',
          query: 'test query',
          searchOptions: { limit: 10 },
        } as unknown as Record<string, unknown>,
        priority: 5,
      });

      expect(searchResponse).toBeDefined();
      expect(searchResponse?.type).toBe('response');

      const result = searchResponse?.payload as unknown as GitHubContextResult;
      expect(result.action).toBe('search');
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle context requests', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'context',
          issueNumber: 999,
        } as unknown as Record<string, unknown>,
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');

      const result = response?.payload as unknown as GitHubContextResult;
      expect(result.action).toBe('context');
    });

    it('should handle related requests', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'related',
          issueNumber: 999,
        } as unknown as Record<string, unknown>,
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');

      const result = response?.payload as unknown as GitHubContextResult;
      expect(result.action).toBe('related');
    });

    it('should handle non-request messages gracefully', async () => {
      const response = await coordinator.sendMessage({
        type: 'event',
        sender: 'test',
        recipient: 'github',
        payload: { data: 'test event' },
        priority: 5,
      });

      expect(response).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid actions', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'invalid-action',
        } as unknown as Record<string, unknown>,
        priority: 5,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');
    });

    it('should handle missing required fields', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'context',
          // Missing issueNumber
        } as unknown as Record<string, unknown>,
        priority: 5,
      });

      expect(response).toBeDefined();

      errorSpy.mockRestore();
    });
  });

  describe('Agent Lifecycle', () => {
    it('should handle shutdown cleanly', async () => {
      // Direct shutdown of agent
      await github.shutdown();

      const healthCheck = await github.healthCheck();
      expect(healthCheck).toBe(false);
    });

    it('should support graceful unregister', async () => {
      await coordinator.unregisterAgent('github');

      const agents = coordinator.getAgents();
      expect(agents).not.toContain('github');

      // Unregister calls shutdown, so health should fail
      const healthCheck = await github.healthCheck();
      expect(healthCheck).toBe(false);
    });
  });

  describe('Multi-Agent Coordination', () => {
    it('should work alongside other agents', async () => {
      // GitHub agent is already registered
      // Verify it doesn't interfere with other potential agents

      const agents = coordinator.getAgents();
      expect(agents).toContain('github');
      expect(agents.length).toBe(1);

      // GitHub should respond independently
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'search',
          query: 'test',
        } as unknown as Record<string, unknown>,
        priority: 5,
      });

      expect(response?.sender).toBe('github');
    });
  });
});
