/**
 * Subagent Coordinator = Central Nervous System
 * Orchestrates multiple specialized agents (brain regions)
 */

import { randomUUID } from 'node:crypto';
import { AsyncEventBus } from '@lytics/dev-agent-core';
import { CoordinatorLogger } from '../logger';
import type {
  Agent,
  AgentContext,
  CoordinatorOptions,
  CoordinatorStats,
  Message,
  Task,
} from '../types';
import { ContextManagerImpl } from './context-manager';
import { TaskQueue } from './task-queue';

export class SubagentCoordinator {
  private agents: Map<string, Agent> = new Map();
  private contextManager: ContextManagerImpl;
  private taskQueue: TaskQueue;
  private logger: CoordinatorLogger;
  private options: Required<CoordinatorOptions>;
  private eventBus: AsyncEventBus;

  // Statistics
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    messageErrors: 0,
    responseTimes: [] as number[],
  };

  private startTime: number;
  private healthCheckTimer?: NodeJS.Timeout;
  private taskProcessingTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(options: CoordinatorOptions = {}) {
    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks || 5,
      defaultMessageTimeout: options.defaultMessageTimeout || 30000,
      defaultMaxRetries: options.defaultMaxRetries || 3,
      healthCheckInterval: options.healthCheckInterval || 60000,
      logLevel: options.logLevel || 'info',
    };

    this.logger = new CoordinatorLogger('coordinator', this.options.logLevel);
    this.contextManager = new ContextManagerImpl();
    this.taskQueue = new TaskQueue(this.options.maxConcurrentTasks, this.logger);
    this.eventBus = new AsyncEventBus({
      source: 'coordinator',
      debug: this.options.logLevel === 'debug',
    });
    this.startTime = Date.now();

    this.logger.info('Subagent Coordinator initialized', {
      maxConcurrentTasks: this.options.maxConcurrentTasks,
      logLevel: this.options.logLevel,
    });
  }

  /**
   * Get the event bus for pub/sub communication
   */
  getEventBus(): AsyncEventBus {
    return this.eventBus;
  }

  /**
   * Register an agent (connect a brain region)
   */
  async registerAgent(agent: Agent): Promise<void> {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent '${agent.name}' is already registered`);
    }

    this.logger.info('Registering agent', {
      name: agent.name,
      capabilities: agent.capabilities,
    });

    // Create agent context (neural connection)
    const context: AgentContext = {
      agentName: agent.name,
      contextManager: this.contextManager,
      sendMessage: (msg) => this.sendMessage({ ...msg, sender: agent.name }),
      broadcastMessage: (msg) => this.broadcastMessage({ ...msg, sender: agent.name }),
      logger: this.logger.child(agent.name),
    };

    // Initialize agent
    try {
      await agent.initialize(context);
      this.agents.set(agent.name, agent);

      this.logger.info('Agent registered successfully', {
        name: agent.name,
        totalAgents: this.agents.size,
      });

      // Emit agent registered event
      await this.eventBus.emit('agent.registered', {
        name: agent.name,
        capabilities: agent.capabilities,
      });
    } catch (error) {
      this.logger.error(`Failed to initialize agent '${agent.name}'`, error as Error);
      throw error;
    }
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentName: string, reason?: string): Promise<void> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      this.logger.warn('Attempted to unregister unknown agent', { agentName });
      return;
    }

    this.logger.info('Unregistering agent', { agentName });

    try {
      await agent.shutdown();
      this.agents.delete(agentName);

      this.logger.info('Agent unregistered successfully', {
        agentName,
        remainingAgents: this.agents.size,
      });

      // Emit agent unregistered event
      await this.eventBus.emit('agent.unregistered', {
        name: agentName,
        reason,
      });
    } catch (error) {
      this.logger.error(`Error shutting down agent '${agentName}'`, error as Error);
      // Remove anyway
      this.agents.delete(agentName);

      // Still emit the event
      await this.eventBus.emit('agent.unregistered', {
        name: agentName,
        reason: 'error',
      });
    }
  }

  /**
   * Send a message to a specific agent (directed action potential)
   */
  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message | null> {
    const fullMessage: Message = {
      ...message,
      id: randomUUID(),
      timestamp: Date.now(),
      priority: message.priority || 5,
    };

    this.stats.messagesSent++;
    this.contextManager.addToHistory(fullMessage);

    this.logger.debug('Sending message', {
      id: fullMessage.id,
      type: fullMessage.type,
      from: fullMessage.sender,
      to: fullMessage.recipient,
    });

    const agent = this.agents.get(fullMessage.recipient);
    if (!agent) {
      this.stats.messageErrors++;
      this.logger.error('Agent not found', undefined, {
        agentName: fullMessage.recipient,
      });

      return this.createErrorResponse(fullMessage, `Agent '${fullMessage.recipient}' not found`);
    }

    const startTime = Date.now();

    try {
      const timeout = fullMessage.timeout || this.options.defaultMessageTimeout;
      const response = await this.withTimeout(
        agent.handleMessage(fullMessage),
        timeout,
        `Message to '${fullMessage.recipient}' timed out`
      );

      if (response) {
        this.stats.messagesReceived++;
        this.stats.responseTimes.push(Date.now() - startTime);
        this.contextManager.addToHistory(response);
      }

      return response;
    } catch (error) {
      this.stats.messageErrors++;
      this.logger.error('Error handling message', error as Error, {
        messageId: fullMessage.id,
        agentName: fullMessage.recipient,
      });

      return this.createErrorResponse(fullMessage, (error as Error).message);
    }
  }

  /**
   * Broadcast a message to all agents (neural broadcast)
   */
  async broadcastMessage(
    message: Omit<Message, 'id' | 'timestamp' | 'recipient'>
  ): Promise<Message[]> {
    this.logger.debug('Broadcasting message', {
      type: message.type,
      from: message.sender,
    });

    const responses: Message[] = [];

    for (const [agentName, _agent] of this.agents.entries()) {
      if (agentName !== message.sender) {
        const response = await this.sendMessage({
          ...message,
          recipient: agentName,
        });

        if (response) {
          responses.push(response);
        }
      }
    }

    return responses;
  }

  /**
   * Submit a task for execution
   */
  submitTask(task: Omit<Task, 'id' | 'createdAt' | 'status' | 'retries'>): string {
    const fullTask: Task = {
      ...task,
      id: randomUUID(),
      createdAt: Date.now(),
      status: 'pending',
      retries: 0,
      maxRetries: task.maxRetries || this.options.defaultMaxRetries,
      priority: task.priority || 5,
    };

    this.taskQueue.enqueue(fullTask);

    this.logger.info('Task submitted', {
      taskId: fullTask.id,
      type: fullTask.type,
      agentName: fullTask.agentName,
      priority: fullTask.priority,
    });

    // Try to process tasks immediately
    this.processTasks();

    return fullTask.id;
  }

  /**
   * Get task status
   */
  getTask(taskId: string): Task | undefined {
    return this.taskQueue.get(taskId);
  }

  /**
   * Process queued tasks
   */
  private async processTasks(): Promise<void> {
    while (this.taskQueue.canRunMore()) {
      const task = this.taskQueue.getNext();
      if (!task) {
        break;
      }

      this.executeTask(task);
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    this.taskQueue.markRunning(task.id);

    try {
      // Send task as a request message to the agent
      const response = await this.sendMessage({
        type: 'request',
        sender: 'coordinator',
        recipient: task.agentName,
        payload: {
          taskId: task.id,
          taskType: task.type,
          ...task.payload,
        },
        priority: task.priority,
      });

      if (response && response.type === 'response') {
        this.taskQueue.markCompleted(task.id, response.payload);
      } else if (response && response.type === 'error') {
        throw new Error((response.payload.error as string) || 'Task failed');
      } else {
        throw new Error('No response from agent');
      }
    } catch (error) {
      this.taskQueue.markFailed(task.id, error as Error);

      // Retry if possible
      if (this.taskQueue.shouldRetry(task.id)) {
        this.taskQueue.retry(task.id);
      }
    } finally {
      // Process more tasks
      this.processTasks();
    }
  }

  /**
   * Start the coordinator (activate the nervous system)
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Coordinator already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting coordinator');

    // Start health checks
    if (this.options.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(
        () => this.performHealthChecks(),
        this.options.healthCheckInterval
      );
    }

    // Start task cleanup
    this.taskProcessingTimer = setInterval(() => {
      this.taskQueue.cleanup();
    }, 300000); // Every 5 minutes
  }

  /**
   * Stop the coordinator (deactivate the nervous system)
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping coordinator');
    this.isRunning = false;

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.taskProcessingTimer) {
      clearInterval(this.taskProcessingTimer);
    }

    // Shutdown all agents
    const agentNames = Array.from(this.agents.keys());
    for (const agentName of agentNames) {
      await this.unregisterAgent(agentName);
    }

    this.logger.info('Coordinator stopped');
  }

  /**
   * Perform health checks on all agents
   */
  private async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing health checks');

    for (const [agentName, agent] of this.agents.entries()) {
      try {
        const isHealthy = await agent.healthCheck();
        if (!isHealthy) {
          this.logger.warn('Agent health check failed', { agentName });
        }
      } catch (error) {
        this.logger.error('Error during health check', error as Error, { agentName });
      }
    }
  }

  /**
   * Get coordinator statistics (neural activity)
   */
  getStats(): CoordinatorStats {
    const avgResponseTime =
      this.stats.responseTimes.length > 0
        ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
        : 0;

    const taskStats = this.taskQueue.getStats();

    return {
      agentCount: this.agents.size,
      messagesSent: this.stats.messagesSent,
      messagesReceived: this.stats.messagesReceived,
      messageErrors: this.stats.messageErrors,
      tasksQueued: taskStats.pending,
      tasksRunning: taskStats.running,
      tasksCompleted: taskStats.completed,
      tasksFailed: taskStats.failed,
      avgResponseTime,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get list of registered agents
   */
  getAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get context manager (for setting indexer, etc.)
   */
  getContextManager(): ContextManagerImpl {
    return this.contextManager;
  }

  /**
   * Helper: Create error response
   */
  private createErrorResponse(original: Message, errorMessage: string): Message {
    return {
      id: randomUUID(),
      type: 'error',
      sender: 'coordinator',
      recipient: original.sender,
      correlationId: original.id,
      payload: { error: errorMessage },
      priority: original.priority,
      timestamp: Date.now(),
    };
  }

  /**
   * Helper: Add timeout to a promise
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutError: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutError)), timeoutMs)),
    ]);
  }
}
