/**
 * Legacy JavaScript Example
 *
 * Demonstrates older patterns:
 * - CommonJS requires
 * - throw-based error handling
 * - No type annotations
 * - module.exports
 */

const crypto = require('node:crypto');
const fs = require('node:fs');

/**
 * Validate email address
 */
function validateEmail(email) {
  if (!email) {
    throw new Error('Email is required');
  }

  if (!email.includes('@')) {
    throw new Error('Invalid email format');
  }

  return true;
}

/**
 * Hash password using crypto
 */
function hashPassword(password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

  return { hash, salt };
}

/**
 * Read user data from file
 */
function readUserData(filePath) {
  if (!filePath) {
    throw new Error('File path is required');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Create user with validation
 */
function createUser(email, password, name) {
  validateEmail(email);

  if (!name) {
    throw new Error('Name is required');
  }

  const { hash, salt } = hashPassword(password);

  return {
    id: crypto.randomUUID(),
    email,
    name,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  validateEmail,
  hashPassword,
  readUserData,
  createUser,
};
