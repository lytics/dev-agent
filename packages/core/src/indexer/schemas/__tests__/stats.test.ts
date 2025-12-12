/**
 * Tests for indexer statistics schemas
 */

import { describe, expect, it } from 'vitest';
import {
  DetailedIndexStatsSchema,
  FileMetadataSchema,
  IndexErrorSchema,
  IndexerStateSchema,
  IndexStatsSchema,
  LanguageStatsSchema,
  PackageStatsSchema,
  StatsMetadataSchema,
} from '../stats';

describe('LanguageStatsSchema', () => {
  it('should validate valid language stats', () => {
    const valid = {
      files: 10,
      components: 100,
      lines: 5000,
    };

    const result = LanguageStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it('should validate language stats with change frequency', () => {
    const valid = {
      files: 10,
      components: 100,
      lines: 5000,
      avgCommitsPerFile: 5.5,
      lastModified: new Date('2024-01-01'),
    };

    const result = LanguageStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avgCommitsPerFile).toBe(5.5);
      expect(result.data.lastModified).toBeInstanceOf(Date);
    }
  });

  it('should reject negative numbers', () => {
    const invalid = {
      files: -1,
      components: 100,
      lines: 5000,
    };

    const result = LanguageStatsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject decimal numbers', () => {
    const invalid = {
      files: 10.5,
      components: 100,
      lines: 5000,
    };

    const result = LanguageStatsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const invalid = {
      files: 10,
      components: 100,
      // missing lines
    };

    const result = LanguageStatsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('PackageStatsSchema', () => {
  it('should validate valid package stats', () => {
    const valid = {
      name: '@my/package',
      path: 'packages/my-package',
      files: 50,
      components: 200,
      languages: {
        typescript: 180,
        javascript: 20,
      },
    };

    const result = PackageStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('@my/package');
      expect(result.data.languages?.typescript).toBe(180);
    }
  });

  it('should validate package stats with change frequency', () => {
    const valid = {
      name: '@my/package',
      path: 'packages/my-package',
      files: 50,
      components: 200,
      languages: {},
      totalCommits: 125,
      lastModified: new Date('2024-01-15'),
    };

    const result = PackageStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCommits).toBe(125);
      expect(result.data.lastModified).toBeInstanceOf(Date);
    }
  });

  it('should require languages field (can be empty)', () => {
    const valid = {
      name: '@my/package',
      path: 'packages/my-package',
      files: 50,
      components: 200,
      languages: {},
    };

    const result = PackageStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const invalid = {
      name: '',
      path: 'packages/my-package',
      files: 50,
      components: 200,
    };

    const result = PackageStatsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('StatsMetadataSchema', () => {
  it('should validate valid stats metadata', () => {
    const valid = {
      isIncremental: false,
      lastFullIndex: new Date('2024-01-01'),
      lastUpdate: new Date('2024-01-02'),
      incrementalUpdatesSince: 0,
    };

    const result = StatsMetadataSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isIncremental).toBe(false);
      expect(result.data.lastFullIndex).toBeInstanceOf(Date);
    }
  });

  it('should coerce date strings to Date objects', () => {
    const valid = {
      isIncremental: true,
      lastFullIndex: '2024-01-01T00:00:00Z',
      lastUpdate: '2024-01-02T00:00:00Z',
      incrementalUpdatesSince: 3,
      affectedLanguages: ['typescript', 'javascript'],
    };

    const result = StatsMetadataSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastFullIndex).toBeInstanceOf(Date);
      expect(result.data.lastUpdate).toBeInstanceOf(Date);
      expect(result.data.affectedLanguages).toEqual(['typescript', 'javascript']);
    }
  });

  it('should allow optional warning field', () => {
    const valid = {
      isIncremental: false,
      lastFullIndex: new Date(),
      lastUpdate: new Date(),
      incrementalUpdatesSince: 0,
      warning: 'Stats may be stale',
    };

    const result = StatsMetadataSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warning).toBe('Stats may be stale');
    }
  });
});

describe('IndexErrorSchema', () => {
  it('should validate valid index error', () => {
    const valid = {
      type: 'scanner',
      file: 'src/test.ts',
      message: 'Parse error',
      timestamp: new Date(),
    };

    const result = IndexErrorSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all error types', () => {
    const types = ['scanner', 'embedder', 'storage', 'filesystem'] as const;

    for (const type of types) {
      const error = {
        type,
        message: 'Error occurred',
        timestamp: new Date(),
      };

      const result = IndexErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid error types', () => {
    const invalid = {
      type: 'unknown',
      message: 'Error occurred',
      timestamp: new Date(),
    };

    const result = IndexErrorSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should allow optional file field', () => {
    const valid = {
      type: 'storage',
      message: 'Storage error',
      timestamp: new Date(),
    };

    const result = IndexErrorSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('IndexStatsSchema', () => {
  it('should validate valid index stats', () => {
    const valid = {
      filesScanned: 100,
      documentsExtracted: 500,
      documentsIndexed: 500,
      vectorsStored: 500,
      duration: 5000,
      errors: [],
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-01T00:01:00Z'),
      repositoryPath: '/path/to/repo',
    };

    const result = IndexStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filesScanned).toBe(100);
      expect(result.data.duration).toBe(5000);
    }
  });

  it('should validate with stats metadata', () => {
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
      statsMetadata: {
        isIncremental: false,
        lastFullIndex: new Date(),
        lastUpdate: new Date(),
        incrementalUpdatesSince: 0,
      },
    };

    const result = IndexStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.statsMetadata).toBeDefined();
      expect(result.data.statsMetadata?.isIncremental).toBe(false);
    }
  });

  it('should validate with errors', () => {
    const valid = {
      filesScanned: 100,
      documentsExtracted: 498,
      documentsIndexed: 498,
      vectorsStored: 498,
      duration: 5000,
      errors: [
        {
          type: 'scanner',
          file: 'bad.ts',
          message: 'Parse error',
          timestamp: new Date(),
        },
        {
          type: 'embedder',
          message: 'Embedding failed',
          timestamp: new Date(),
        },
      ],
      startTime: new Date(),
      endTime: new Date(),
      repositoryPath: '/path/to/repo',
    };

    const result = IndexStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors).toHaveLength(2);
      expect(result.data.errors[0].type).toBe('scanner');
    }
  });
});

