/**
 * Issue Parsing Utilities
 * Pure functions for parsing GitHub issue content
 */

/**
 * Extract acceptance criteria from issue body
 * Looks for patterns like:
 * - [ ] Item
 * ## Acceptance Criteria
 */
export function extractAcceptanceCriteria(body: string): string[] {
  const criteria: string[] = [];

  // Look for "Acceptance Criteria" section
  const acMatch = body.match(/##\s*Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (acMatch) {
    const section = acMatch[1];
    const checkboxes = section.match(/- \[ \] (.+)/g);
    if (checkboxes) {
      criteria.push(...checkboxes.map((c) => c.replace('- [ ] ', '').trim()));
    }
  }

  // Also look for standalone checkboxes
  const allCheckboxes = body.match(/- \[ \] (.+)/g);
  if (allCheckboxes && criteria.length === 0) {
    criteria.push(...allCheckboxes.map((c) => c.replace('- [ ] ', '').trim()));
  }

  return criteria;
}

/**
 * Extract technical requirements from issue body
 */
export function extractTechnicalRequirements(body: string): string[] {
  const requirements: string[] = [];

  const techMatch = body.match(/##\s*Technical Requirements\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (techMatch) {
    const section = techMatch[1];
    const lines = section.split('\n').filter((line) => line.trim().startsWith('-'));
    requirements.push(...lines.map((line) => line.replace(/^-\s*/, '').trim()));
  }

  return requirements;
}

/**
 * Infer priority from labels
 */
export function inferPriority(labels: string[]): 'low' | 'medium' | 'high' {
  const lowerLabels = labels.map((l) => l.toLowerCase());

  if (lowerLabels.some((l) => l.includes('critical') || l.includes('urgent'))) {
    return 'high';
  }
  if (lowerLabels.some((l) => l.includes('high'))) {
    return 'high';
  }
  if (lowerLabels.some((l) => l.includes('low'))) {
    return 'low';
  }

  return 'medium';
}

/**
 * Extract estimate from issue body or title
 * Looks for patterns like "2 days", "3h", "1 week"
 */
export function extractEstimate(text: string): string | null {
  const patterns = [/(\d+)\s*(day|days|d)/i, /(\d+)\s*(hour|hours|h)/i, /(\d+)\s*(week|weeks|w)/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

/**
 * Clean and normalize issue description
 * Removes HTML comments, excessive whitespace, etc.
 */
export function cleanDescription(body: string): string {
  let cleaned = body;

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim
  cleaned = cleaned.trim();

  return cleaned;
}
