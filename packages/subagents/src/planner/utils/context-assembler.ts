/**
 * Context Assembler
 * Assembles rich context packages for LLM consumption
 *
 * Philosophy: Provide raw, structured context - let the LLM do the reasoning
 */

import type { GitIndexer, RepositoryIndexer } from '@lytics/dev-agent-core';
import type {
  CodebasePatterns,
  ContextAssemblyOptions,
  ContextMetadata,
  ContextPackage,
  IssueContext,
  RelatedCommit,
  RelatedHistory,
  RelevantCodeContext,
} from '../context-types';
import type { GitHubIssue } from '../types';
import { fetchGitHubIssue } from './github';

/** Default options for context assembly */
const DEFAULT_OPTIONS: Required<ContextAssemblyOptions> = {
  includeCode: true,
  includeHistory: true,
  includePatterns: true,
  includeGitHistory: true,
  maxCodeResults: 10,
  maxHistoryResults: 5,
  maxGitCommitResults: 5,
  tokenBudget: 4000,
};

/**
 * Context for assembly including optional git indexer
 */
export interface ContextAssemblyContext {
  indexer: RepositoryIndexer | null;
  gitIndexer?: GitIndexer | null;
}

/**
 * Assemble a context package for a GitHub issue
 *
 * @param issueNumber - GitHub issue number
 * @param indexer - Repository indexer for code search
 * @param repositoryPath - Path to repository
 * @param options - Assembly options
 * @returns Complete context package
 */
export async function assembleContext(
  issueNumber: number,
  indexer: RepositoryIndexer | null,
  repositoryPath: string,
  options?: ContextAssemblyOptions
): Promise<ContextPackage>;

/**
 * Assemble a context package with git history support
 *
 * @param issueNumber - GitHub issue number
 * @param context - Context with indexer and optional git indexer
 * @param repositoryPath - Path to repository
 * @param options - Assembly options
 * @returns Complete context package
 */
export async function assembleContext(
  issueNumber: number,
  context: ContextAssemblyContext,
  repositoryPath: string,
  options?: ContextAssemblyOptions
): Promise<ContextPackage>;

export async function assembleContext(
  issueNumber: number,
  indexerOrContext: RepositoryIndexer | null | ContextAssemblyContext,
  repositoryPath: string,
  options: ContextAssemblyOptions = {}
): Promise<ContextPackage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Normalize input
  const context: ContextAssemblyContext =
    indexerOrContext && 'indexer' in indexerOrContext
      ? indexerOrContext
      : { indexer: indexerOrContext as RepositoryIndexer | null };

  // 1. Fetch issue with comments
  const issue = await fetchGitHubIssue(issueNumber, repositoryPath, { includeComments: true });
  const issueContext = convertToIssueContext(issue);

  // 2. Search for relevant code
  let relevantCode: RelevantCodeContext[] = [];
  if (opts.includeCode && context.indexer) {
    relevantCode = await findRelevantCode(issue, context.indexer, opts.maxCodeResults);
  }

  // 3. Detect codebase patterns
  let codebasePatterns: CodebasePatterns = {};
  if (opts.includePatterns && context.indexer) {
    codebasePatterns = await detectCodebasePatterns(context.indexer);
  }

  // 4. Find related history (TODO: implement when GitHub indexer is available)
  const relatedHistory: RelatedHistory[] = [];
  // if (opts.includeHistory && githubIndexer) {
  //   relatedHistory = await findRelatedHistory(issue, githubIndexer, opts.maxHistoryResults);
  // }

  // 5. Find related git commits
  let relatedCommits: RelatedCommit[] = [];
  if (opts.includeGitHistory && context.gitIndexer) {
    relatedCommits = await findRelatedCommits(issue, context.gitIndexer, opts.maxGitCommitResults);
  }

  // 6. Calculate approximate token count
  const tokensUsed = estimateTokens(
    issueContext,
    relevantCode,
    codebasePatterns,
    relatedHistory,
    relatedCommits
  );

  // 7. Assemble metadata
  const metadata: ContextMetadata = {
    generatedAt: new Date().toISOString(),
    tokensUsed,
    codeSearchUsed: opts.includeCode && context.indexer !== null,
    historySearchUsed: opts.includeHistory && relatedHistory.length > 0,
    gitHistorySearchUsed: opts.includeGitHistory && relatedCommits.length > 0,
    repositoryPath,
  };

  return {
    issue: issueContext,
    relevantCode,
    codebasePatterns,
    relatedHistory,
    relatedCommits,
    metadata,
  };
}

