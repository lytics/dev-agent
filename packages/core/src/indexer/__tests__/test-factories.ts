/**
 * Test factories for creating test data
 * Promotes DRY principles and makes tests more readable
 */

import type {
  DetailedIndexStats,
  FileMetadata,
  LanguageStats,
  StatsMetadata,
  SupportedLanguage,
} from '../types';

/**
 * Create language stats for testing
 */
export function createLanguageStats(overrides: Partial<LanguageStats> = {}): LanguageStats {
  return {
    files: 1,
    components: 5,
    lines: 100,
    ...overrides,
  };
}

/**
 * Create file metadata for testing
 */
export function createFileMetadata(overrides: Partial<FileMetadata> = {}): FileMetadata {
  return {
    path: 'src/test.ts',
    hash: 'abc123',
    lastModified: new Date(),
    lastIndexed: new Date(),
    documentIds: ['doc1', 'doc2'],
    size: 1024,
    language: 'typescript',
    ...overrides,
  };
}

/**
 * Create stats metadata for testing
 */
export function createStatsMetadata(overrides: Partial<StatsMetadata> = {}): StatsMetadata {
  const now = new Date();
  return {
    isIncremental: false,
    lastFullIndex: now,
    lastUpdate: now,
    incrementalUpdatesSince: 0,
    ...overrides,
  };
}

/**
 * Create detailed index stats for testing
 */
export function createDetailedIndexStats(
  overrides: Partial<DetailedIndexStats> = {}
): DetailedIndexStats {
  const now = new Date();
  return {
    filesScanned: 10,
    documentsExtracted: 50,
    documentsIndexed: 50,
    vectorsStored: 50,
    duration: 5000,
    errors: [],
    startTime: now,
    endTime: now,
    repositoryPath: '/test/repo',
    byLanguage: {
      typescript: createLanguageStats(),
    },
    byComponentType: {
      function: 30,
      class: 15,
      interface: 5,
    },
    statsMetadata: createStatsMetadata(),
    ...overrides,
  };
}

/**
 * Create a map of language stats by language
 */
export function createLanguageStatsMap(
  languages: Array<{ lang: SupportedLanguage; stats?: Partial<LanguageStats> }>
): Partial<Record<SupportedLanguage, LanguageStats>> {
  const result: Partial<Record<SupportedLanguage, LanguageStats>> = {};
  for (const { lang, stats } of languages) {
    result[lang] = createLanguageStats(stats);
  }
  return result;
}
