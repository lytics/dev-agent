/**
 * Modern TypeScript Example
 *
 * Demonstrates best practices:
 * - ESM imports
 * - Result<T> error handling
 * - Full type annotations
 * - Explicit return types
 */

// Mock uuid for fixture purposes (not a real dependency)
const uuidv4 = () => '00000000-0000-0000-0000-000000000000';

import type { User, ValidationError } from './types';

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Validate user data
 */
export function validateUser(data: unknown): Result<User, ValidationError> {
  if (!data || typeof data !== 'object') {
    return {
      ok: false,
      error: { code: 'INVALID_DATA', message: 'Data must be an object' },
    };
  }

  const user = data as Partial<User>;

  if (!user.email || typeof user.email !== 'string') {
    return {
      ok: false,
      error: { code: 'INVALID_EMAIL', message: 'Email is required' },
    };
  }

  if (!user.name || typeof user.name !== 'string') {
    return {
      ok: false,
      error: { code: 'INVALID_NAME', message: 'Name is required' },
    };
  }

  return {
    ok: true,
    value: {
      id: uuidv4(),
      email: user.email,
      name: user.name,
      createdAt: new Date(),
    },
  };
}

/**
 * Create user with proper error handling
 */
export async function createUser(data: unknown): Promise<Result<User>> {
  const validation = validateUser(data);

  if (!validation.ok) {
    return validation;
  }

  // Simulate database call
  try {
    const user = validation.value;
    // await db.users.create(user);
    return { ok: true, value: user };
  } catch (_error) {
    return {
      ok: false,
      error: new Error('Failed to create user'),
    };
  }
}
