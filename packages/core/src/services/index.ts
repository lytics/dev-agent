/**
 * Services Module
 *
 * Shared business logic layer for MCP and Dashboard.
 * Provides consistent APIs for stats, health, and metrics.
 */

export { CoordinatorService, type CoordinatorServiceConfig } from './coordinator-service.js';
export { GitHistoryService, type GitHistoryServiceConfig } from './git-history-service.js';
export {
  type GitHubIndexerFactory,
  GitHubService,
  type GitHubServiceConfig,
} from './github-service.js';
export {
  type ComponentHealth,
  type HealthCheckResult,
  HealthService,
  type HealthServiceConfig,
} from './health-service.js';
export { MetricsService, type MetricsServiceConfig } from './metrics-service.js';
export {
  SearchService,
  type SearchServiceConfig,
  type SimilarityOptions,
} from './search-service.js';
export { StatsService, type StatsServiceConfig } from './stats-service.js';
