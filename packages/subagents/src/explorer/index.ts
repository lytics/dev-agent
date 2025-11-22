/**
 * Explorer Subagent = Visual Cortex
 * Explores and analyzes code patterns using semantic search
 */

import type { Agent, AgentContext, Message } from '../types';
import type {
  CodeInsights,
  CodeRelationship,
  ExplorationError,
  ExplorationRequest,
  ExplorationResult,
  InsightsResult,
  PatternResult,
  RelationshipResult,
  SimilarCodeResult,
} from './types';
import {
  calculateCoverage,
  createRelationship,
  extractFilePath,
  getCommonPatterns,
  isDuplicateRelationship,
  isNotReferenceFile,
  matchesFileType,
  sortAndLimitPatterns,
} from './utils';

export class ExplorerAgent implements Agent {
  name = 'explorer';
  capabilities = ['explore', 'analyze-patterns', 'find-similar', 'relationships', 'insights'];

  private context?: AgentContext;

  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
    this.name = context.agentName;
    context.logger.info('Explorer agent initialized', {
      capabilities: this.capabilities,
    });
  }

  async handleMessage(message: Message): Promise<Message | null> {
    if (!this.context) {
      throw new Error('Explorer not initialized');
    }

    const { logger } = this.context;

    if (message.type !== 'request') {
      logger.debug('Ignoring non-request message', { type: message.type });
      return null;
    }

    try {
      const request = message.payload as unknown as ExplorationRequest;
      logger.debug('Processing exploration request', { action: request.action });

      let result: ExplorationResult | ExplorationError;

      switch (request.action) {
        case 'pattern':
          result = await this.searchPattern(request);
          break;
        case 'similar':
          result = await this.findSimilar(request);
          break;
        case 'relationships':
          result = await this.findRelationships(request);
          break;
        case 'insights':
          result = await this.getInsights(request);
          break;
        default:
          result = {
            action: 'pattern',
            error: `Unknown action: ${(request as ExplorationRequest).action}`,
          };
      }

      return {
        id: `${message.id}-response`,
        type: 'response',
        sender: this.name,
        recipient: message.sender,
        correlationId: message.id,
        payload: result as unknown as Record<string, unknown>,
        priority: message.priority,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Exploration failed', error as Error, {
        messageId: message.id,
      });

      return {
        id: `${message.id}-error`,
        type: 'error',
        sender: this.name,
        recipient: message.sender,
        correlationId: message.id,
        payload: {
          error: (error as Error).message,
          stack: (error as Error).stack,
        },
        priority: message.priority,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Search for code patterns using semantic search
   */
  private async searchPattern(request: {
    action: 'pattern';
    query: string;
    limit?: number;
    threshold?: number;
    fileTypes?: string[];
  }): Promise<PatternResult> {
    if (!this.context) {
      throw new Error('Explorer not initialized');
    }

    const { logger, contextManager } = this.context;
    const indexer = contextManager.getIndexer();

    logger.info('Searching for pattern', { query: request.query });

    const results = await indexer.search(request.query, {
      limit: request.limit || 10,
      scoreThreshold: request.threshold || 0.7,
    });

    // Filter by file types if specified
    let filteredResults = results;
    if (request.fileTypes && request.fileTypes.length > 0) {
      const fileTypes = request.fileTypes; // Capture for type narrowing
      filteredResults = results.filter((result) => matchesFileType(result, fileTypes));
    }

    logger.info('Pattern search complete', {
      query: request.query,
      found: filteredResults.length,
    });

    return {
      action: 'pattern',
      query: request.query,
      results: filteredResults,
      totalFound: filteredResults.length,
    };
  }

  /**
   * Find code similar to a given file
   */
  private async findSimilar(request: {
    action: 'similar';
    filePath: string;
    limit?: number;
    threshold?: number;
  }): Promise<SimilarCodeResult> {
    if (!this.context) {
      throw new Error('Explorer not initialized');
    }

    const { logger, contextManager } = this.context;
    const indexer = contextManager.getIndexer();

    logger.info('Finding similar code', { filePath: request.filePath });

    // Search using the file path to find similar code
    // The indexer will use semantic similarity
    const similarResults = await indexer.search(request.filePath, {
      limit: (request.limit || 10) + 1, // +1 to potentially exclude reference itself
      scoreThreshold: request.threshold || 0.75,
    });

    // Exclude the reference file itself if it appears
    const similar = similarResults.filter((result) => isNotReferenceFile(result, request.filePath));

    logger.info('Similar code found', {
      filePath: request.filePath,
      found: similar.length,
    });

    return {
      action: 'similar',
      referenceFile: request.filePath,
      similar: similar.slice(0, request.limit || 10),
      totalFound: similar.length,
    };
  }

  /**
   * Find component relationships (imports, dependencies, usages)
   */
  private async findRelationships(request: {
    action: 'relationships';
    component: string;
    type?: 'imports' | 'exports' | 'dependencies' | 'usages' | 'all';
    limit?: number;
  }): Promise<RelationshipResult> {
    if (!this.context) {
      throw new Error('Explorer not initialized');
    }

    const { logger, contextManager } = this.context;
    const indexer = contextManager.getIndexer();

    logger.info('Finding relationships', {
      component: request.component,
      type: request.type || 'all',
    });

    const relationshipType = request.type || 'all';
    const relationships: CodeRelationship[] = [];

    // Search for imports
    if (relationshipType === 'imports' || relationshipType === 'all') {
      const importResults = await indexer.search(`import ${request.component} from`, {
        limit: request.limit || 50,
      });

      for (const result of importResults) {
        relationships.push(createRelationship(result, request.component, 'imports'));
      }
    }

    // Search for exports
    if (relationshipType === 'exports' || relationshipType === 'all') {
      const exportResults = await indexer.search(`export ${request.component}`, {
        limit: request.limit || 50,
      });

      for (const result of exportResults) {
        relationships.push(createRelationship(result, request.component, 'exports'));
      }
    }

    // Search for usages
    if (relationshipType === 'usages' || relationshipType === 'all') {
      const usageResults = await indexer.search(request.component, {
        limit: request.limit || 50,
        scoreThreshold: 0.8,
      });

      for (const result of usageResults) {
        const relationship = createRelationship(result, request.component, 'uses');

        // Avoid duplicates
        if (
          !isDuplicateRelationship(
            relationships,
            relationship.location.file,
            relationship.location.line
          )
        ) {
          relationships.push(relationship);
        }
      }
    }

    logger.info('Relationships found', {
      component: request.component,
      found: relationships.length,
    });

    return {
      action: 'relationships',
      component: request.component,
      relationships: relationships.slice(0, request.limit || 50),
      totalFound: relationships.length,
    };
  }

  /**
   * Get architectural insights from the codebase
   */
  private async getInsights(request: {
    action: 'insights';
    type?: 'patterns' | 'complexity' | 'coverage' | 'all';
  }): Promise<InsightsResult> {
    if (!this.context) {
      throw new Error('Explorer not initialized');
    }

    const { logger, contextManager } = this.context;
    const indexer = contextManager.getIndexer();

    logger.info('Gathering insights', { type: request.type || 'all' });

    const insights: CodeInsights = {
      topPatterns: [],
      fileCount: 0,
      componentCount: 0,
    };

    // Get indexer stats
    const stats = await indexer.getStats();
    if (stats) {
      insights.fileCount = stats.filesScanned;
      insights.componentCount = stats.documentsIndexed;

      if (stats.filesScanned > 0) {
        insights.coverage = calculateCoverage(stats.vectorsStored, stats.filesScanned);
      }
    }

    // Analyze common patterns
    if (!request.type || request.type === 'patterns' || request.type === 'all') {
      const commonPatterns = getCommonPatterns();

      for (const pattern of commonPatterns) {
        const results = await indexer.search(pattern, {
          limit: 100,
          scoreThreshold: 0.6,
        });

        if (results.length > 0) {
          const files = [...new Set(results.map(extractFilePath))];
          insights.topPatterns.push({
            pattern,
            count: results.length,
            files: files.slice(0, 10), // Top 10 files
          });
        }
      }

      // Sort by frequency and limit to top 10
      insights.topPatterns = sortAndLimitPatterns(insights.topPatterns, 10);
    }

    logger.info('Insights gathered', {
      patterns: insights.topPatterns.length,
      files: insights.fileCount,
    });

    return {
      action: 'insights',
      insights,
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.context) {
      return false;
    }

    // Check if indexer is available
    try {
      const indexer = this.context.contextManager.getIndexer();
      const stats = await indexer.getStats();
      return stats !== null && stats.vectorsStored > 0;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    this.context?.logger.info('Explorer agent shutting down');
    this.context = undefined;
  }
}

// Export types
export type * from './types';

// Export utilities
export {
  calculateCoverage,
  createRelationship,
  extractFilePath,
  extractMetadata,
  getCommonPatterns,
  isDuplicateRelationship,
  isNotReferenceFile,
  matchesFileType,
  type ResultMetadata,
  sortAndLimitPatterns,
} from './utils';
