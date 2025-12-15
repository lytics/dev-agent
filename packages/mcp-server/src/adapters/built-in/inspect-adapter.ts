/**
 * Inspect Adapter
 * Exposes code inspection capabilities via MCP (dev_inspect tool)
 *
 * Provides file-level analysis: similarity comparison and pattern consistency checking.
 */

import {
  PatternAnalysisService,
  type PatternComparison,
  type SearchService,
} from '@lytics/dev-agent-core';
import { InspectArgsSchema } from '../../schemas/index.js';
import { ToolAdapter } from '../tool-adapter.js';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types.js';
import { validateArgs } from '../validation.js';

export interface InspectAdapterConfig {
  repositoryPath: string;
  searchService: SearchService;
  defaultLimit?: number;
  defaultThreshold?: number;
  defaultFormat?: 'compact' | 'verbose';
}

/**
 * InspectAdapter - Deep file analysis
 *
 * Provides comprehensive file inspection: finds similar code and analyzes
 * patterns against the codebase. Returns facts (not judgments) for AI to interpret.
 */
export class InspectAdapter extends ToolAdapter {
  metadata = {
    name: 'inspect',
    version: '2.0.0',
    description: 'Comprehensive file inspection with pattern analysis',
  };

  private repositoryPath: string;
  private searchService: SearchService;
  private patternService: PatternAnalysisService;
  private defaultLimit: number;
  private defaultThreshold: number;
  private defaultFormat: 'compact' | 'verbose';

  constructor(config: InspectAdapterConfig) {
    super();
    this.repositoryPath = config.repositoryPath;
    this.searchService = config.searchService;
    this.patternService = new PatternAnalysisService({
      repositoryPath: config.repositoryPath,
    });
    this.defaultLimit = config.defaultLimit ?? 10;
    this.defaultThreshold = config.defaultThreshold ?? 0.7;
    this.defaultFormat = config.defaultFormat ?? 'compact';
  }

