import { describe, expect, it } from 'vitest';
import { CoreService, createCoreService } from './index';

describe('CoreService', () => {
  it('should create a CoreService instance', () => {
    const service = new CoreService({
      apiKey: 'test-key',
      debug: false,
      repositoryPath: '/test/repo',
    });
    expect(service).toBeInstanceOf(CoreService);
  });

  it('should return the API key', () => {
    const service = new CoreService({
      apiKey: 'test-key',
      debug: false,
      repositoryPath: '/test/repo',
    });
    expect(service.getApiKey()).toBe('test-key');
  });

  it('should create a CoreService via factory function', () => {
    const service = createCoreService({
      apiKey: 'factory-key',
      debug: true,
      repositoryPath: '/test/repo',
    });
    expect(service).toBeInstanceOf(CoreService);
    expect(service.getApiKey()).toBe('factory-key');
  });
});
