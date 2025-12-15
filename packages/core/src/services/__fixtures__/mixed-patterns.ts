/**
 * Mixed Patterns Example
 *
 * Demonstrates inconsistent patterns (what we want to detect):
 * - Mixed ESM and CJS (ESM imports but still some requires)
 * - Mixed error handling (both throw and Result<T>)
 * - Partial type annotations
 */

import type { User } from './types';

const fs = require('node:fs'); // CJS require mixed with ESM!

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Load config from file - uses throw
 */
export function loadConfig(filePath) {
  // Missing types!
  if (!filePath) {
    throw new Error('File path required'); // Uses throw
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Validate user - uses Result<T>
 */
export function validateUser(data: unknown): Result<User> {
  // Has types
  if (!data) {
    return { ok: false, error: new Error('Invalid data') }; // Uses Result
  }

  return { ok: true, value: data as User };
}

/**
 * Process data - missing return type
 */
export async function processData(input: string) {
  // Missing return type!
  if (!input) {
    throw new Error('Input required'); // Back to throw
  }

  return input.toUpperCase();
}

/**
 * Helper with full types
 */
export function formatName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}