describe('DetailedIndexStatsSchema', () => {
  it('should validate detailed stats with all breakdowns', () => {
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
        javascript: { files: 20, components: 100, lines: 2000 },
      },
      byComponentType: {
        function: 200,
        class: 50,
        interface: 100,
      },
      byPackage: {
        'packages/core': {
          name: '@my/core',
          path: 'packages/core',
          files: 50,
          components: 250,
          languages: {
            typescript: 250,
          },
        },
      },
    };

    const result = DetailedIndexStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.byLanguage?.typescript.files).toBe(80);
      expect(result.data.byComponentType?.function).toBe(200);
      expect(result.data.byPackage?.['packages/core'].name).toBe('@my/core');
    }
  });

  it('should allow optional detail fields', () => {
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

    const result = DetailedIndexStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('FileMetadataSchema', () => {
  it('should validate valid file metadata', () => {
    const valid = {
      path: 'src/index.ts',
      hash: 'abc123',
      lastModified: new Date('2024-01-01'),
      lastIndexed: new Date('2024-01-02'),
      documentIds: ['doc1', 'doc2'],
      size: 1024,
      language: 'typescript',
    };

    const result = FileMetadataSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.path).toBe('src/index.ts');
      expect(result.data.documentIds).toHaveLength(2);
    }
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

    const result = FileMetadataSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastModified).toBeInstanceOf(Date);
      expect(result.data.lastIndexed).toBeInstanceOf(Date);
    }
  });

  it('should reject negative size', () => {
    const invalid = {
      path: 'src/index.ts',
      hash: 'abc123',
      lastModified: new Date(),
      lastIndexed: new Date(),
      documentIds: [],
      size: -1,
      language: 'typescript',
    };

    const result = FileMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('IndexerStateSchema', () => {
  it('should validate valid indexer state', () => {
    const valid = {
      version: '1.0.0',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 384,
      repositoryPath: '/path/to/repo',
      lastIndexTime: new Date('2024-01-01'),
      files: {
        'src/index.ts': {
          path: 'src/index.ts',
          hash: 'abc123',
          lastModified: new Date('2024-01-01'),
          lastIndexed: new Date('2024-01-01'),
          documentIds: ['doc1'],
          size: 1024,
          language: 'typescript',
        },
      },
      stats: {
        totalFiles: 1,
        totalDocuments: 1,
        totalVectors: 1,
      },
    };

    const result = IndexerStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0.0');
      expect(result.data.embeddingDimension).toBe(384);
      expect(Object.keys(result.data.files)).toHaveLength(1);
    }
  });

  it('should validate with detailed stats', () => {
    const valid = {
      version: '1.0.0',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 384,
      repositoryPath: '/path/to/repo',
      lastIndexTime: new Date(),
      files: {},
      stats: {
        totalFiles: 10,
        totalDocuments: 100,
        totalVectors: 100,
        byLanguage: {
          typescript: { files: 10, components: 100, lines: 5000 },
        },
        byComponentType: {
          function: 50,
          class: 25,
        },
      },
    };

    const result = IndexerStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats.byLanguage?.typescript.files).toBe(10);
      expect(result.data.stats.byComponentType?.function).toBe(50);
    }
  });

  it('should validate with incremental updates', () => {
    const valid = {
      version: '1.0.0',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 384,
      repositoryPath: '/path/to/repo',
      lastIndexTime: new Date('2024-01-01'),
      lastUpdate: new Date('2024-01-02'),
      incrementalUpdatesSince: 3,
      files: {},
      stats: {
        totalFiles: 10,
        totalDocuments: 100,
        totalVectors: 100,
      },
    };

    const result = IndexerStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.incrementalUpdatesSince).toBe(3);
      expect(result.data.lastUpdate).toBeInstanceOf(Date);
    }
  });

  it('should reject invalid embedding dimension', () => {
    const invalid = {
      version: '1.0.0',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 0, // Must be positive
      repositoryPath: '/path/to/repo',
      lastIndexTime: new Date(),
      files: {},
      stats: {
        totalFiles: 0,
        totalDocuments: 0,
        totalVectors: 0,
      },
    };

    const result = IndexerStateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