/**
 * Convert GitHubIssue to IssueContext
 */
function convertToIssueContext(issue: GitHubIssue): IssueContext {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    labels: issue.labels,
    author: issue.author || 'unknown',
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    state: issue.state,
    comments: (issue.comments || []).map((c) => ({
      author: c.author || 'unknown',
      body: c.body || '',
      createdAt: c.createdAt || new Date().toISOString(),
    })),
  };
}

/**
 * Find relevant code using semantic search
 */
async function findRelevantCode(
  issue: GitHubIssue,
  indexer: RepositoryIndexer,
  maxResults: number
): Promise<RelevantCodeContext[]> {
  // Build search query from issue title and body
  const searchQuery = buildSearchQuery(issue);

  try {
    const results = await indexer.search(searchQuery, {
      limit: maxResults,
      scoreThreshold: 0.5,
    });

    return results.map((r) => ({
      file: (r.metadata.path as string) || (r.metadata.file as string) || '',
      name: (r.metadata.name as string) || 'unknown',
      type: (r.metadata.type as string) || 'unknown',
      snippet: (r.metadata.snippet as string) || '',
      relevanceScore: r.score,
      reason: inferRelevanceReason(r.metadata, issue),
    }));
  } catch {
    // Return empty array if search fails
    return [];
  }
}

/**
 * Build a search query from issue content
 */
