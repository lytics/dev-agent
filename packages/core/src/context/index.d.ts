export interface ContextProviderOptions {
    repositoryPath: string;
    maxContextItems: number;
}
export declare class ContextProvider {
    constructor(_options: ContextProviderOptions);
    getContextForQuery(query: string): Promise<{
        files: never[];
        codeBlocks: never[];
        metadata: {};
    }>;
    getContextForFile(_filePath: string): Promise<{
        relatedFiles: never[];
        dependencies: never[];
        history: never[];
    }>;
}
//# sourceMappingURL=index.d.ts.map