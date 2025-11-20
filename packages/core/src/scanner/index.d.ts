export interface ScannerOptions {
    path: string;
    excludePatterns?: string[];
    includeExtensions?: string[];
}
export declare class RepositoryScanner {
    private options;
    constructor(options: ScannerOptions);
    scan(): Promise<{
        files: never[];
        components: never[];
        relationships: never[];
    }>;
}
//# sourceMappingURL=index.d.ts.map