/**
 * Git Extractor
 *
 * Extracts git history data by shelling out to git commands.
 * Designed as an interface for future pluggability (GitHub API, etc.)
 */

import { execSync } from 'node:child_process';
import type {
  BlameOptions,
  GetCommitsOptions,
  GitBlame,
  GitBlameLine,
  GitCommit,
  GitFileChange,
  GitPerson,
  GitRefs,
  GitRepositoryInfo,
} from './types';

/**
 * Abstract interface for git data extraction.
 * Allows swapping local git for GitHub API in the future.
 */
export interface GitExtractor {
  /** Get commits matching options */
  getCommits(options?: GetCommitsOptions): Promise<GitCommit[]>;

  /** Get a single commit by hash */
  getCommit(hash: string): Promise<GitCommit | null>;

  /** Get blame for a file (future) */
  getBlame(file: string, options?: BlameOptions): Promise<GitBlame>;

  /** Get repository info */
  getRepositoryInfo(): Promise<GitRepositoryInfo>;
}

/** Field separator for git log parsing */
const FIELD_SEP = '␞'; // ASCII Record Separator
/** Record separator for git log parsing */
const RECORD_SEP = '␟'; // ASCII Unit Separator

/**
 * Git log format string
 * Fields: hash, short hash, author name, author email, author date,
 *         committer name, committer email, committer date, subject, body, parents
 *
 * We use COMMIT_START marker to reliably split commits since body can contain newlines
 */
const COMMIT_START = '::COMMIT_START::';
const LOG_FORMAT = [
  `${COMMIT_START}%H`, // hash (with marker)
  '%h', // short hash
  '%an', // author name
  '%ae', // author email
  '%aI', // author date (ISO)
  '%cn', // committer name
  '%ce', // committer email
  '%cI', // committer date (ISO)
  '%s', // subject
  '%b', // body
  '%P', // parent hashes
].join(FIELD_SEP);

/**
 * Local git implementation using shell commands
 */
export class LocalGitExtractor implements GitExtractor {
  constructor(private repositoryPath: string) {}

  /**
   * Get commits matching the given options
   */
  async getCommits(options: GetCommitsOptions = {}): Promise<GitCommit[]> {
    const {
      limit = 100,
      since,
      until,
      author,
      path,
      follow = true,
      noMerges = true,
      startFrom,
    } = options;

    // Build git log command
    const args: string[] = [
      'log',
      `--format=${LOG_FORMAT}${RECORD_SEP}`,
      '--numstat',
      `-n${limit}`,
    ];

    if (noMerges) args.push('--no-merges');
    if (since) args.push(`--since="${since}"`);
    if (until) args.push(`--until="${until}"`);
    if (author) args.push(`--author="${author}"`);
    if (startFrom) args.push(startFrom);
    if (path) {
      if (follow) args.push('--follow');
      args.push('--', path);
    }

    const output = this.execGit(args);
    if (!output.trim()) {
      return [];
    }

    return this.parseLogOutput(output);
  }

