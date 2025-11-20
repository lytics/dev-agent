export interface VectorStorageOptions {
    dbPath: string;
    dimension: number;
}
export declare class VectorStorage {
    private options;
    constructor(options: VectorStorageOptions);
    initialize(): Promise<boolean>;
    storeEmbedding(id: string, vector: number[], metadata: Record<string, unknown>): Promise<boolean>;
    search(_queryVector: number[], _limit?: number): Promise<never[]>;
}
//# sourceMappingURL=index.d.ts.map