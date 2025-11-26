import { describe, expect, it } from 'vitest';
import { ToolAdapter } from '../tool-adapter';
import type { AdapterContext, ToolDefinition, ToolExecutionContext, ToolResult } from '../types';

// Concrete implementation for testing
class TestToolAdapter extends ToolAdapter {
  metadata = {
    name: 'test-tool',
    version: '1.0.0',
    description: 'Test tool adapter',
  };

  async initialize(_context: AdapterContext): Promise<void> {
    // No-op for testing
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): Promise<ToolResult> {
    return {
      success: true,
      data: {
        result: `Executed with query: ${args.query}`,
      },
    };
  }
}

// Tool adapter with validation
class ValidatingToolAdapter extends TestToolAdapter {
  validate(args: Record<string, unknown>) {
    if (!args.query || typeof args.query !== 'string') {
      return {
        valid: false,
        errors: ['query is required and must be a string'],
      };
    }
    if (args.query.length < 3) {
      return {
        valid: false,
        errors: ['query must be at least 3 characters'],
      };
    }
    return { valid: true };
  }
}

// Tool adapter with token estimation
class EstimatingToolAdapter extends TestToolAdapter {
  estimateTokens(args: Record<string, unknown>): number {
    const query = args.query as string;
    // Simple estimation: ~4 chars per token
    return Math.ceil(query.length / 4) + 50; // 50 tokens overhead
  }
}

// Tool adapter that can fail
class FailingToolAdapter extends TestToolAdapter {
  async execute(
    _args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): Promise<ToolResult> {
    return {
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: 'Tool execution failed',
      },
      metadata: {
        errorCode: 'EXECUTION_ERROR',
      } as Record<string, unknown>,
    };
  }
}

describe('ToolAdapter', () => {
  const mockContext: ToolExecutionContext = {
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as unknown as ToolExecutionContext;

  describe('getToolDefinition', () => {
    it('should return tool definition', () => {
      const adapter = new TestToolAdapter();
      const definition = adapter.getToolDefinition();

      expect(definition.name).toBe('test_tool');
      expect(definition.description).toBe('A test tool');
      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.type).toBe('object');
    });

    it('should include input schema properties', () => {
      const adapter = new TestToolAdapter();
      const definition = adapter.getToolDefinition();

      expect(definition.inputSchema.properties).toBeDefined();
      expect(definition.inputSchema.properties?.query).toBeDefined();
      expect(definition.inputSchema.required).toContain('query');
    });

    it('should specify property types', () => {
      const adapter = new TestToolAdapter();
      const definition = adapter.getToolDefinition();

      expect(definition.inputSchema.properties?.query?.type).toBe('string');
    });
  });

  describe('execute', () => {
    it('should execute tool successfully', async () => {
      const adapter = new TestToolAdapter();
      const args = { query: 'test query' };

      const result = await adapter.execute(args, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as { result: string }).result).toContain('test query');
    });

    it('should handle tool failure', async () => {
      const adapter = new FailingToolAdapter();
      const args = { query: 'test' };

      const result = await adapter.execute(args, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Tool execution failed');
      expect(result.error?.code).toBe('EXECUTION_ERROR');
    });

    it('should include metadata in failure', async () => {
      const adapter = new FailingToolAdapter();
      const args = { query: 'test' };

      const result = await adapter.execute(args, mockContext);

      expect(result.metadata).toBeDefined();
      expect((result.metadata as Record<string, unknown>)?.errorCode).toBe('EXECUTION_ERROR');
    });

    it('should pass arguments to tool', async () => {
      const adapter = new TestToolAdapter();
      const args = { query: 'search term' };

      const result = await adapter.execute(args, mockContext);

      expect((result.data as { result: string }).result).toContain('search term');
    });

    it('should receive execution context', async () => {
      const adapter = new TestToolAdapter();
      const args = { query: 'test' };

      // Should not throw even with mock context
      await expect(adapter.execute(args, mockContext)).resolves.toBeDefined();
    });
  });

  describe('validate (optional)', () => {
    it('should validate valid arguments', () => {
      const adapter = new ValidatingToolAdapter();
      const args = { query: 'valid query' };

      const result = adapter.validate?.(args);

      expect(result?.valid).toBe(true);
      expect(result?.errors).toBeUndefined();
    });

    it('should reject missing required fields', () => {
      const adapter = new ValidatingToolAdapter();
      const args = {};

      const result = adapter.validate?.(args);

      expect(result?.valid).toBe(false);
      expect(result?.errors).toContain('query is required and must be a string');
    });

    it('should reject invalid field types', () => {
      const adapter = new ValidatingToolAdapter();
      const args = { query: 123 };

      const result = adapter.validate?.(args);

      expect(result?.valid).toBe(false);
      expect(result?.errors).toBeDefined();
    });

    it('should validate field constraints', () => {
      const adapter = new ValidatingToolAdapter();
      const args = { query: 'ab' }; // Too short

      const result = adapter.validate?.(args);

      expect(result?.valid).toBe(false);
      expect(result?.errors).toContain('query must be at least 3 characters');
    });

    it('should be undefined by default', () => {
      const adapter = new TestToolAdapter();

      expect(adapter.validate).toBeUndefined();
    });
  });

  describe('estimateTokens (optional)', () => {
    it('should estimate token count', () => {
      const adapter = new EstimatingToolAdapter();
      const args = { query: 'This is a test query' }; // ~20 chars = 5 tokens + 50 overhead = 55

      const tokens = adapter.estimateTokens?.(args);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(55); // 20/4 + 50
    });

    it('should handle short queries', () => {
      const adapter = new EstimatingToolAdapter();
      const args = { query: 'hi' }; // 2 chars = 1 token + 50 overhead = 51

      const tokens = adapter.estimateTokens?.(args);

      expect(tokens).toBe(51);
    });

    it('should handle long queries', () => {
      const adapter = new EstimatingToolAdapter();
      const args = { query: 'a'.repeat(100) }; // 100 chars = 25 tokens + 50 overhead = 75

      const tokens = adapter.estimateTokens?.(args);

      expect(tokens).toBe(75);
    });

    it('should be undefined by default', () => {
      const adapter = new TestToolAdapter();

      expect(adapter.estimateTokens).toBeUndefined();
    });
  });

  describe('metadata', () => {
    it('should have adapter metadata', () => {
      const adapter = new TestToolAdapter();

      expect(adapter.metadata.name).toBe('test-tool');
      expect(adapter.metadata.version).toBe('1.0.0');
      expect(adapter.metadata.description).toBe('Test tool adapter');
    });
  });

  describe('inheritance', () => {
    it('should extend Adapter base class', () => {
      const adapter = new TestToolAdapter();

      // Should have metadata from Adapter
      expect(adapter.metadata).toBeDefined();
    });

    it('should implement required abstract methods', () => {
      const adapter = new TestToolAdapter();

      expect(adapter.getToolDefinition).toBeDefined();
      expect(adapter.execute).toBeDefined();
      expect(adapter.initialize).toBeDefined();
    });
  });
});
