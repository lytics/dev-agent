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
    // Commands registered via Commander.js in cli.ts
    void this.verbose;
  }

  async run(_args: string[]): Promise<void> {
    // Command execution implemented via Commander.js in cli.ts
  }
}

export function createCli(config: CliConfig): CliService {
  return new CliService(config);
}
