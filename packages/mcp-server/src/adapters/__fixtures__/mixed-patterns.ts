/**
 * Mixed patterns fixture - intentional inconsistencies
 */

const fs = require('node:fs'); // CJS require in TS file

export interface Data {
  value: string;
}

// Missing return type
export function loadData(path) {
  if (!path) {
    throw new Error('Path required'); // Uses throw
  }
  return fs.readFileSync(path, 'utf-8');
}

// Has return type
export function processData(input: string): Data {
  if (!input) {
    return { value: '' }; // Different error style
  }
  return { value: input.toUpperCase() };
}
