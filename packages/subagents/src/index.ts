/**
 * Subagent Coordinator Package
 * Central Nervous System for orchestrating specialized AI agents
 *
 * Self-contained modules:
 * - coordinator/  - Central nervous system
 * - logger/       - Observability (future: @lytics/croak)
 * - planner/      - Planning agent
 * - explorer/     - Code exploration agent
 * - pr/           - GitHub PR agent
 */

// Main coordinator module
export { ContextManagerImpl, SubagentCoordinator, TaskQueue } from './coordinator';
export { ExplorerAgent } from './explorer';
// Logger module
export { CoordinatorLogger } from './logger';
// Agent modules (stubs for now)
export { PlannerAgent } from './planner';
export { PrAgent } from './pr';

// Types
export type {
  Agent,
  AgentContext,
  ContextManager,
  CoordinatorOptions,
  CoordinatorStats,
  Logger,
  LogLevel,
  Message,
  MessageType,
  Task,
  TaskStatus,
} from './types';
