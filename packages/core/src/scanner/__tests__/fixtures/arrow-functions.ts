/**
 * Test fixtures for arrow function and function expression extraction.
 * This file contains various patterns that should be extracted by the scanner.
 */

// Simple arrow function
const simpleArrow = () => {
  return 'hello';
};

// Arrow function with parameters
const typedArrow = (name: string, age: number): string => {
  return `${name} is ${age} years old`;
};

// Exported arrow function
export const exportedArrow = (value: number) => value * 2;

// Non-exported (private) helper
const privateHelper = (x: number) => x + 1;

// React-style hook (name starts with 'use')
export const useCustomHook = (initialValue: string) => {
  const value = initialValue;
  const setValue = (newValue: string) => newValue;
  return { value, setValue };
};

// Async arrow function
export const fetchData = async (url: string) => {
  const response = await fetch(url);
  return response.json();
};

// Function expression (legacy style)
// biome-ignore lint/complexity/useArrowFunction: Testing function expression extraction
const legacyFunction = function (a: number, b: number) {
  return a + b;
};

// Arrow function that calls other functions (for callee extraction)
const composedFunction = (input: string) => {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  return privateHelper(upper.length);
};

/**
 * A well-documented arrow function.
 * This should have its JSDoc extracted.
 */
const documentedArrow = (param: string) => {
  return param.toLowerCase();
};

// These should NOT be extracted (not function-valued):
// biome-ignore lint/correctness/noUnusedVariables: Test fixtures for non-extraction

// Plain constant (primitive)
const plainConstant = 42;

// Object constant
const configObject = {
  apiUrl: '/api',
  timeout: 5000,
};

// Array constant
const colorList = ['red', 'green', 'blue'];

// Suppress unused warnings - these are test fixtures
void plainConstant;
void configObject;
void colorList;

// String constant
export const API_ENDPOINT = 'https://api.example.com';

// Re-exported for testing
export { simpleArrow, typedArrow, composedFunction, documentedArrow, legacyFunction };
