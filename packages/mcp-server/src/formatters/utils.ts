/**
 * Formatter Utilities
 * Token estimation and text processing utilities
 */

/**
 * Estimate tokens for text using a simple heuristic
 *
 * Rule of thumb: ~4 characters per token for English text
 * This is a conservative estimate (GPT-4 tokenization)
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokensForText(text: string): number {
  // Remove extra whitespace
  const normalized = text.trim().replace(/\s+/g, ' ');

  // Handle empty string
  if (normalized.length === 0) {
    return 0;
  }

  // Estimate: 4 characters per token (conservative for code/technical text)
  const charBasedEstimate = Math.ceil(normalized.length / 4);

  // Word-based estimate (fallback)
  const words = normalized.split(/\s+/).length;
  const wordBasedEstimate = Math.ceil(words * 1.3); // ~1.3 tokens per word

  // Use the higher estimate (more conservative)
  return Math.max(charBasedEstimate, wordBasedEstimate);
}

/**
 * Truncate text to fit within a token budget
 *
 * @param text - The text to truncate
 * @param tokenBudget - Maximum number of tokens
 * @returns Truncated text
 */
export function truncateToTokenBudget(text: string, tokenBudget: number): string {
  const currentTokens = estimateTokensForText(text);

  if (currentTokens <= tokenBudget) {
    return text;
  }

  // Calculate target character count (conservative)
  const targetChars = tokenBudget * 4;

  // Truncate and add ellipsis
  const truncated = text.slice(0, targetChars - 3);
  return `${truncated}...`;
}

/**
 * Estimate tokens for JSON object
 *
 * @param obj - The object to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokensForJSON(obj: unknown): number {
  const jsonString = JSON.stringify(obj);
  return estimateTokensForText(jsonString);
}
