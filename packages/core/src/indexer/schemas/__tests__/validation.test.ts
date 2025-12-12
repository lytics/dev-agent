/**
 * Tests for indexer validation utilities
 */

import { describe, expect, it } from 'vitest';
import {
  assertDetailedIndexStats,
  assertIndexerState,
  validateDetailedIndexStats,
  validateFileMetadata,
  validateIndexerState,
  validateIndexStats,
  validateLanguageStats,
  validatePackageStats,
  validateStatsMetadata,
} from '../validation';

describe('validateLanguageStats', () => {
  it('should return success for valid stats', () => {
    const valid = {
      files: 10,
      components: 100,
      lines: 5000,
    };

    const result = validateLanguageStats(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it('should return error for invalid stats', () => {
    const invalid = {
      files: -1,
      components: 100,
      lines: 5000,
    };

    const result = validateLanguageStats(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid language stats');
      expect(result.details).toBeDefined();
    }
  });
});

describe('validatePackageStats', () => {
  it('should return success for valid stats', () => {
    const valid = {
      name: '@my/package',
      path: 'packages/my-package',
      files: 50,
      components: 200,
      languages: {},
    };

    const result = validatePackageStats(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('@my/package');
    }
  });

  it('should return error for empty name', () => {
    const invalid = {
      name: '',
      path: 'packages/my-package',
      files: 50,
      components: 200,
    };

    const result = validatePackageStats(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid package stats');
    }
  });
});

describe('validateStatsMetadata', () => {
  it('should return success for valid metadata', () => {
    const valid = {
      isIncremental: false,
      lastFullIndex: new Date('2024-01-01'),
      lastUpdate: new Date('2024-01-02'),
      incrementalUpdatesSince: 0,
    };

    const result = validateStatsMetadata(valid);
    expect(result.success).toBe(true);
  });

  it('should return error for missing fields', () => {
    const invalid = {
      isIncremental: false,
      lastFullIndex: new Date(),
      // missing lastUpdate
      incrementalUpdatesSince: 0,
    };

    const result = validateStatsMetadata(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid stats metadata');
    }
  });
});

describe('validateIndexStats', () => {
  it('should return success for valid stats', () => {
    const valid = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
      repositoryPath: '/path/to/repo',
    };

    const result = validateIndexStats(valid);
    expect(result.success).toBe(true);
  });

  it('should return error for negative numbers', () => {
    const invalid = {
      filesScanned: -1,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
      repositoryPath: '/path/to/repo',
    };

    const result = validateIndexStats(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid index stats');
      expect(result.error).toContain('filesScanned');
    }
  });
});

describe('validateDetailedIndexStats', () => {
  it('should return success for valid detailed stats', () => {
    const valid = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
      repositoryPath: '/path/to/repo',
      byLanguage: {
        typescript: { files: 80, components: 400, lines: 10000 },
      },
      byComponentType: {
        function: 200,
      },
    };

    const result = validateDetailedIndexStats(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.byLanguage?.typescript.files).toBe(80);
    }
  });

  it('should return error for invalid language stats', () => {
    const invalid = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
      repositoryPath: '/path/to/repo',
      byLanguage: {
        typescript: { files: -1, components: 400, lines: 10000 },
      },
    };

    const result = validateDetailedIndexStats(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid detailed index stats');
    }
  });
});

describe('validateFileMetadata', () => {
  it('should return success for valid metadata', () => {
    const valid = {
      path: 'src/index.ts',
      hash: 'abc123',
      lastModified: new Date(),
      lastIndexed: new Date(),
      documentIds: ['doc1'],
      size: 1024,
      language: 'typescript',
    };

    const result = validateFileMetadata(valid);
    expect(result.success).toBe(true);
  });

  it('should coerce date strings', () => {
    const valid = {
      path: 'src/index.ts',
      hash: 'abc123',
      lastModified: '2024-01-01T00:00:00Z',
      lastIndexed: '2024-01-02T00:00:00Z',
      documentIds: [],
      size: 1024,
      language: 'typescript',
    };

    const result = validateFileMetadata(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastModified).toBeInstanceOf(Date);
    }
  });

  it('should return error for negative size', () => {
    const invalid = {
      path: 'src/index.ts',
      hash: 'abc123',
      lastModified: new Date(),
      lastIndexed: new Date(),
      documentIds: [],
      size: -1,
      language: 'typescript',
    };

    const result = validateFileMetadata(invalid);
    expect(result.success).toBe(false);
  });
});

describe('validateIndexerState', () => {
  it('should return success for valid state', () => {
    const valid = {
      version: '1.0.0',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 384,
      repositoryPath: '/path/to/repo',
      lastIndexTime: new Date(),
      files: {},
      stats: {
        totalFiles: 0,
        totalDocuments: 0,
        totalVectors: 0,
      },
    };

    const result = validateIndexerState(valid);
    expect(result.success).toBe(true);
  });

  it('should return error for invalid dimension', () => {
    const invalid = {
      version: '1.0.0',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 0,
      repositoryPath: '/path/to/repo',
      lastIndexTime: new Date(),
      files: {},
      stats: {
        totalFiles: 0,
        totalDocuments: 0,
        totalVectors: 0,
      },
    };

    const result = validateIndexerState(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid indexer state');
    }
  });
});

describe('assertDetailedIndexStats', () => {
  it('should return data for valid stats', () => {
    const valid = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
      repositoryPath: '/path/to/repo',
    };

    const result = assertDetailedIndexStats(valid);
    expect(result.filesScanned).toBe(100);
  });

  it('should throw for invalid stats', () => {
    const invalid = {
      filesScanned: -1,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
      repositoryPath: '/path/to/repo',
    };

    expect(() => assertDetailedIndexStats(invalid)).toThrow();
  });
});

describe('assertIndexerState', () => {
  it('should return data for valid state', () => {
    const valid = {
      version: '1.0.0',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 384,
      repositoryPath: '/path/to/repo',
      lastIndexTime: new Date(),
      files: {},
      stats: {
        totalFiles: 0,
        totalDocuments: 0,
        totalVectors: 0,
      },
    };

    const result = assertIndexerState(valid);
    expect(result.version).toBe('1.0.0');
  });

  it('should throw for invalid state', () => {
    const invalid = {
      version: '1.0.0',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 0, // Invalid
      repositoryPath: '/path/to/repo',
      lastIndexTime: new Date(),
      files: {},
      stats: {
        totalFiles: 0,
        totalDocuments: 0,
        totalVectors: 0,
      },
    };

    expect(() => assertIndexerState(invalid)).toThrow();
  });
});