  /**
   * Get a single commit by hash
   */
  async getCommit(hash: string): Promise<GitCommit | null> {
    try {
      const args = ['show', `--format=${LOG_FORMAT}${RECORD_SEP}`, '--numstat', hash];

      const output = this.execGit(args);
      if (!output.trim()) {
        return null;
      }

      const commits = this.parseLogOutput(output);
      return commits[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Get blame for a file
   * @throws Error - Not implemented yet (future feature)
   */
  async getBlame(file: string, options?: BlameOptions): Promise<GitBlame> {
    const args = ['blame', '-l', '-t', '--line-porcelain'];

    if (options?.startLine && options?.endLine) {
      args.push(`-L${options.startLine},${options.endLine}`);
    }

    args.push('--', file);

    const output = this.execGit(args);
    return this.parseBlameOutput(file, output);
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(): Promise<GitRepositoryInfo> {
    // Get remote URL
    let remote: string | null = null;
    let owner: string | null = null;
    let name = '';

    try {
      remote = this.execGit(['remote', 'get-url', 'origin']).trim();
      const parsed = this.parseRemoteUrl(remote);
      owner = parsed.owner;
      name = parsed.name;
    } catch {
      // No remote configured
      name = this.repositoryPath.split('/').pop() || 'unknown';
    }

    // Get current branch
    let branch = 'HEAD';
    try {
      branch = this.execGit(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    } catch {
      // Detached HEAD or other issue
    }

    // Get HEAD commit
    let head = '';
    try {
      head = this.execGit(['rev-parse', 'HEAD']).trim();
    } catch {
      // Empty repo
    }

    // Check for uncommitted changes
    let dirty = false;
    try {
      const status = this.execGit(['status', '--porcelain']);
      dirty = status.trim().length > 0;
    } catch {
      // Ignore
    }

    return { name, remote, owner, branch, head, dirty };
  }

  /**
   * Execute a git command and return stdout
   */
  private execGit(args: string[]): string {
    const command = `git ${args.join(' ')}`;
    try {
      return execSync(command, {
        cwd: this.repositoryPath,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024, // 50MB for large repos
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      // Check for empty repo or other expected errors
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('does not have any commits yet')) {
        return '';
      }
      throw error;
    }
  }

  /**
   * Parse git log output into commits
   */
  private parseLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = [];

    // Split by commit start marker
    const records = output.split(COMMIT_START).filter((r) => r.trim());

    for (const record of records) {
      const commit = this.parseCommitRecord(record);
      if (commit) {
        commits.push(commit);
      }
    }

    return commits;
  }

  /**
   * Parse a single commit record
   */
  private parseCommitRecord(record: string): GitCommit | null {
    // Record format: HASH␞shortHash␞...␞parents␟\n\nnumstat lines
    // The record separator (␟) marks end of metadata, then numstat follows

    // Split on record separator to separate metadata from numstat
    const [metadataPart, numstatPart] = record.split(RECORD_SEP);
    if (!metadataPart) return null;

    const fields = metadataPart.split(FIELD_SEP);

    if (fields.length < 11) {
      // Invalid format
      return null;
    }

    const [
      hash,
      shortHash,
      authorName,
      authorEmail,
      authorDate,
      committerName,
      committerEmail,
      committerDate,
      subject,
      body,
      parentStr,
    ] = fields;

    // Parse file changes from numstat
    const files: GitFileChange[] = [];
    let additions = 0;
    let deletions = 0;

    if (numstatPart) {
      const numstatLines = numstatPart.trim().split('\n');
      for (const line of numstatLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const fileChange = this.parseNumstatLine(trimmed);
        if (fileChange) {
          files.push(fileChange);
          additions += fileChange.additions;
          deletions += fileChange.deletions;
        }
      }
    }

    // Extract references from message
    const fullMessage = body ? `${subject}\n\n${body}` : subject;
    const refs = this.extractRefs(fullMessage);

    const author: GitPerson = {
      name: authorName,
      email: authorEmail,
      date: authorDate,
    };

    const committer: GitPerson = {
      name: committerName,
      email: committerEmail,
      date: committerDate,
    };

    return {
      hash,
      shortHash,
      message: fullMessage,
      subject,
      body: body || '',
      author,
      committer,
      files,
      stats: {
        additions,
        deletions,
        filesChanged: files.length,
      },
      refs,
      parents: parentStr ? parentStr.split(' ').filter(Boolean) : [],
    };
  }

  /**
   * Parse a numstat line (additions, deletions, path)
   */
  private parseNumstatLine(line: string): GitFileChange | null {
    // Format: "10\t5\tpath/to/file" or "10\t5\told => new" for renames
    const parts = line.split('\t');
    if (parts.length < 3) return null;

    const [addStr, delStr, ...pathParts] = parts;
    const pathStr = pathParts.join('\t');

    // Handle binary files (shown as -)
    const additions = addStr === '-' ? 0 : parseInt(addStr, 10) || 0;
    const deletions = delStr === '-' ? 0 : parseInt(delStr, 10) || 0;

    // Check for rename (old => new format)
    const renameMatch = pathStr.match(/^(.+?)\s*=>\s*(.+)$/);
    if (renameMatch) {
      // Handle renames with {} notation: path/{old => new}/file
      const fullPath = pathStr;
      const braceMatch = fullPath.match(/^(.*?)\{(.+?)\s*=>\s*(.+?)\}(.*)$/);

      if (braceMatch) {
        const [, prefix, oldPart, newPart, suffix] = braceMatch;
        return {
          path: `${prefix}${newPart}${suffix}`.replace(/\/+/g, '/'),
          previousPath: `${prefix}${oldPart}${suffix}`.replace(/\/+/g, '/'),
          status: 'renamed',
          additions,
          deletions,
        };
      }

      return {
        path: renameMatch[2].trim(),
        previousPath: renameMatch[1].trim(),
        status: 'renamed',
        additions,
        deletions,
      };
    }

    // Determine status based on additions/deletions
    let status: GitFileChange['status'] = 'modified';
    if (additions > 0 && deletions === 0) {
      // Could be new file, but we can't tell from numstat alone
      status = 'modified';
    }

    return {
      path: pathStr,
      status,
      additions,
      deletions,
    };
  }

  /**
   * Extract issue and PR references from commit message
   */
  private extractRefs(message: string): GitRefs {
    const issueRefs: number[] = [];
    const prRefs: number[] = [];

    // Match PR references: "PR #123", "pull request #123", "Merge pull request #123"
    const prMatches = message.matchAll(/(?:PR\s*#|pull\s+request\s*#|Merge pull request #)(\d+)/gi);
    for (const match of prMatches) {
      const num = parseInt(match[1], 10);
      if (!prRefs.includes(num)) {
        prRefs.push(num);
      }
    }

    // Match issue references: #123 (but not PR #123)
    // Use negative lookbehind to exclude PR references
    const issueMatches = message.matchAll(
      /(?<!PR\s)(?<!pull\s+request\s)(?<!Merge pull request )#(\d+)/gi
    );
    for (const match of issueMatches) {
      const num = parseInt(match[1], 10);
      // Exclude if it's already a PR ref
      if (!prRefs.includes(num) && !issueRefs.includes(num)) {
        issueRefs.push(num);
      }
    }

    return {
      branches: [], // Would need separate git command
      tags: [], // Would need separate git command
      issueRefs,
      prRefs,
    };
  }

  /**
   * Parse git blame porcelain output
   */
  private parseBlameOutput(file: string, output: string): GitBlame {
    const lines: GitBlameLine[] = [];
    const outputLines = output.split('\n');

    let currentCommit: {
      hash: string;
      author: string;
      date: string;
      subject: string;
    } | null = null;
    let lineNumber = 0;

    for (const line of outputLines) {
      // Commit hash line (40 char hash followed by line numbers)
      if (/^[0-9a-f]{40}\s/.test(line)) {
        const parts = line.split(' ');
        currentCommit = {
          hash: parts[0],
          author: '',
          date: '',
          subject: '',
        };
        lineNumber = parseInt(parts[2], 10) || lineNumber + 1;
      } else if (line.startsWith('author ') && currentCommit) {
        currentCommit.author = line.slice(7);
      } else if (line.startsWith('author-time ') && currentCommit) {
        const timestamp = parseInt(line.slice(12), 10);
        currentCommit.date = new Date(timestamp * 1000).toISOString();
      } else if (line.startsWith('summary ') && currentCommit) {
        currentCommit.subject = line.slice(8);
      } else if (line.startsWith('\t') && currentCommit) {
        // Content line
        lines.push({
          lineNumber,
          content: line.slice(1),
          commit: {
            hash: currentCommit.hash,
            shortHash: currentCommit.hash.slice(0, 7),
            subject: currentCommit.subject,
            author: currentCommit.author,
            date: currentCommit.date,
          },
        });
      }
    }

    return { file, lines };
  }

  /**
   * Parse remote URL to extract owner and repo name
   */
  private parseRemoteUrl(remote: string): { owner: string | null; name: string } {
    // Handle git@github.com:owner/repo.git
    const sshMatch = remote.match(/git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1], name: sshMatch[2] };
    }

    // Handle https://github.com/owner/repo.git
    const httpsMatch = remote.match(/https?:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], name: httpsMatch[2] };
    }

    // Fallback
    const parts = remote.split('/');
    return { owner: null, name: parts.pop()?.replace('.git', '') || 'unknown' };
  }
}
