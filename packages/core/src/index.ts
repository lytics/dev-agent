// Export all modules

export * from './api';
export * from './context';
export * from './events';
export * from './github';
export * from './indexer';
export * from './map';
export * from './observability';
export * from './scanner';
export * from './storage';
export * from './utils';
export * from './vector';

export interface CoreConfig {
  apiKey: string;
  debug: boolean;
  repositoryPath: string;
}

export class CoreService {
  private config: CoreConfig;

  constructor(config: CoreConfig) {
    this.config = config;
  }

  initialize(): void {
    // Debug logging handled by caller if needed
    void this.config.debug;
  }

  getApiKey(): string {
    return this.config.apiKey;
  }
}

export function createCoreService(config: CoreConfig): CoreService {
  return new CoreService(config);
}
