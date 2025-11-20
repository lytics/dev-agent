export interface ApiServerOptions {
    port: number;
    host: string;
}
export declare class ApiServer {
    private options;
    constructor(options: ApiServerOptions);
    start(): Promise<boolean>;
    stop(): Promise<boolean>;
}
//# sourceMappingURL=index.d.ts.map