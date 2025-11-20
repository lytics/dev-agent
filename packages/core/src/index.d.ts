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
export declare class CoreService {
    private config;
    constructor(config: CoreConfig);
    initialize(): void;
    getApiKey(): string;
}
export declare function createCoreService(config: CoreConfig): CoreService;
//# sourceMappingURL=index.d.ts.map