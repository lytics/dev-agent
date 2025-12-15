/**
 * Legacy JavaScript fixture for adapter tests
 */

const crypto = require('node:crypto');

function validateEmail(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email');
  }
  return true;
}

function createUser(name, email) {
  if (!name) {
    throw new Error('Name required');
  }
  validateEmail(email);

  return {
    id: crypto.randomUUID(),
    name,
    email,
  };
}

module.exports = {
  validateEmail,
  createUser,
};