  async initialize(context: AdapterContext): Promise<void> {
    // Store coordinator and logger from base class
    this.initializeBase(context);

    context.logger.info('InspectAdapter initialized', {
      repositoryPath: this.repositoryPath,
      defaultLimit: this.defaultLimit,
      defaultThreshold: this.defaultThreshold,
      defaultFormat: this.defaultFormat,
      hasCoordinator: this.hasCoordinator(),
    });
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'dev_inspect',
      description:
        'Inspect a file for pattern analysis. Finds similar code and compares patterns ' +
        '(error handling, naming, types, structure). Returns facts about how this file ' +
        'compares to similar code, without making judgments.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'File path to inspect (e.g., "src/auth/middleware.ts")',
          },
          limit: {
            type: 'number',
            description: `Number of similar files to compare against (default: ${this.defaultLimit})`,
            default: this.defaultLimit,
            minimum: 1,
            maximum: 50,
          },
          threshold: {
            type: 'number',
            description: `Similarity threshold 0-1 (default: ${this.defaultThreshold})`,
            default: this.defaultThreshold,
            minimum: 0,
            maximum: 1,
          },
          format: {
            type: 'string',
            enum: ['compact', 'verbose'],
            description:
              'Output format: "compact" for summaries (default), "verbose" for full details',
            default: this.defaultFormat,
          },
        },
        required: ['query'],
      },
    };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Validate args with Zod
    const validation = validateArgs(InspectArgsSchema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { query, limit, threshold, format } = validation.data;

    try {
      context.logger.debug('Executing file inspection', {
        query,
        limit,
        threshold,
        format,
      });

      // Perform comprehensive file inspection
      const { content, similarFilesCount, patternsAnalyzed } = await this.inspectFile(
        query,
        limit,
        threshold,
        format
      );

      context.logger.info('File inspection completed', {
        query,
        similarFilesCount,
        patternsAnalyzed,
        contentLength: content.length,
      });

      // Return markdown content (MCP will wrap in content blocks)
      return {
        success: true,
        data: content,
        metadata: {
          tokens: content.length / 4, // Rough estimate
          duration_ms: 0, // Calculated by MCP server
          timestamp: new Date().toISOString(),
          cached: false,
          similar_files_count: similarFilesCount,
          patterns_analyzed: patternsAnalyzed,
          format,
        },
      };
    } catch (error) {
      context.logger.error('Inspection failed', { error });

      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          return {
            success: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: `File not found: ${query}`,
              suggestion: 'Check the file path and ensure it exists in the repository.',
            },
          };
        }

        if (error.message.includes('not indexed')) {
          return {
            success: false,
            error: {
              code: 'INDEX_NOT_READY',
              message: 'Code index is not ready',
              suggestion: 'Run "dev index" to index the repository.',
            },
          };
        }
      }

      return {
        success: false,
        error: {
          code: 'INSPECTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown inspection error',
        },
      };
    }
  }

  /**
   * Comprehensive file inspection
   *
   * Finds similar files and analyzes patterns in one operation.
   * Returns markdown-formatted results.
   */
  private async inspectFile(
    filePath: string,
    limit: number,
    threshold: number,
    format: string
  ): Promise<{ content: string; similarFilesCount: number; patternsAnalyzed: number }> {
    // Step 1: Find similar files (request slightly more to account for extension filtering)
    const similarResults = await this.searchService.findSimilar(filePath, {
      limit: limit + 5, // Small buffer for extension filtering
      threshold,
    });

    // Get the file extension for filtering
    const targetExtension = filePath.split('.').pop()?.toLowerCase() || '';

    // Exclude the reference file itself and filter by extension
    const filteredResults = similarResults
      .filter((r) => {
        const path = r.metadata.path as string;
        if (path === filePath) return false; // Exclude self

        // Only compare files with the same extension
        const ext = path.split('.').pop()?.toLowerCase() || '';
        return ext === targetExtension;
      })
      .slice(0, limit);

    if (filteredResults.length === 0) {
      return {
        content: `## File Inspection: ${filePath}\n\n**Status:** No similar files found. This file may be unique in the repository.`,
        similarFilesCount: 0,
        patternsAnalyzed: 0,
      };
    }

    // Step 2: Analyze patterns for target file and similar files
    const similarFilePaths = filteredResults.map((r) => r.metadata.path as string);
    const patternComparison = await this.patternService.comparePatterns(filePath, similarFilePaths);

    // Step 3: Generate comprehensive inspection report
    const content =
      format === 'verbose'
        ? await this.formatInspectionVerbose(filePath, filteredResults, patternComparison)
        : await this.formatInspectionCompact(filePath, filteredResults, patternComparison);

    return {
      content,
      similarFilesCount: filteredResults.length,
      patternsAnalyzed: 5, // Currently analyzing 5 pattern categories
    };
  }

  /**
   * Format inspection results in compact mode
   *
   * Includes: similar files list + pattern summary
   */
  private async formatInspectionCompact(
    filePath: string,
    similarFiles: Array<{ id: string; score: number; metadata: Record<string, unknown> }>,
    patterns: PatternComparison
  ): Promise<string> {
    const lines = [
      `## File Inspection: ${filePath}`,
      '',
      `### Similar Files (${similarFiles.length} analyzed)`,
    ];

    // Show top 5 similar files
    for (let i = 0; i < Math.min(5, similarFiles.length); i++) {
      const file = similarFiles[i];
      const score = (file.score * 100).toFixed(0);
      lines.push(`${i + 1}. \`${file.metadata.path}\` (${score}%)`);
    }

    if (similarFiles.length > 5) {
      lines.push(`..._${similarFiles.length - 5} more_`);
    }

    lines.push('');
    lines.push('### Pattern Analysis');
    lines.push('');

    // Import Style
    if (patterns.importStyle.yourFile !== patterns.importStyle.common) {
      lines.push(
        `**Import Style:** Your file uses \`${patterns.importStyle.yourFile}\`, but ${patterns.importStyle.percentage}% of similar files use \`${patterns.importStyle.common}\`.`
      );
    }

    // Error Handling
    if (patterns.errorHandling.yourFile !== patterns.errorHandling.common) {
      lines.push(
        `**Error Handling:** Your file uses \`${patterns.errorHandling.yourFile}\`, but ${patterns.errorHandling.percentage}% of similar files use \`${patterns.errorHandling.common}\`.`
      );
    }

    // Type Annotations
    if (patterns.typeAnnotations.yourFile !== patterns.typeAnnotations.common) {
      lines.push(
        `**Type Coverage:** Your file has \`${patterns.typeAnnotations.yourFile}\` type coverage, but ${patterns.typeAnnotations.percentage}% of similar files have \`${patterns.typeAnnotations.common}\`.`
      );
    }

    // Testing
    if (patterns.testing.yourFile !== (patterns.testing.percentage === 100)) {
      const testStatus = patterns.testing.yourFile ? 'has' : 'is missing';
      lines.push(
        `**Testing:** This file ${testStatus} a test file. ${patterns.testing.percentage}% (${patterns.testing.count.withTest}/${patterns.testing.count.total}) of similar files have tests.`
      );
    }

    // File Size
    if (patterns.fileSize.deviation !== 'similar') {
      const comparison = patterns.fileSize.deviation === 'larger' ? 'larger than' : 'smaller than';
      lines.push(
        `**Size:** ${patterns.fileSize.yourFile} lines (${comparison} average of ${patterns.fileSize.average} lines)`
      );
    }

    if (lines.length === 5) {
      lines.push('**Status:** All patterns consistent with similar files.');
    }

    return lines.join('\n');
  }

  /**
   * Format inspection results in verbose mode
   *
   * Includes: detailed similar files + comprehensive pattern analysis
   */
  private async formatInspectionVerbose(
    filePath: string,
    similarFiles: Array<{ id: string; score: number; metadata: Record<string, unknown> }>,
    patterns: PatternComparison
  ): Promise<string> {
    const lines = [
      `## File Inspection: ${filePath}`,
      '',
      `### Similar Files Analysis (${similarFiles.length} analyzed)`,
      '',
    ];

    // Show all similar files with details
    for (let i = 0; i < Math.min(10, similarFiles.length); i++) {
      const file = similarFiles[i];
      const score = (file.score * 100).toFixed(1);
      const type = file.metadata.type || 'file';
      const name = file.metadata.name || file.metadata.path;

      lines.push(
        `${i + 1}. **${name}** (\`${file.metadata.path}\`) - ${score}% similar, type: ${type}`
      );
    }

    if (similarFiles.length > 10) {
      lines.push(`..._${similarFiles.length - 10} more files_`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('### Comprehensive Pattern Analysis');
    lines.push('');

    // 1. Import Style
    lines.push('#### 1. Import Style');
    lines.push(`- **Your File:** \`${patterns.importStyle.yourFile}\``);
    lines.push(
      `- **Common Style:** \`${patterns.importStyle.common}\` (${patterns.importStyle.percentage}% of similar files)`
    );
    if (Object.keys(patterns.importStyle.distribution).length > 1) {
      lines.push('- **Distribution:**');
      for (const [style, count] of Object.entries(patterns.importStyle.distribution)) {
        const pct = Math.round(((count as number) / similarFiles.length) * 100);
        lines.push(`  - ${style}: ${count} files (${pct}%)`);
      }
    }
    lines.push('');

    // 2. Error Handling
    lines.push('#### 2. Error Handling');
    lines.push(`- **Your File:** \`${patterns.errorHandling.yourFile}\``);
    lines.push(
      `- **Common Style:** \`${patterns.errorHandling.common}\` (${patterns.errorHandling.percentage}% of similar files)`
    );
    if (Object.keys(patterns.errorHandling.distribution).length > 1) {
      lines.push('- **Distribution:**');
      for (const [style, count] of Object.entries(patterns.errorHandling.distribution)) {
        const pct = Math.round(((count as number) / similarFiles.length) * 100);
        lines.push(`  - ${style}: ${count} files (${pct}%)`);
      }
    }
    lines.push('');

    // 3. Type Annotations
    lines.push('#### 3. Type Annotation Coverage');
    lines.push(`- **Your File:** \`${patterns.typeAnnotations.yourFile}\``);
    lines.push(
      `- **Common Coverage:** \`${patterns.typeAnnotations.common}\` (${patterns.typeAnnotations.percentage}% of similar files)`
    );
    if (Object.keys(patterns.typeAnnotations.distribution).length > 1) {
      lines.push('- **Distribution:**');
      for (const [coverage, count] of Object.entries(patterns.typeAnnotations.distribution)) {
        const pct = Math.round(((count as number) / similarFiles.length) * 100);
        lines.push(`  - ${coverage}: ${count} files (${pct}%)`);
      }
    }
    lines.push('');

    // 4. Test Coverage
    lines.push('#### 4. Test Coverage');
    lines.push(`- **Your File:** ${patterns.testing.yourFile ? 'Has test file' : 'No test file'}`);
    lines.push(
      `- **Similar Files:** ${patterns.testing.count.withTest}/${patterns.testing.count.total} have tests (${patterns.testing.percentage}%)`
    );
    lines.push('');

    // 5. File Size
    lines.push('#### 5. File Size');
    lines.push(`- **Your File:** ${patterns.fileSize.yourFile} lines`);
    lines.push(`- **Average:** ${patterns.fileSize.average} lines`);
    lines.push(`- **Median:** ${patterns.fileSize.median} lines`);
    lines.push(`- **Range:** ${patterns.fileSize.range[0]} - ${patterns.fileSize.range[1]} lines`);
    lines.push(
      `- **Assessment:** Your file is ${patterns.fileSize.deviation} relative to similar files`
    );
    lines.push('');

    return lines.join('\n');
  }
}
