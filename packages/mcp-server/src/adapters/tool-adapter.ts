/**
 * Tool Adapter Base Class
 * Extends Adapter to provide tool-specific functionality
 */

import { Adapter } from './adapter';
import type { ToolDefinition, ToolExecutionContext, ToolResult, ValidationResult } from './types';

export abstract class ToolAdapter extends Adapter {
  /**
   * Get the tool definition (name, description, schema)
   * This is used by MCP to list available tools
   */
  abstract getToolDefinition(): ToolDefinition;

  /**
   * Execute the tool with given arguments
   * @param args Tool arguments from MCP client
   * @param context Execution context (logger, config, etc.)
   * @returns Tool result (success/error with data)
   */
  abstract execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;

  /**
   * Optional: Validate arguments before execution
   * @param args Tool arguments to validate
   * @returns Validation result
   */
  validate?(args: Record<string, unknown>): ValidationResult;

  /**
   * Optional: Estimate token usage for the response
   * Used for token budget management
   * @param args Tool arguments
   * @returns Estimated token count
   */
  estimateTokens?(args: Record<string, unknown>): number;
}
