import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthAdapter, type HealthStatus } from '../built-in/health-adapter';
import type { AdapterContext, ToolExecutionContext } from '../types';

describe('HealthAdapter', () => {
  let testDir: string;
  let vectorStorePath: string;
  let repositoryPath: string;
  let githubStatePath: string;
  let adapter: HealthAdapter;
  let context: AdapterContext;
  let execContext: ToolExecutionContext;

  beforeEach(async () => {
    // Create temporary directories for testing
    testDir = path.join(os.tmpdir(), `health-adapter-test-${Date.now()}`);
    vectorStorePath = path.join(testDir, 'vectors');
    repositoryPath = path.join(testDir, 'repo');
    githubStatePath = path.join(testDir, 'github-state.json');

    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(vectorStorePath, { recursive: true });
    await fs.mkdir(repositoryPath, { recursive: true });

    adapter = new HealthAdapter({
      repositoryPath,
      vectorStorePath,
      githubStatePath,
    });

    context = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      config: {
        repositoryPath,
      },
    };

    execContext = {
      logger: context.logger,
      config: context.config,
    };

    await adapter.initialize(context);
  });

  afterEach(async () => {
    await adapter.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Tool Definition', () => {
    it('should provide valid tool definition', () => {
      const definition = adapter.getToolDefinition();

      expect(definition.name).toBe('dev_health');
      expect(definition.description).toContain('health status');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('verbose');
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when all components are operational', async () => {
      // Setup: Create vector storage with some files
      await fs.writeFile(path.join(vectorStorePath, 'data.db'), 'test data');

      // Setup: Create git repository
      await fs.mkdir(path.join(repositoryPath, '.git'));

      // Setup: Create GitHub index
      await fs.writeFile(
        githubStatePath,
        JSON.stringify({
          version: '1.0.0',
          lastIndexed: new Date().toISOString(),
          items: [{ id: 1 }, { id: 2 }],
        })
      );

      const result = await adapter.execute({}, execContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const health = result.data as HealthStatus;
      expect(health.status).toBe('healthy');
      expect(health.checks.vectorStorage.status).toBe('pass');
      expect(health.checks.repository.status).toBe('pass');
      expect(health.checks.githubIndex?.status).toBe('pass');
    });

    it('should report degraded when components have warnings', async () => {
      // Vector storage is empty (warning)
      // Repository exists but no .git (warning)
      // No GitHub index

      const result = await adapter.execute({}, execContext);

      expect(result.success).toBe(true);

      const health = result.data as HealthStatus;
      expect(health.status).toBe('degraded');
      expect(health.checks.vectorStorage.status).toBe('warn');
      expect(health.checks.repository.status).toBe('warn');
    });

    it('should report unhealthy when components fail', async () => {
      // Delete vector storage to cause failure
      await fs.rm(vectorStorePath, { recursive: true });

      const result = await adapter.execute({}, execContext);

      expect(result.success).toBe(true);

      const health = result.data as HealthStatus;
      expect(health.status).toBe('unhealthy');
      expect(health.checks.vectorStorage.status).toBe('fail');
    });
  });

  describe('Vector Storage Check', () => {
    it('should pass when vector storage has data', async () => {
      await fs.writeFile(path.join(vectorStorePath, 'index.db'), 'data');
      await fs.writeFile(path.join(vectorStorePath, 'vectors.db'), 'data');

      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.vectorStorage.status).toBe('pass');
      expect(health.checks.vectorStorage.message).toContain('2 files');
    });

    it('should warn when vector storage is empty', async () => {
      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.vectorStorage.status).toBe('warn');
      expect(health.checks.vectorStorage.message).toContain('empty');
    });

    it('should fail when vector storage does not exist', async () => {
      await fs.rm(vectorStorePath, { recursive: true });

      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.vectorStorage.status).toBe('fail');
      expect(health.checks.vectorStorage.message).toContain('not accessible');
    });

    it('should include details in verbose mode', async () => {
      await fs.writeFile(path.join(vectorStorePath, 'data.db'), 'test');

      const result = await adapter.execute({ verbose: true }, execContext);
      expect(result.success).toBe(true);
      const health = result.data as HealthStatus;

      expect(health.checks.vectorStorage.details).toBeDefined();
      expect(health.checks.vectorStorage.details?.path).toBe(vectorStorePath);
    });
  });

  describe('Repository Check', () => {
    it('should pass when repository is a git repo', async () => {
      await fs.mkdir(path.join(repositoryPath, '.git'));

      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.repository.status).toBe('pass');
      expect(health.checks.repository.message).toContain('Git repository');
    });

    it('should warn when repository exists but is not a git repo', async () => {
      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.repository.status).toBe('warn');
      expect(health.checks.repository.message).toContain('not a Git repository');
    });

    it('should fail when repository does not exist', async () => {
      await fs.rm(repositoryPath, { recursive: true });

      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.repository.status).toBe('fail');
      expect(health.checks.repository.message).toContain('not accessible');
    });
  });

  describe('GitHub Index Check', () => {
    it('should pass when index is recent', async () => {
      await fs.writeFile(
        githubStatePath,
        JSON.stringify({
          version: '1.0.0',
          lastIndexed: new Date().toISOString(),
          items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        })
      );

      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.githubIndex?.status).toBe('pass');
      expect(health.checks.githubIndex?.message).toContain('3 items');
    });

    it('should warn when index is stale (>24 hours)', async () => {
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await fs.writeFile(
        githubStatePath,
        JSON.stringify({
          version: '1.0.0',
          lastIndexed: yesterday.toISOString(),
          items: [{ id: 1 }],
        })
      );

      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.githubIndex?.status).toBe('warn');
      expect(health.checks.githubIndex?.message).toContain('old');
    });

    it('should warn when index file does not exist', async () => {
      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.githubIndex?.status).toBe('warn');
      expect(health.checks.githubIndex?.message).toContain('not accessible');
    });

    it('should not check GitHub index when not configured', async () => {
      const adapterWithoutGithub = new HealthAdapter({
        repositoryPath,
        vectorStorePath,
      });

      await adapterWithoutGithub.initialize(context);

      const result = await adapterWithoutGithub.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.githubIndex).toBeUndefined();

      await adapterWithoutGithub.shutdown();
    });
  });

  describe('Output Formatting', () => {
    it('should format uptime correctly', async () => {
      // Wait a moment to accumulate uptime
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await adapter.execute({}, execContext);
      const data = result.data as { formattedReport: string };

      expect(result.success).toBe(true);
      expect(data.formattedReport).toContain('Uptime:');
    });

    it('should include timestamp', async () => {
      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.timestamp).toBeDefined();
      expect(new Date(health.timestamp).getTime()).toBeCloseTo(Date.now(), -3); // Within 1000ms
    });

    it('should format component names nicely', async () => {
      const result = await adapter.execute({}, execContext);
      const data = result.data as { formattedReport: string };

      expect(data.formattedReport).toContain('Vector Storage:');
      expect(data.formattedReport).toContain('Repository:');
    });

    it('should use appropriate emojis', async () => {
      await fs.writeFile(path.join(vectorStorePath, 'data.db'), 'test');
      await fs.mkdir(path.join(repositoryPath, '.git'));

      const result = await adapter.execute({}, execContext);
      const data = result.data as { formattedReport: string };

      expect(data.formattedReport).toContain('✅');
    });

    it('should include details in verbose mode', async () => {
      await fs.writeFile(path.join(vectorStorePath, 'data.db'), 'test');

      const result = await adapter.execute({ verbose: true }, execContext);
      expect(result.success).toBe(true);
      const data = result.data as { formattedReport: string };

      expect(data.formattedReport).toContain('Details:');
    });

    it('should not include details in non-verbose mode', async () => {
      await fs.writeFile(path.join(vectorStorePath, 'data.db'), 'test');

      const result = await adapter.execute({ verbose: false }, execContext);
      const data = result.data as { formattedReport: string };

      expect(data.formattedReport).not.toContain('Details:');
    });
  });

  describe('Adapter Health Check Method', () => {
    it('should return true when healthy', async () => {
      await fs.writeFile(path.join(vectorStorePath, 'data.db'), 'test');
      await fs.mkdir(path.join(repositoryPath, '.git'));

      // Add GitHub index to make it fully healthy
      await fs.writeFile(
        githubStatePath,
        JSON.stringify({
          version: '1.0.0',
          lastIndexed: new Date().toISOString(),
          items: [{ id: 1 }],
        })
      );

      const healthy = await adapter.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      await fs.rm(vectorStorePath, { recursive: true });

      const healthy = await adapter.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid GitHub state JSON', async () => {
      await fs.writeFile(githubStatePath, 'invalid json');

      const result = await adapter.execute({}, execContext);
      const health = result.data as HealthStatus;

      expect(health.checks.githubIndex?.status).toBe('warn');
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-dependent, so we'll skip it if we can't set permissions
      if (process.platform !== 'win32') {
        await fs.chmod(vectorStorePath, 0o000);

        const result = await adapter.execute({}, execContext);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        // Restore permissions for cleanup
        await fs.chmod(vectorStorePath, 0o755);
      }
    });
  });

  describe('Metadata', () => {
    it('should include correct metadata', () => {
      expect(adapter.metadata.name).toBe('health-adapter');
      expect(adapter.metadata.version).toBe('1.0.0');
      expect(adapter.metadata.description).toContain('health');
    });
  });
});
