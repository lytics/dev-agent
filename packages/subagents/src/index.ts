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
// Types - Explorer
export type {
  CodeInsights,
  CodeRelationship,
  ExplorationAction,
  ExplorationError,
  ExplorationRequest,
  ExplorationResult,
  InsightsRequest,
  InsightsResult,
  PatternFrequency,
  PatternResult,
  PatternSearchRequest,
  RelationshipRequest,
  RelationshipResult,
  SimilarCodeRequest,
  SimilarCodeResult,
} from './explorer/types';
export type { GitHubAgentConfig } from './github/agent';
// GitHub Context Agent
export { GitHubAgent } from './github/agent';
export { GitHubIndexer } from './github/indexer';
export type * from './github/types';
export * from './github/utils';
// Logger module
export { CoordinatorLogger } from './logger';
// Agent modules
export { PlannerAgent } from './planner';
// Types - Planner
export type {
  Plan,
  PlanningError,
  PlanningRequest,
  PlanningResult,
  PlanTask,
  RelevantCode,
} from './planner/types';
// Planner utilities
export {
  addEstimatesToTasks,
  breakdownIssue,
  calculateTotalEstimate,
  cleanDescription,
  estimateTaskHours,
  extractAcceptanceCriteria,
  extractEstimate,
  extractTechnicalRequirements,
  fetchGitHubIssue,
  formatEstimate,
  formatJSON,
  formatMarkdown,
  formatPretty,
  groupTasksByPhase,
  inferPriority,
  isGhInstalled,
  isGitHubRepo,
  validateTasks,
} from './planner/utils';
export { PrAgent } from './pr';
// Types - Coordinator
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
