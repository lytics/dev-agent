# Planner Subagent

Strategic planning agent that analyzes GitHub issues and generates actionable development plans.

## Features

- **GitHub Integration**: Fetches issues via `gh` CLI
- **Smart Breakdown**: Converts issues into concrete, executable tasks
- **Effort Estimation**: Automatic time estimates based on task type
- **Code Discovery**: Optionally finds relevant code using Explorer
- **Multiple Formats**: JSON, Markdown, or pretty terminal output

## Quick Start

### CLI Usage

```bash
# Generate plan from GitHub issue
dev plan 123

# Options
dev plan 123 --json              # JSON output
dev plan 123 --markdown          # Markdown format
dev plan 123 --simple            # High-level (4-8 tasks)
dev plan 123 --no-explorer       # Skip code search
```

### Agent Usage (Coordinator)

```typescript
import { SubagentCoordinator, PlannerAgent } from '@lytics/dev-agent-subagents';

const coordinator = new SubagentCoordinator();

// Register Planner
const planner = new PlannerAgent();
await coordinator.registerAgent(planner);

// Create a plan
const plan = await coordinator.executeTask({
  id: 'plan-1',
  type: 'analysis',
  description: 'Generate plan for issue #123',
  agent: 'planner',
  payload: {
    action: 'plan',
    issueNumber: 123,
    useExplorer: true,
    detailLevel: 'detailed',
  },
});

console.log(plan.result);
```

## API Reference

### PlanningRequest

```typescript
{
  action: 'plan';
  issueNumber: number;        // GitHub issue number
  useExplorer?: boolean;      // Find relevant code (default: true)
  detailLevel?: 'simple' | 'detailed';  // Task granularity
  strategy?: 'sequential' | 'parallel';  // Execution strategy
}
```

### PlanningResult

```typescript
{
  action: 'plan';
  plan: {
    issueNumber: number;
    title: string;
    description: string;
    tasks: Array<{
      id: string;
      description: string;
      relevantCode: Array<{
        path: string;
        reason: string;
        score: number;
      }>;
      estimatedHours: number;
      priority: 'low' | 'medium' | 'high';
      phase?: string;
    }>;
    totalEstimate: string;  // Human-readable (e.g. "2 days", "1 week")
    priority: 'low' | 'medium' | 'high';
    metadata: {
      generatedAt: string;
      explorerUsed: boolean;
      strategy: string;
    };
  };
}
```

## Planner Utilities

The Planner package exports pure utility functions for custom workflows:

### GitHub Utilities

```typescript
import { fetchGitHubIssue, isGhInstalled, isGitHubRepo } from '@lytics/dev-agent-subagents';

// Check prerequisites
if (!isGhInstalled()) {
  throw new Error('gh CLI not installed');
}

if (!isGitHubRepo()) {
  throw new Error('Not a GitHub repository');
}

// Fetch issue
const issue = await fetchGitHubIssue(123);
console.log(issue.title, issue.body, issue.labels);
```

### Parsing Utilities

```typescript
import {
  extractAcceptanceCriteria,
  extractTechnicalRequirements,
  inferPriority,
  cleanDescription,
} from '@lytics/dev-agent-subagents';

const criteria = extractAcceptanceCriteria(issue.body);
// ['User can log in', 'Password is validated']

const technicalReqs = extractTechnicalRequirements(issue.body);
// ['Use bcrypt for hashing', 'Rate limit login attempts']

const priority = inferPriority(issue.labels);
// 'high' | 'medium' | 'low'

const cleanDesc = cleanDescription(issue.body);
// Removes headers, lists, and metadata
```

### Task Breakdown

```typescript
import { breakdownIssue, groupTasksByPhase, validateTasks } from '@lytics/dev-agent-subagents';

// Break issue into tasks
const tasks = breakdownIssue(issue, acceptanceCriteria, {
  detailLevel: 'simple',
  maxTasks: 8,
  includeEstimates: false,
});

// Group by phase
const phased = groupTasksByPhase(tasks);
// { design: [...], implementation: [...], testing: [...] }

// Validate
const issues = validateTasks(tasks);
if (issues.length > 0) {
  console.warn('Task validation issues:', issues);
}
```

### Effort Estimation

```typescript
import {
  estimateTaskHours,
  addEstimatesToTasks,
  calculateTotalEstimate,
  formatEstimate,
} from '@lytics/dev-agent-subagents';

// Estimate single task
const hours = estimateTaskHours('Write unit tests');
// 3

// Add estimates to all tasks
const tasksWithEstimates = addEstimatesToTasks(tasks);

// Calculate total
const total = calculateTotalEstimate(tasksWithEstimates);
// "2 days"

// Format hours
formatEstimate(16);  // "2 days"
formatEstimate(45);  // "2 weeks"
```

### Output Formatting

```typescript
import { formatPretty, formatJSON, formatMarkdown } from '@lytics/dev-agent-subagents';

// Terminal output (with colors)
console.log(formatPretty(plan));

// JSON for tools
const json = formatJSON(plan);

// Markdown for GitHub
const markdown = formatMarkdown(plan);
```

## Coordinator Integration

### Basic Integration

```typescript
import { SubagentCoordinator, PlannerAgent, ExplorerAgent } from '@lytics/dev-agent-subagents';
import { RepositoryIndexer } from '@lytics/dev-agent-core';

// Setup
const coordinator = new SubagentCoordinator();
const indexer = new RepositoryIndexer(config);
await indexer.initialize();

// Register agents
const planner = new PlannerAgent();
const explorer = new ExplorerAgent(indexer);

await coordinator.registerAgent(planner);
await coordinator.registerAgent(explorer);

// Generate plan with code discovery
const result = await coordinator.executeTask({
  id: 'plan-issue-123',
  type: 'analysis',
  description: 'Plan issue #123',
  agent: 'planner',
  payload: {
    action: 'plan',
    issueNumber: 123,
    useExplorer: true,
    detailLevel: 'detailed',
  },
});
```

