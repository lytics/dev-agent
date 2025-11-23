/**
 * Tests for Issue Parsing Utilities
 */

import { describe, expect, it } from 'vitest';
import {
  cleanDescription,
  extractAcceptanceCriteria,
  extractEstimate,
  extractTechnicalRequirements,
  inferPriority,
} from './parsing';

describe('extractAcceptanceCriteria', () => {
  it('should extract criteria from Acceptance Criteria section', () => {
    const body = `
## Description
Some description

## Acceptance Criteria
- [ ] Feature works
- [ ] Tests pass
- [ ] Documentation updated

## Other Section
Content
`;
    const criteria = extractAcceptanceCriteria(body);
    expect(criteria).toEqual(['Feature works', 'Tests pass', 'Documentation updated']);
  });

  it('should handle case-insensitive section header', () => {
    const body = `
## acceptance criteria
- [ ] Item 1
- [ ] Item 2
`;
    const criteria = extractAcceptanceCriteria(body);
    expect(criteria).toEqual(['Item 1', 'Item 2']);
  });

  it('should extract standalone checkboxes when no section exists', () => {
    const body = `
Description here

- [ ] Task 1
- [ ] Task 2
`;
    const criteria = extractAcceptanceCriteria(body);
    expect(criteria).toEqual(['Task 1', 'Task 2']);
  });

  it('should return empty array when no criteria found', () => {
    const body = 'Just some text without checkboxes';
    const criteria = extractAcceptanceCriteria(body);
    expect(criteria).toEqual([]);
  });

  it('should handle multiple sections and take from Acceptance Criteria', () => {
    const body = `
## Acceptance Criteria
- [ ] AC 1
- [ ] AC 2

## Tasks
- [ ] Task 1
`;
    const criteria = extractAcceptanceCriteria(body);
    expect(criteria).toEqual(['AC 1', 'AC 2']);
  });

  it('should trim whitespace from criteria', () => {
    const body = `
## Acceptance Criteria
- [ ]   Criterion with spaces   
- [ ] Normal criterion
`;
    const criteria = extractAcceptanceCriteria(body);
    expect(criteria).toEqual(['Criterion with spaces', 'Normal criterion']);
  });
});

describe('extractTechnicalRequirements', () => {
  it('should extract requirements from Technical Requirements section', () => {
    const body = `
## Technical Requirements
- Use TypeScript
- Add tests
- Follow style guide

## Other
Content
`;
    const reqs = extractTechnicalRequirements(body);
    expect(reqs).toEqual(['Use TypeScript', 'Add tests', 'Follow style guide']);
  });

  it('should handle case-insensitive section header', () => {
    const body = `
## technical requirements
- Requirement 1
- Requirement 2
`;
    const reqs = extractTechnicalRequirements(body);
    expect(reqs).toEqual(['Requirement 1', 'Requirement 2']);
  });

  it('should return empty array when no section found', () => {
    const body = 'No technical requirements here';
    const reqs = extractTechnicalRequirements(body);
    expect(reqs).toEqual([]);
  });

  it('should handle empty section', () => {
    const body = `
## Technical Requirements

## Next Section
`;
    const reqs = extractTechnicalRequirements(body);
    expect(reqs).toEqual([]);
  });

  it('should trim whitespace from requirements', () => {
    const body = `
## Technical Requirements
-   Requirement with spaces   
- Normal requirement
`;
    const reqs = extractTechnicalRequirements(body);
    expect(reqs).toEqual(['Requirement with spaces', 'Normal requirement']);
  });
});

describe('inferPriority', () => {
  it('should return high for critical labels', () => {
    expect(inferPriority(['critical'])).toBe('high');
    expect(inferPriority(['urgent'])).toBe('high');
    expect(inferPriority(['CRITICAL'])).toBe('high');
  });

  it('should return high for high priority labels', () => {
    expect(inferPriority(['high'])).toBe('high');
    expect(inferPriority(['priority: high'])).toBe('high');
    expect(inferPriority(['HIGH'])).toBe('high');
  });

  it('should return low for low priority labels', () => {
    expect(inferPriority(['low'])).toBe('low');
    expect(inferPriority(['priority: low'])).toBe('low');
    expect(inferPriority(['LOW'])).toBe('low');
  });

  it('should return medium by default', () => {
    expect(inferPriority([])).toBe('medium');
    expect(inferPriority(['feature'])).toBe('medium');
    expect(inferPriority(['bug'])).toBe('medium');
  });

  it('should prioritize critical over high', () => {
    expect(inferPriority(['high', 'critical'])).toBe('high');
  });

  it('should prioritize high over low', () => {
    expect(inferPriority(['low', 'high'])).toBe('high');
  });
});

describe('extractEstimate', () => {
  it('should extract day estimates', () => {
    expect(extractEstimate('This will take 3 days')).toBe('3 days');
    expect(extractEstimate('Estimate: 1 day')).toBe('1 day');
    expect(extractEstimate('5d to complete')).toBe('5d');
  });

  it('should extract hour estimates', () => {
    expect(extractEstimate('About 4 hours')).toBe('4 hours');
    expect(extractEstimate('2h work')).toBe('2h');
    expect(extractEstimate('10 hour task')).toBe('10 hour');
  });

  it('should extract week estimates', () => {
    expect(extractEstimate('2 weeks required')).toBe('2 weeks');
    expect(extractEstimate('1w sprint')).toBe('1w');
    expect(extractEstimate('3 week project')).toBe('3 week');
  });

  it('should return null when no estimate found', () => {
    expect(extractEstimate('No estimate here')).toBeNull();
    expect(extractEstimate('Some random text')).toBeNull();
  });

  it('should handle case-insensitive matching', () => {
    expect(extractEstimate('3 DAYS')).toBe('3 DAYS');
    expect(extractEstimate('2 Hours')).toBe('2 Hours');
  });

  it('should return first match when multiple exist', () => {
    expect(extractEstimate('2 days or maybe 3 weeks')).toBe('2 days');
  });
});

describe('cleanDescription', () => {
  it('should remove HTML comments', () => {
    const body = 'Text <!-- comment --> more text';
    expect(cleanDescription(body)).toBe('Text  more text');
  });

  it('should remove multiline HTML comments', () => {
    const body = `Text
<!-- 
multiline
comment
-->
more text`;
    expect(cleanDescription(body)).toBe('Text\n\nmore text');
  });

  it('should remove excessive newlines', () => {
    const body = 'Line 1\n\n\n\nLine 2';
    expect(cleanDescription(body)).toBe('Line 1\n\nLine 2');
  });

  it('should trim whitespace', () => {
    const body = '  \n\n  Text  \n\n  ';
    expect(cleanDescription(body)).toBe('Text');
  });

  it('should handle empty input', () => {
    expect(cleanDescription('')).toBe('');
    expect(cleanDescription('   \n\n   ')).toBe('');
  });

  it('should handle text without issues', () => {
    const body = 'Clean text\n\nWith paragraphs';
    expect(cleanDescription(body)).toBe('Clean text\n\nWith paragraphs');
  });

  it('should handle multiple HTML comments', () => {
    const body = '<!-- c1 --> Text <!-- c2 --> More <!-- c3 -->';
    expect(cleanDescription(body)).toBe('Text  More');
  });
});
