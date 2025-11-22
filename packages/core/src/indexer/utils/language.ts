/**
 * Language Utilities
 * Functions for language and file extension mapping
 */

/**
 * Language to file extension mapping
 */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  go: 'go',
  rust: 'rs',
  markdown: 'md',
};

/**
 * Get file extension for a given language
 *
 * @param language - Programming language name
 * @returns File extension (without dot)
 *
 * @example
 * ```typescript
 * getExtensionForLanguage('typescript'); // 'ts'
 * getExtensionForLanguage('python');     // 'py'
 * getExtensionForLanguage('unknown');    // 'unknown'
 * ```
 */
export function getExtensionForLanguage(language: string): string {
  return LANGUAGE_EXTENSIONS[language.toLowerCase()] || language;
}

/**
 * Get supported languages
 *
 * @returns Array of supported language names
 *
 * @example
 * ```typescript
 * const languages = getSupportedLanguages();
 * // ['typescript', 'javascript', 'python', 'go', 'rust', 'markdown']
 * ```
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_EXTENSIONS);
}

/**
 * Check if a language is supported
 *
 * @param language - Programming language name
 * @returns True if language is supported
 *
 * @example
 * ```typescript
 * isLanguageSupported('typescript'); // true
 * isLanguageSupported('cobol');      // false
 * ```
 */
export function isLanguageSupported(language: string): boolean {
  return language.toLowerCase() in LANGUAGE_EXTENSIONS;
}

/**
 * Get language from file extension
 *
 * @param extension - File extension (with or without dot)
 * @returns Language name or null if not found
 *
 * @example
 * ```typescript
 * getLanguageFromExtension('.ts');  // 'typescript'
 * getLanguageFromExtension('py');   // 'python'
 * getLanguageFromExtension('.xyz'); // null
 * ```
 */
export function getLanguageFromExtension(extension: string): string | null {
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  const entry = Object.entries(LANGUAGE_EXTENSIONS).find(([, value]) => value === ext);
  return entry ? entry[0] : null;
}
