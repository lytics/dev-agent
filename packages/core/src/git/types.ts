/**
 * Git Types
 *
 * Core types for git history extraction and indexing.
 * Designed for extensibility: cross-repo, blame, contributor stats.
 */

/**
 * Author or committer information
 */
export interface GitPerson {
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** ISO timestamp */
  date: string;
}

/**
 * File change in a commit
 */
export interface GitFileChange {
  /** File path (relative to repo root) */
  path: string;
  /** Previous path if renamed */
  previousPath?: string;
  /** Type of change */
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  /** Lines added */
  additions: number;
  /** Lines deleted */
  deletions: number;
}

/**
 * References extracted from commit
 */
export interface GitRefs {
  /** Branch names containing this commit */
  branches: string[];
  /** Tags pointing to this commit */
  tags: string[];
  /** Issue references extracted from message (#123) */
  issueRefs: number[];
  /** PR references extracted from message (PR #456, pull request #456) */
  prRefs: number[];
}

/**
 * Repository information
 */
export interface GitRepositoryInfo {
  /** Repository name (e.g., "dev-agent") */
  name: string;
  /** Remote URL (e.g., "git@github.com:lytics/dev-agent.git") */
  remote: string | null;
  /** Owner/org (e.g., "lytics") */
  owner: string | null;
  /** Current branch */
  branch: string;
  /** Current HEAD commit */
  head: string;
  /** Whether repo has uncommitted changes */
  dirty: boolean;
}

/**
 * Complete commit information
 */
export interface GitCommit {
  /** Full commit hash (40 chars) */
  hash: string;
  /** Short hash (7 chars) */
  shortHash: string;

  /** Full commit message */
  message: string;
  /** First line of message (subject) */
  subject: string;
  /** Rest of message (body) */
  body: string;

  /** Author information */
  author: GitPerson;
  /** Committer information (can differ from author) */
  committer: GitPerson;

  /** Files changed in this commit */
  files: GitFileChange[];

  /** Aggregate stats */
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };

  /** Extracted references */
  refs: GitRefs;

  /** Parent commit hashes */
  parents: string[];

  /** For cross-repo support (future) */
  repository?: {
    name: string;
    remote: string;
  };
}

/**
 * Options for fetching commits
 */
export interface GetCommitsOptions {
  /** Maximum number of commits to fetch */
  limit?: number;
  /** Only commits after this date (ISO format) */
  since?: string;
  /** Only commits before this date (ISO format) */
  until?: string;
  /** Filter by author email */
  author?: string;
  /** Filter by file/directory path */
  path?: string;
  /** Follow file renames */
  follow?: boolean;
  /** Exclude merge commits */
  noMerges?: boolean;
  /** Starting commit (for pagination) */
  startFrom?: string;
}

/**
 * Blame information for a single line
 */
export interface GitBlameLine {
  /** Line number (1-based) */
  lineNumber: number;
  /** Line content */
  content: string;
  /** Commit that introduced this line */
  commit: {
    hash: string;
    shortHash: string;
    subject: string;
    author: string;
    date: string;
  };
}

/**
 * Blame information for a file or range
 */
export interface GitBlame {
  /** File path */
  file: string;
  /** Blame data per line */
  lines: GitBlameLine[];
}

/**
 * Options for blame
 */
export interface BlameOptions {
  /** Start line (1-based, inclusive) */
  startLine?: number;
  /** End line (1-based, inclusive) */
  endLine?: number;
}

/**
 * Contributor statistics (future)
 */
export interface ContributorStats {
  /** Author info */
  author: {
    name: string;
    email: string;
  };
  /** Total commits */
  commits: number;
  /** Total lines added */
  additions: number;
  /** Total lines deleted */
  deletions: number;
  /** Stats by directory path */
  byPath: Record<
    string,
    {
      commits: number;
      additions: number;
      deletions: number;
      lastCommit: string;
    }
  >;
  /** First commit date */
  firstCommit: string;
  /** Last commit date */
  lastCommit: string;
}

/**
 * Result of git indexing
 */
export interface GitIndexResult {
  /** Number of commits indexed */
  commitsIndexed: number;
  /** Time taken in ms */
  durationMs: number;
  /** Any errors encountered */
  errors: string[];
}
