/**
 * Built-in Adapters
 * Production-ready adapters included with the MCP server
 */

export { GitHubAdapter, type GitHubAdapterConfig } from './github-adapter.js';
export { HealthAdapter, type HealthCheckConfig } from './health-adapter.js';
export { HistoryAdapter, type HistoryAdapterConfig } from './history-adapter.js';
// Legacy: Re-export InspectAdapter as ExploreAdapter for backward compatibility (deprecated)
export {
  InspectAdapter,
  InspectAdapter as ExploreAdapter,
  type InspectAdapterConfig,
  type InspectAdapterConfig as ExploreAdapterConfig,
} from './inspect-adapter.js';
export { MapAdapter, type MapAdapterConfig } from './map-adapter.js';
export { PlanAdapter, type PlanAdapterConfig } from './plan-adapter.js';
export { RefsAdapter, type RefsAdapterConfig } from './refs-adapter.js';
export { SearchAdapter, type SearchAdapterConfig } from './search-adapter.js';
export { StatusAdapter, type StatusAdapterConfig } from './status-adapter.js';
