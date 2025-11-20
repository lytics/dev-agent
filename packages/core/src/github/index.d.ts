export interface GitHubOptions {
    repoPath: string;
}
export declare class GitHubIntegration {
    constructor(_options: GitHubOptions);
    getIssues(): Promise<never[]>;
    getPullRequests(): Promise<never[]>;
    getFileHistory(_filePath: string): Promise<never[]>;
}
//# sourceMappingURL=index.d.ts.map