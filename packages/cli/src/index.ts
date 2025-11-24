import { type CoreConfig, CoreService } from '@lytics/dev-agent-core';

export interface CliConfig {
  coreConfig: CoreConfig;
  verbose: boolean;
}

export class CliService {
  private coreService: CoreService;
  private verbose: boolean;

  constructor(config: CliConfig) {
    this.coreService = new CoreService(config.coreConfig);
    this.verbose = config.verbose;
  }

  async initialize(): Promise<void> {
    this.coreService.initialize();
    if (this.verbose) {
      console.log('CLI service initialized');
    }
    // Commands will be registered here
  }

  async run(args: string[]): Promise<void> {
    // Command execution will be implemented using Commander.js
    console.log('Running command with args:', args);
  }
}

export function createCli(config: CliConfig): CliService {
  return new CliService(config);
}
