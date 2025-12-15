/**
 * Modern TypeScript fixture for adapter tests
 */

export interface User {
  id: string;
  name: string;
}

export function validateUser(data: unknown): User | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  return data as User;
}

export function createUser(name: string): User {
  return {
    id: Math.random().toString(36),
    name,
  };
}
