/**
 * Tests for language utilities
 */

import { describe, expect, it } from 'vitest';
import {
  getExtensionForLanguage,
  getLanguageFromExtension,
  getSupportedLanguages,
  isLanguageSupported,
} from './language';

describe('Language Utilities', () => {
  describe('getExtensionForLanguage', () => {
    it('should return correct extension for TypeScript', () => {
      expect(getExtensionForLanguage('typescript')).toBe('ts');
    });

    it('should return correct extension for JavaScript', () => {
      expect(getExtensionForLanguage('javascript')).toBe('js');
    });

    it('should return correct extension for Python', () => {
      expect(getExtensionForLanguage('python')).toBe('py');
    });

    it('should return correct extension for Go', () => {
      expect(getExtensionForLanguage('go')).toBe('go');
    });

    it('should return correct extension for Rust', () => {
      expect(getExtensionForLanguage('rust')).toBe('rs');
    });

    it('should return correct extension for Markdown', () => {
      expect(getExtensionForLanguage('markdown')).toBe('md');
    });

    it('should be case-insensitive', () => {
      expect(getExtensionForLanguage('TypeScript')).toBe('ts');
      expect(getExtensionForLanguage('PYTHON')).toBe('py');
      expect(getExtensionForLanguage('JavaScript')).toBe('js');
    });

    it('should return the language itself for unknown languages', () => {
      expect(getExtensionForLanguage('cobol')).toBe('cobol');
      expect(getExtensionForLanguage('fortran')).toBe('fortran');
    });

    it('should handle empty string', () => {
      expect(getExtensionForLanguage('')).toBe('');
    });

    it('should handle mixed case unknown languages', () => {
      expect(getExtensionForLanguage('UnknownLang')).toBe('UnknownLang');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return array of supported languages', () => {
      const languages = getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
    });

    it('should include common languages', () => {
      const languages = getSupportedLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('go');
      expect(languages).toContain('rust');
      expect(languages).toContain('markdown');
    });

    it('should return consistent results', () => {
      const languages1 = getSupportedLanguages();
      const languages2 = getSupportedLanguages();
      expect(languages1).toEqual(languages2);
    });

    it('should return exactly 6 supported languages', () => {
      expect(getSupportedLanguages()).toHaveLength(6);
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('typescript')).toBe(true);
      expect(isLanguageSupported('javascript')).toBe(true);
      expect(isLanguageSupported('python')).toBe(true);
      expect(isLanguageSupported('go')).toBe(true);
      expect(isLanguageSupported('rust')).toBe(true);
      expect(isLanguageSupported('markdown')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('cobol')).toBe(false);
      expect(isLanguageSupported('fortran')).toBe(false);
      expect(isLanguageSupported('unknown')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isLanguageSupported('TypeScript')).toBe(true);
      expect(isLanguageSupported('PYTHON')).toBe(true);
      expect(isLanguageSupported('JavaScript')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isLanguageSupported('')).toBe(false);
    });

    it('should handle special characters', () => {
      expect(isLanguageSupported('type-script')).toBe(false);
      expect(isLanguageSupported('java script')).toBe(false);
    });
  });

  describe('getLanguageFromExtension', () => {
    it('should return correct language for TypeScript extensions', () => {
      expect(getLanguageFromExtension('.ts')).toBe('typescript');
      expect(getLanguageFromExtension('ts')).toBe('typescript');
    });

    it('should return correct language for JavaScript extensions', () => {
      expect(getLanguageFromExtension('.js')).toBe('javascript');
      expect(getLanguageFromExtension('js')).toBe('javascript');
    });

    it('should return correct language for Python extensions', () => {
      expect(getLanguageFromExtension('.py')).toBe('python');
      expect(getLanguageFromExtension('py')).toBe('python');
    });

    it('should return correct language for Go extensions', () => {
      expect(getLanguageFromExtension('.go')).toBe('go');
      expect(getLanguageFromExtension('go')).toBe('go');
    });

    it('should return correct language for Rust extensions', () => {
      expect(getLanguageFromExtension('.rs')).toBe('rust');
      expect(getLanguageFromExtension('rs')).toBe('rust');
    });

    it('should return correct language for Markdown extensions', () => {
      expect(getLanguageFromExtension('.md')).toBe('markdown');
      expect(getLanguageFromExtension('md')).toBe('markdown');
    });

    it('should return null for unknown extensions', () => {
      expect(getLanguageFromExtension('.xyz')).toBeNull();
      expect(getLanguageFromExtension('unknown')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(getLanguageFromExtension('')).toBeNull();
    });

    it('should handle extensions with multiple dots', () => {
      expect(getLanguageFromExtension('.test.ts')).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should round-trip language to extension and back', () => {
      const languages = getSupportedLanguages();

      for (const language of languages) {
        const ext = getExtensionForLanguage(language);
        const roundTrip = getLanguageFromExtension(ext);
        expect(roundTrip).toBe(language);
      }
    });

    it('should filter supported languages from a list', () => {
      const allLanguages = ['typescript', 'cobol', 'python', 'fortran', 'rust'];
      const supported = allLanguages.filter((lang) => isLanguageSupported(lang));

      expect(supported).toEqual(['typescript', 'python', 'rust']);
    });

    it('should map file paths to languages', () => {
      const files = ['app.ts', 'script.py', 'main.go', 'lib.rs', 'README.md', 'data.csv'];

      const languageMap = files.map((file) => {
        const ext = file.split('.').pop() || '';
        return {
          file,
          language: getLanguageFromExtension(ext),
        };
      });

      expect(languageMap[0].language).toBe('typescript');
      expect(languageMap[1].language).toBe('python');
      expect(languageMap[2].language).toBe('go');
      expect(languageMap[3].language).toBe('rust');
      expect(languageMap[4].language).toBe('markdown');
      expect(languageMap[5].language).toBeNull();
    });
  });
});
