import { describe, expect, it } from 'vitest';
import type { AgentContext, Message } from '../../types';
import { PrAgent } from '../index';

describe('PrAgent', () => {
  const mockContext: AgentContext = {
    agentName: 'pr-test',
    logger: {
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: () => {},
    },
  } as unknown as AgentContext;

  it('should initialize with context', async () => {
    const agent = new PrAgent();

    await agent.initialize(mockContext);

    expect(agent.name).toBe('pr-test');
  });

  it('should have pr capabilities', () => {
    const agent = new PrAgent();

    expect(agent.capabilities).toContain('create-pr');
    expect(agent.capabilities).toContain('update-pr');
    expect(agent.capabilities).toContain('manage-issues');
    expect(agent.capabilities).toContain('comment');
  });

  it('should throw error when handling message without initialization', async () => {
    const agent = new PrAgent();
    const message: Message = {
      id: '1',
      type: 'request',
      sender: 'coordinator',
      recipient: 'pr',
      payload: {},
      priority: 5,
      timestamp: Date.now(),
    };

    await expect(agent.handleMessage(message)).rejects.toThrow('PR agent not initialized');
  });

  it('should return stub response for request messages', async () => {
    const agent = new PrAgent();
    await agent.initialize(mockContext);

    const message: Message = {
      id: '1',
      type: 'request',
      sender: 'coordinator',
      recipient: 'pr',
      payload: { action: 'create-pr' },
      priority: 5,
      timestamp: Date.now(),
    };

    const response = await agent.handleMessage(message);

    expect(response).not.toBeNull();
    expect(response?.type).toBe('response');
    expect(response?.sender).toBe('pr-test');
    expect(response?.recipient).toBe('coordinator');
    expect(response?.correlationId).toBe('1');
    expect(response?.payload.status).toBe('stub');
    expect(response?.payload.message).toContain('stub');
  });

  it('should preserve priority in response', async () => {
    const agent = new PrAgent();
    await agent.initialize(mockContext);

    const message: Message = {
      id: '1',
      type: 'request',
      sender: 'coordinator',
      recipient: 'pr',
      payload: {},
      priority: 8,
      timestamp: Date.now(),
    };

    const response = await agent.handleMessage(message);

    expect(response?.priority).toBe(8);
  });

  it('should return null for non-request messages', async () => {
    const agent = new PrAgent();
    await agent.initialize(mockContext);

    const message: Message = {
      id: '1',
      type: 'event',
      sender: 'coordinator',
      recipient: 'pr',
      payload: {},
      priority: 5,
      timestamp: Date.now(),
    };

    const response = await agent.handleMessage(message);

    expect(response).toBeNull();
  });

  it('should generate unique response ids', async () => {
    const agent = new PrAgent();
    await agent.initialize(mockContext);

    const message: Message = {
      id: '42',
      type: 'request',
      sender: 'coordinator',
      recipient: 'pr',
      payload: {},
      priority: 5,
      timestamp: Date.now(),
    };

    const response = await agent.handleMessage(message);

    expect(response?.id).toBe('42-response');
  });

  it('should pass health check when initialized', async () => {
    const agent = new PrAgent();
    await agent.initialize(mockContext);

    const healthy = await agent.healthCheck();

    expect(healthy).toBe(true);
  });

  it('should fail health check when not initialized', async () => {
    const agent = new PrAgent();

    const healthy = await agent.healthCheck();

    expect(healthy).toBe(false);
  });

  it('should fail health check after shutdown', async () => {
    const agent = new PrAgent();
    await agent.initialize(mockContext);
    await agent.shutdown();

    const healthy = await agent.healthCheck();

    expect(healthy).toBe(false);
  });

  it('should clear context on shutdown', async () => {
    const agent = new PrAgent();
    await agent.initialize(mockContext);

    await agent.shutdown();

    await expect(
      agent.handleMessage({
        id: '1',
        type: 'request',
        sender: 'coordinator',
        recipient: 'pr',
        payload: {},
        priority: 5,
        timestamp: Date.now(),
      })
    ).rejects.toThrow();
  });
});
