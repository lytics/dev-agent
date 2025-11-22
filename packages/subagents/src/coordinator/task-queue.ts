/**
 * Task Queue = Motor Control System
 * Manages task execution, priorities, and concurrency
 */

import type { Logger, Task, TaskStatus } from '../types';

export class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private runningTasks: Set<string> = new Set();
  private readonly maxConcurrent: number;
  private readonly logger: Logger;

  constructor(maxConcurrent: number, logger: Logger) {
    this.maxConcurrent = maxConcurrent;
    this.logger = logger.child ? logger.child('task-queue') : logger;
  }

  /**
   * Add a task to the queue
   */
  enqueue(task: Task): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task with ID ${task.id} already exists`);
    }

    this.tasks.set(task.id, task);
    this.logger.debug('Task enqueued', { taskId: task.id, type: task.type });
  }

  /**
   * Get the next task to execute (highest priority, oldest first)
   */
  getNext(): Task | null {
    const pendingTasks = Array.from(this.tasks.values())
      .filter((task) => task.status === 'pending')
      .sort((a, b) => {
        // Higher priority first
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Older tasks first (FIFO for same priority)
        return a.createdAt - b.createdAt;
      });

    return pendingTasks[0] || null;
  }

  /**
   * Mark a task as running
   */
  markRunning(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'running';
    task.startedAt = Date.now();
    this.runningTasks.add(taskId);

    this.logger.debug('Task started', { taskId, type: task.type });
  }

  /**
   * Mark a task as completed
   */
  markCompleted(taskId: string, result?: unknown): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'completed';
    task.completedAt = Date.now();
    task.result = result;
    this.runningTasks.delete(taskId);

    const duration = task.completedAt - (task.startedAt || task.createdAt);
    this.logger.info('Task completed', {
      taskId,
      type: task.type,
      duration: `${duration}ms`,
    });
  }

  /**
   * Mark a task as failed
   */
  markFailed(taskId: string, error: Error): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'failed';
    task.completedAt = Date.now();
    task.error = error;
    this.runningTasks.delete(taskId);

    this.logger.error('Task failed', error, {
      taskId,
      type: task.type,
      retries: task.retries,
    });
  }

  /**
   * Check if a task should be retried
   */
  shouldRetry(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    return task.status === 'failed' && task.retries < task.maxRetries;
  }

  /**
   * Retry a failed task
   */
  retry(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (!this.shouldRetry(taskId)) {
      throw new Error(`Task ${taskId} cannot be retried`);
    }

    task.status = 'pending';
    task.retries += 1;
    task.error = undefined;
    task.startedAt = undefined;
    task.completedAt = undefined;

    this.logger.warn('Task retry scheduled', {
      taskId,
      type: task.type,
      attempt: task.retries + 1,
    });
  }

  /**
   * Cancel a task
   */
  cancel(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'cancelled';
    task.completedAt = Date.now();
    this.runningTasks.delete(taskId);

    this.logger.warn('Task cancelled', { taskId, type: task.type });
  }

  /**
   * Get a task by ID
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Check if we can run more tasks
   */
  canRunMore(): boolean {
    return this.runningTasks.size < this.maxConcurrent;
  }

  /**
   * Get number of running tasks
   */
  getRunningCount(): number {
    return this.runningTasks.size;
  }

  /**
   * Get statistics
   */
  getStats() {
    const tasksByStatus: Record<TaskStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks.values()) {
      tasksByStatus[task.status]++;
    }

    return {
      total: this.tasks.size,
      ...tasksByStatus,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Clean up old completed/failed tasks
   */
  cleanup(olderThanMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, task] of this.tasks.entries()) {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        task.completedAt &&
        now - task.completedAt > olderThanMs
      ) {
        this.tasks.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Tasks cleaned up', { count: cleaned });
    }

    return cleaned;
  }
}