function buildSearchQuery(issue: GitHubIssue): string {
  // Combine title and first part of body for search
  const bodyPreview = (issue.body || '').slice(0, 500);

  // Extract key terms (simple heuristic)
  const combined = `${issue.title} ${bodyPreview}`;

  // Remove markdown artifacts
  const cleaned = combined
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/[#*_`]/g, '') // Remove markdown formatting
    .trim();

  return cleaned;
}

/**
 * Infer why a code result is relevant
 */
function inferRelevanceReason(metadata: Record<string, unknown>, issue: GitHubIssue): string {
  const name = (metadata.name as string) || '';
  const type = (metadata.type as string) || '';
  const title = issue.title.toLowerCase();

  // Simple heuristics for reason
  if (title.includes(name.toLowerCase())) {
    return `Name matches issue title`;
  }

  if (type === 'function' || type === 'method') {
    return `Similar function pattern`;
  }

  if (type === 'class') {
    return `Related class structure`;
  }

  if (type === 'interface' || type === 'type') {
    return `Relevant type definition`;
  }

  return `Semantic similarity`;
}

/**
 * Find related git commits using semantic search
 */
async function findRelatedCommits(
  issue: GitHubIssue,
  gitIndexer: GitIndexer,
  maxResults: number
): Promise<RelatedCommit[]> {
  // Build search query from issue title and body
  const searchQuery = buildSearchQuery(issue);

  try {
    const commits = await gitIndexer.search(searchQuery, { limit: maxResults });

    return commits.map((commit, index) => ({
      hash: commit.shortHash,
      subject: commit.subject,
      author: commit.author.name,
      date: commit.author.date, // Already an ISO string
      filesChanged: commit.files.map((f) => f.path),
      issueRefs: commit.refs.issueRefs,
      // Decay relevance score by position
      relevanceScore: Math.max(0.5, 1 - index * 0.1),
    }));
  } catch {
    // Return empty array if search fails
    return [];
  }
}

/**
 * Detect codebase patterns from indexed data
 */
async function detectCodebasePatterns(indexer: RepositoryIndexer): Promise<CodebasePatterns> {
  // Search for test files to detect test pattern
  let testPattern: string | undefined;
  let testLocation: string | undefined;

  try {
    const testResults = await indexer.search('test describe it expect', {
      limit: 5,
      scoreThreshold: 0.5,
    });

    if (testResults.length > 0) {
      const testPath = (testResults[0].metadata.path as string) || '';
      if (testPath.includes('.test.')) {
        testPattern = '*.test.ts';
      } else if (testPath.includes('.spec.')) {
        testPattern = '*.spec.ts';
      }

      if (testPath.includes('__tests__')) {
        testLocation = '__tests__/';
      } else if (testPath.includes('/test/')) {
        testLocation = 'test/';
      }
    }
  } catch {
    // Ignore errors in pattern detection
  }

  return {
    testPattern,
    testLocation,
  };
}

/**
 * Estimate token count for context package
 */
function estimateTokens(
  issue: IssueContext,
  code: RelevantCodeContext[],
  patterns: CodebasePatterns,
  history: RelatedHistory[],
  commits: RelatedCommit[]
): number {
  // Rough estimation: ~4 chars per token
  let chars = 0;

  // Issue content
  chars += issue.title.length;
  chars += issue.body.length;
  chars += issue.comments.reduce((sum, c) => sum + c.body.length, 0);

  // Code snippets
  chars += code.reduce(
    (sum, c) => sum + (c.snippet?.length || 0) + c.file.length + c.name.length,
    0
  );

  // Patterns (small)
  chars += JSON.stringify(patterns).length;

  // History
  chars += history.reduce((sum, h) => sum + h.title.length + (h.summary?.length || 0), 0);

  // Git commits
  chars += commits.reduce(
    (sum, c) => sum + c.subject.length + c.author.length + c.filesChanged.join('').length,
    0
  );

  return Math.ceil(chars / 4);
}

/**
 * Format context package for LLM consumption
 */
export function formatContextPackage(context: ContextPackage): string {
  const lines: string[] = [];

  // Issue section
  lines.push(`# Issue #${context.issue.number}: ${context.issue.title}`);
  lines.push('');
  lines.push(
    `**Author:** ${context.issue.author} | **State:** ${context.issue.state} | **Labels:** ${context.issue.labels.join(', ') || 'none'}`
  );
  lines.push('');
  lines.push('## Description');
  lines.push('');
  lines.push(context.issue.body || '_No description provided_');
  lines.push('');

  // Comments
  if (context.issue.comments.length > 0) {
    lines.push('## Comments');
    lines.push('');
    for (const comment of context.issue.comments) {
      lines.push(`**${comment.author}** (${comment.createdAt}):`);
      lines.push(comment.body);
      lines.push('');
    }
  }

  // Relevant code
  if (context.relevantCode.length > 0) {
    lines.push('## Relevant Code');
    lines.push('');
    for (const code of context.relevantCode) {
      lines.push(`### ${code.name} (${code.type})`);
      lines.push(
        `**File:** \`${code.file}\` | **Relevance:** ${(code.relevanceScore * 100).toFixed(0)}%`
      );
      lines.push(`**Reason:** ${code.reason}`);
      lines.push('');
      if (code.snippet) {
        lines.push('```typescript');
        lines.push(code.snippet);
        lines.push('```');
        lines.push('');
      }
    }
  }

  // Codebase patterns
  if (context.codebasePatterns.testPattern || context.codebasePatterns.testLocation) {
    lines.push('## Codebase Patterns');
    lines.push('');
    if (context.codebasePatterns.testPattern) {
      lines.push(`- **Test naming:** ${context.codebasePatterns.testPattern}`);
    }
    if (context.codebasePatterns.testLocation) {
      lines.push(`- **Test location:** ${context.codebasePatterns.testLocation}`);
    }
    lines.push('');
  }

  // Related history
  if (context.relatedHistory.length > 0) {
    lines.push('## Related History');
    lines.push('');
    for (const item of context.relatedHistory) {
      const typeLabel = item.type === 'pr' ? 'PR' : 'Issue';
      lines.push(`- **${typeLabel} #${item.number}:** ${item.title} (${item.state})`);
    }
    lines.push('');
  }

  // Related commits
  if (context.relatedCommits.length > 0) {
    lines.push('## Related Commits');
    lines.push('');
    for (const commit of context.relatedCommits) {
      const issueLinks =
        commit.issueRefs.length > 0
          ? ` (refs: ${commit.issueRefs.map((n) => `#${n}`).join(', ')})`
          : '';
      lines.push(`- **\`${commit.hash}\`** ${commit.subject}${issueLinks}`);
      lines.push(`  - *${commit.author}* on ${commit.date.split('T')[0]}`);
      if (commit.filesChanged.length > 0) {
        const files =
          commit.filesChanged.length <= 3
            ? commit.filesChanged.map((f) => `\`${f}\``).join(', ')
            : `${commit.filesChanged
                .slice(0, 3)
                .map((f) => `\`${f}\``)
                .join(', ')} +${commit.filesChanged.length - 3} more`;
        lines.push(`  - Files: ${files}`);
      }
    }
    lines.push('');
  }

  // Metadata
  lines.push('---');
  lines.push(
    `*Context assembled at ${context.metadata.generatedAt} | ~${context.metadata.tokensUsed} tokens*`
  );

  return lines.join('\n');
}
