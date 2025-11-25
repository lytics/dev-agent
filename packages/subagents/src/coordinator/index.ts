/**
 * Coordinator Module = Central Nervous System
 * Self-contained orchestration system for managing agents
 */

export { ContextManagerImpl } from './context-manager';
export { SubagentCoordinator } from './coordinator';
export type { StorageAdapter } from './storage';
export { CompositeStorageAdapter, MemoryStorageAdapter } from './storage';
export { TaskQueue } from './task-queue';