### Multi-Agent Workflow

```typescript
// 1. Plan the work
const planTask = await coordinator.executeTask({
  id: 'plan-1',
  type: 'analysis',
  agent: 'planner',
  payload: {
    action: 'plan',
    issueNumber: 123,
  },
});

const plan = planTask.result.plan;

// 2. Explore relevant code for each task
for (const task of plan.tasks) {
  const exploreTask = await coordinator.executeTask({
    id: `explore-${task.id}`,
    type: 'analysis',
    agent: 'explorer',
    payload: {
      action: 'similar',
      query: task.description,
      limit: 5,
    },
  });

  console.log(`Task ${task.id}: Found ${exploreTask.result.results.length} similar patterns`);
}

// 3. Generate PR checklist
const checklist = plan.tasks.map((task) => `- [ ] ${task.description}`).join('\n');

console.log('PR Checklist:');
console.log(checklist);
```

### Health Monitoring

```typescript
// Check Planner health
const healthy = await planner.healthCheck();

if (!healthy) {
  console.error('Planner is not initialized');
}

// Get Coordinator stats
const stats = coordinator.getStats();
console.log(`Tasks completed: ${stats.tasksCompleted}`);
console.log(`Planner status: ${stats.agents.planner?.healthy ? 'healthy' : 'unhealthy'}`);
```

### Graceful Shutdown

```typescript
// Shutdown all agents
await coordinator.shutdown();

// Or shutdown individually
await planner.shutdown();
```

## Task Estimation Heuristics

The Planner uses heuristics to estimate effort:

| Task Type | Estimated Hours |
|-----------|----------------|
| Documentation | 2h |
| Testing | 3h |
| Design/Planning | 3h |
| Implementation | 6h |
| Refactoring | 4h |
| Default | 4h |

### Time Formatting

- **< 8 hours**: "N hours"
- **8-32 hours**: "N days" (8h = 1 day)
- **40+ hours**: "N weeks" (40h = 1 week)

## Examples

### Example 1: Simple Plan

**Input:**
```bash
dev plan 123 --simple
```

**Output:**
```
📋 Plan for Issue #123: Add dark mode support

Tasks (5):

1. ☐ Add theme state management
   ⏱️  Est: 6h
   📁 src/store/theme.ts (85% similar)

2. ☐ Implement dark mode styles
   ⏱️  Est: 4h

3. ☐ Create theme toggle component
   ⏱️  Est: 6h
   📁 src/components/ThemeToggle.tsx (78% similar)

4. ☐ Update existing components
   ⏱️  Est: 4h

5. ☐ Write tests
   ⏱️  Est: 3h

Summary:
  Priority: 🟡 medium
  Estimated: ⏱️  3 days
```

### Example 2: JSON Output (for tools)

```bash
dev plan 123 --json
```

```json
{
  "issueNumber": 123,
  "title": "Add dark mode support",
  "description": "Users want dark mode...",
  "tasks": [
    {
      "id": "1",
      "description": "Add theme state management",
      "relevantCode": [
        {
          "path": "src/store/theme.ts",
          "reason": "Similar pattern found",
          "score": 0.85
        }
      ],
      "estimatedHours": 6
    }
  ],
  "totalEstimate": "3 days",
  "priority": "medium",
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00Z",
    "explorerUsed": true,
    "strategy": "sequential"
  }
}
```

### Example 3: Markdown (for GitHub comments)

```bash
dev plan 123 --markdown
```

```markdown
# Plan: Add dark mode support (#123)

## Description

Users want dark mode...

## Tasks

### 1. Add theme state management

- **Estimate:** 6h
- **Relevant Code:**
  - `src/store/theme.ts` (85% similar)

### 2. Implement dark mode styles

- **Estimate:** 4h

## Summary

- **Priority:** medium
- **Total Estimate:** 3 days
```

## Testing

The Planner has 100% test coverage on utilities (50 tests) and comprehensive integration tests (15 tests):

```bash
# Run all tests
pnpm test packages/subagents/src/planner

# Results: 65 tests passing ✅
# - parsing.test.ts: 30 tests
# - estimation.test.ts: 20 tests
# - index.test.ts: 15 tests
```

## Prerequisites

- **GitHub CLI (`gh`)**: Required for fetching issues
  ```bash
  brew install gh        # macOS
  sudo apt install gh    # Linux
  # https://cli.github.com  # Windows
  ```

- **Authenticated**: Run `gh auth login` first

- **Git Repository**: Must be in a Git repo with GitHub remote

## Architecture

```
planner/
├── index.ts              # Main agent implementation
├── types.ts              # Type definitions
├── utils/
│   ├── github.ts         # GitHub CLI integration
│   ├── parsing.ts        # Issue content parsing
│   ├── breakdown.ts      # Task breakdown logic
│   ├── estimation.ts     # Effort estimation
│   └── formatting.ts     # Output formatting
└── README.md            # This file
```

## Future Enhancements

- [ ] Custom estimation rules (per-project)
- [ ] Task dependencies and critical path
- [ ] Sprint planning (story points)
- [ ] Historical data learning
- [ ] GitHub Projects integration
- [ ] Jira/Linear adapters

