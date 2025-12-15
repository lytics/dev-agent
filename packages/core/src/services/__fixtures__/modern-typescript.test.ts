/**
 * Tests for modern-typescript.ts
 *
 * Demonstrates test file detection
 */

import { describe, expect, it } from 'vitest';
import { createUser, validateUser } from './modern-typescript';

describe('validateUser', () => {
  it('should validate correct user data', () => {
    const result = validateUser({
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('test@example.com');
      expect(result.value.name).toBe('Test User');
    }
  });

  it('should reject invalid email', () => {
    const result = validateUser({
      email: '',
      name: 'Test User',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_EMAIL');
    }
  });

  it('should reject missing name', () => {
    const result = validateUser({
      email: 'test@example.com',
      name: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_NAME');
    }
  });
});

describe('createUser', () => {
  it('should create user with valid data', async () => {
    const result = await createUser({
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeDefined();
      expect(result.value.email).toBe('test@example.com');
    }
  });
});
