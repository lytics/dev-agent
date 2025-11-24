/**
 * GitHub Document Parser Utilities
 * Pure functions for extracting relationships and metadata from GitHub content
 */

import type { GitHubDocument } from '../types';

/**
 * Extract issue numbers from text (#123, GH-123, etc.)
 */
export function extractIssueReferences(text: string): number[] {
  const pattern = /#(\d+)|GH-(\d+)/g;
  const matches = text.matchAll(pattern);
  const numbers = new Set<number>();

  for (const match of matches) {
    const num = Number.parseInt(match[1] || match[2], 10);
    if (!Number.isNaN(num)) {
      numbers.add(num);
    }
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

/**
 * Extract file paths from text (src/file.ts, packages/core/index.ts, etc.)
 */
export function extractFilePaths(text: string): string[] {
  // Match common file path patterns
  const patterns = [
    // Code blocks with file paths
    /```[\w]*\n(?:\/\/|#)\s*([^\n]+\.(ts|js|tsx|jsx|py|go|rs|java|md))/gi,
    // Inline code with paths
    /`([^\n`]+\.(ts|js|tsx|jsx|py|go|rs|java|md))`/gi,
    // Plain paths
    /(?:^|\s)([a-zA-Z0-9_\-./]+\.(ts|js|tsx|jsx|py|go|rs|java|md))(?:\s|$)/gm,
    // src/ or packages/ paths
    /(?:src|packages|lib|test|tests)\/[a-zA-Z0-9_\-./]+\.(ts|js|tsx|jsx|py|go|rs|java|md)/gi,
  ];

  const paths = new Set<string>();

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const path = match[1] || match[0];
      if (path?.includes('/')) {
        // Clean up the path
        const cleaned = path.trim().replace(/^[`'"]+|[`'"]+$/g, '');
        if (cleaned.length > 3 && cleaned.length < 200) {
          paths.add(cleaned);
        }
      }
    }
  }

  return Array.from(paths).sort();
}

/**
 * Extract user mentions from text (@username)
 */
export function extractMentions(text: string): string[] {
  const pattern = /@([a-zA-Z0-9][-a-zA-Z0-9]*)/g;
  const matches = text.matchAll(pattern);
  const mentions = new Set<string>();

  for (const match of matches) {
    mentions.add(match[1]);
  }

  return Array.from(mentions).sort();
}

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  const pattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.matchAll(pattern);
  const urls = new Set<string>();

  for (const match of matches) {
    urls.add(match[0]);
  }

  return Array.from(urls);
}

/**
 * Extract GitHub issue/PR numbers from URLs
 */
export function extractGitHubReferences(urls: string[]): {
  issues: number[];
  prs: number[];
} {
  const issues = new Set<number>();
  const prs = new Set<number>();

  for (const url of urls) {
    // Match issue URLs: https://github.com/owner/repo/issues/123
    const issueMatch = url.match(/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/);
    if (issueMatch) {
      issues.add(Number.parseInt(issueMatch[1], 10));
    }

    // Match PR URLs: https://github.com/owner/repo/pull/123
    const prMatch = url.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
    if (prMatch) {
      prs.add(Number.parseInt(prMatch[1], 10));
    }
  }

  return {
    issues: Array.from(issues).sort((a, b) => a - b),
    prs: Array.from(prs).sort((a, b) => a - b),
  };
}

/**
 * Parse and enrich a GitHub document with extracted relationships
 */
export function enrichDocument(document: GitHubDocument): GitHubDocument {
  const fullText = `${document.title}\n${document.body}`;

  // Extract issue references
  const issueRefs = extractIssueReferences(fullText);

  // Extract file paths
  const filePaths = extractFilePaths(fullText);

  // Extract mentions
  const mentions = extractMentions(fullText);

  // Extract URLs and parse GitHub references
  const urls = extractUrls(fullText);
  const githubRefs = extractGitHubReferences(urls);

  // Combine all issue/PR references
  const allIssues = [...new Set([...issueRefs, ...githubRefs.issues])];
  const allPRs = [...new Set(githubRefs.prs)];

  // Remove self-reference
  const relatedIssues = allIssues.filter((n) => n !== document.number);
  const relatedPRs = allPRs.filter((n) => n !== document.number);

  return {
    ...document,
    relatedIssues,
    relatedPRs,
    linkedFiles: filePaths,
    mentions,
  };
}

/**
 * Check if a document matches a search query (simple text search)
 */
export function matchesQuery(document: GitHubDocument, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const searchableText = [document.title, document.body, ...document.labels, document.author]
    .join(' ')
    .toLowerCase();

  return searchableText.includes(lowerQuery);
}

/**
 * Calculate a simple relevance score for a document against a query
 */
export function calculateRelevance(document: GitHubDocument, query: string): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;

  // Title match (highest weight)
  if (document.title.toLowerCase().includes(lowerQuery)) {
    score += 10;
  }

  // Body match
  if (document.body.toLowerCase().includes(lowerQuery)) {
    score += 5;
  }

  // Label match
  for (const label of document.labels) {
    if (label.toLowerCase().includes(lowerQuery)) {
      score += 3;
    }
  }

  // Exact title match (bonus)
  if (document.title.toLowerCase() === lowerQuery) {
    score += 20;
  }

  return score;
}

/**
 * Extract keywords from text (simple extraction)
 */
export function extractKeywords(text: string, maxKeywords = 10): string[] {
  // Remove common words
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'must',
    'can',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
  ]);

  // Extract words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  // Count frequency
  const frequency = new Map<string, number>();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  // Sort by frequency and return top N
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}
