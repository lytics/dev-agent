/**
 * Explorer Utilities
 *
 * Organized by domain for better maintainability and tree-shaking.
 *
 * @module explorer/utils
 */

// Code analysis
export { calculateCoverage, getCommonPatterns, sortAndLimitPatterns } from './analysis';

// Result filtering
export { isNotReferenceFile, matchesFileType } from './filters';
// Metadata extraction
export { extractFilePath, extractMetadata, type ResultMetadata } from './metadata';
// Relationship management
export { createRelationship, isDuplicateRelationship } from './relationships';
