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

// ============================================
// EXPORTED CONSTANTS - Should be extracted
// ============================================

/**
 * API configuration object.
 * This should be extracted as an exported constant.
 */
export const API_CONFIG = {
  baseUrl: '/api',
  timeout: 5000,
  retries: 3,
};

// Exported array constant
export const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python', 'go'];

// Exported call expression (factory pattern)
export const AppContext = (() => ({ value: null }))();

// Typed exported constant
export const THEME_CONFIG: { dark: boolean; primary: string } = {
  dark: false,
  primary: '#007bff',
};

// ============================================
// NON-EXPORTED - Should NOT be extracted
// ============================================

// Plain constant (primitive) - never extracted
const plainConstant = 42;

// Non-exported object - not extracted (only exported objects are extracted)
const configObject = {
  apiUrl: '/api',
  timeout: 5000,
};

// Non-exported array - not extracted
const colorList = ['red', 'green', 'blue'];

// Suppress unused warnings - these are test fixtures
void plainConstant;
void configObject;
void colorList;

// Exported primitive - NOT extracted (primitives have low semantic value)
export const API_ENDPOINT = 'https://api.example.com';

// Re-exported for testing
export { simpleArrow, typedArrow, composedFunction, documentedArrow, legacyFunction };
