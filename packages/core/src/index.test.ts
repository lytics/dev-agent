import { describe, it, expect } from 'vitest';
import { CoreService, createCoreService } from './index';

describe('CoreService', () => {
  it('should create a CoreService instance', () => {
    const service = new CoreService({ apiKey: 'test-key', debug: false });
    expect(service).toBeInstanceOf(CoreService);
  });

  it('should return the API key', () => {
    const service = new CoreService({ apiKey: 'test-key', debug: false });
    expect(service.getApiKey()).toBe('test-key');
  });

  it('should create a CoreService via factory function', () => {
    const service = createCoreService({ apiKey: 'factory-key', debug: true });
    expect(service).toBeInstanceOf(CoreService);
    expect(service.getApiKey()).toBe('factory-key');
  });
});
