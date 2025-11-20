// Export all modules
export * from './scanner';
export * from './vector';
export * from './github';
export * from './context';
export * from './api';

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
    if (this.config.debug) {
      console.log('CoreService initialized with config:', this.config);
    }
  }

  getApiKey(): string {
    return this.config.apiKey;
  }
}

export function createCoreService(config: CoreConfig): CoreService {
  return new CoreService(config);
}
