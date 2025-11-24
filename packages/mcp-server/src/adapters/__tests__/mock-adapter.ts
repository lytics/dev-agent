/**
 * Mock Adapter for Testing
 * Simple echo adapter that returns what you send it
 */

import { ToolAdapter } from '../tool-adapter';
import type {
  AdapterContext,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
  ValidationResult,
} from '../types';

export class MockAdapter extends ToolAdapter {
  readonly metadata = {
    name: 'mock-adapter',
    version: '1.0.0',
    description: 'Mock adapter for testing',
  };

  private initializeCount = 0;
  private shutdownCount = 0;
  private executeCount = 0;

  async initialize(context: AdapterContext): Promise<void> {
    this.initializeCount++;
    context.logger.info('MockAdapter initialized');
  }

  async shutdown(): Promise<void> {
    this.shutdownCount++;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'mock_echo',
      description: 'Echo back the input message',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo back',
          },
          delay: {
            type: 'number',
            description: 'Optional delay in milliseconds',
          },
        },
        required: ['message'],
      },
    };
  }

  validate(args: Record<string, unknown>): ValidationResult {
    if (typeof args.message !== 'string') {
      return {
        valid: false,
        error: 'message must be a string',
      };
    }

    if (args.delay !== undefined && typeof args.delay !== 'number') {
      return {
        valid: false,
        error: 'delay must be a number',
      };
    }

    return { valid: true };
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    this.executeCount++;

    const { message, delay } = args;

    // Optional delay
    if (delay && typeof delay === 'number') {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    context.logger.info('MockAdapter executing', { message });

    return {
      success: true,
      data: {
        echo: message,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        tokenEstimate: 10,
      },
    };
  }

  estimateTokens(args: Record<string, unknown>): number {
    const message = String(args.message || '');
    return Math.ceil(message.length / 4) + 5; // Rough estimate
  }

  // Test helpers
  getCallCounts() {
    return {
      initialize: this.initializeCount,
      shutdown: this.shutdownCount,
      execute: this.executeCount,
    };
  }

  resetCounts() {
    this.initializeCount = 0;
    this.shutdownCount = 0;
    this.executeCount = 0;
  }
}
