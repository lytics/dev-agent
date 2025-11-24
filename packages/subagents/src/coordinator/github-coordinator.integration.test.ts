/**
 * GitHub Agent + Coordinator Integration Tests
 * Tests GitHub agent registration and message routing through the coordinator
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepositoryIndexer } from '@lytics/dev-agent-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitHubAgentConfig } from '../github/agent';
import { GitHubAgent } from '../github/agent';
import type { GitHubContextRequest, GitHubContextResult } from '../github/types';
import { SubagentCoordinator } from './coordinator';

describe('Coordinator → GitHub Integration', () => {
  let coordinator: SubagentCoordinator;
  let github: GitHubAgent;
  let tempDir: string;
  let codeIndexer: RepositoryIndexer;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), 'gh-coordinator-test-'));

    // Initialize code indexer
    codeIndexer = new RepositoryIndexer({
      repositoryPath: process.cwd(),
      vectorStorePath: join(tempDir, '.vectors'),
    });
    await codeIndexer.initialize();

    // Create coordinator
    coordinator = new SubagentCoordinator({
      logLevel: 'error', // Reduce noise in tests
    });

    // Create GitHub agent
    const config: GitHubAgentConfig = {
      repositoryPath: process.cwd(),
      codeIndexer,
      storagePath: join(tempDir, '.github-index'),
    };
    github = new GitHubAgent(config);

    // Register with coordinator
    await coordinator.registerAgent(github);
  });

  afterEach(async () => {
    await coordinator.stop();
    await codeIndexer.close();
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
        codeIndexer,
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
        } as GitHubContextRequest,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');
      expect(response?.sender).toBe('github');

      const result = response?.payload as GitHubContextResult;
      expect(result).toBeDefined();
      expect(result.action).toBe('index');
    });

    it('should route search request to GitHub agent', async () => {
      const response = await coordinator.sendMessage({
        type: 'request',
        sender: 'test',
        recipient: 'github',
        payload: {
          action: 'search',
          query: 'test query',
          searchOptions: { limit: 10 },
        } as GitHubContextRequest,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');

      const result = response?.payload as GitHubContextResult;
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
        } as GitHubContextRequest,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');

      const result = response?.payload as GitHubContextResult;
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
        } as GitHubContextRequest,
      });

      expect(response).toBeDefined();
      expect(response?.type).toBe('response');

      const result = response?.payload as GitHubContextResult;
      expect(result.action).toBe('related');
    });

    it('should handle non-request messages gracefully', async () => {
      const response = await coordinator.sendMessage({
        type: 'event',
        sender: 'test',
        recipient: 'github',
        payload: { data: 'test event' },
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
        } as unknown as GitHubContextRequest,
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
        } as unknown as GitHubContextRequest,
      });

      expect(response).toBeDefined();
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
        } as GitHubContextRequest,
      });

      expect(response?.sender).toBe('github');
    });
  });
});
