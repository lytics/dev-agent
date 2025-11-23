# @lytics/dev-agent-cli

Command-line interface for dev-agent - Multi-agent code intelligence platform.

## Installation

```bash
npm install -g @lytics/dev-agent-cli
```

## Usage

### Initialize

Initialize dev-agent in your repository:

```bash
dev init
```

This creates a `.dev-agent.json` configuration file.

### Index Repository

Index your repository for semantic search:

```bash
dev index .
```

Options:
- `-f, --force` - Force re-index even if unchanged
- `-v, --verbose` - Show verbose output

### Search

Search your indexed code semantically:

```bash
dev search "authentication logic"
```

Options:
- `-l, --limit <number>` - Maximum results (default: 10)
- `-t, --threshold <number>` - Minimum similarity score 0-1 (default: 0.7)
- `--json` - Output as JSON

**Understanding Thresholds:**
- `0.7` (default): Precise matches only
- `0.4-0.6`: Balanced - good for most searches
- `0.25-0.3`: Exploratory - finds related concepts
- `0.0`: Return everything (useful for debugging)

### Explore

Explore code patterns and relationships:

```bash
# Find patterns using semantic search
dev explore pattern "error handling" --limit 5

# Find code similar to a file
dev explore similar path/to/file.ts --limit 5
```

Options:
- `-l, --limit <number>` - Maximum results (default: 10)
- `-t, --threshold <number>` - Minimum similarity score (default: 0.7)

### Update

Incrementally update the index with changed files:

```bash
dev update
```

Options:
- `-v, --verbose` - Show verbose output

### Stats

Show indexing statistics:

```bash
dev stats
```

Options:
- `--json` - Output as JSON

### Clean

Remove all indexed data:

```bash
dev clean --force
```

Options:
- `-f, --force` - Skip confirmation prompt

## Configuration

The `.dev-agent.json` file configures the indexer:

```json
{
  "repositoryPath": "/path/to/repo",
  "vectorStorePath": ".dev-agent/vectors.lance",
  "embeddingModel": "Xenova/all-MiniLM-L6-v2",
  "dimension": 384,
  "excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**"
  ],
  "languages": ["typescript", "javascript", "markdown"]
}
```

## Features

- 🎨 **Beautiful UX** - Colored output, spinners, progress indicators
- ⚡ **Fast** - Incremental updates, efficient indexing
- 🧠 **Semantic Search** - Find code by meaning, not exact matches
- 🔧 **Configurable** - Customize patterns, languages, and more
- 📊 **Statistics** - Track indexing progress and stats

## Examples

### Basic Workflow

```bash
# Initialize and index
dev init
dev index .

# View statistics
dev stats
# 📊 Files Indexed: 54, Vectors Stored: 566
```

### Semantic Search Examples

```bash
# Natural language queries work great!
dev search "how do agents communicate" --threshold 0.3

# Results:
# 1. Message-Based Architecture (51.9% match)
# 2. AgentContext (43.1% match)
# 3. SubagentCoordinator.broadcastMessage (41.8% match)

# Technical concept search
dev search "vector embeddings" --threshold 0.3 --limit 3

# Results:
# 1. EmbeddingProvider (58.5% match)
# 2. EmbeddingDocument (51.0% match)
# 3. VectorStore (47.9% match)

# Exact term matching (high scores!)
dev search "RepositoryIndexer" --threshold 0.4

# Results:
# 1. RepositoryIndexer.index (85.7% match)
# 2. RepositoryIndexer (75.4% match)
```

### Pattern Exploration

```bash
# Find patterns in your codebase
dev explore pattern "test coverage utilities" --threshold 0.25

# Results:
# 1. Coverage Targets (56.0% match)
# 2. 100% Coverage on Utilities (50.8% match)
# 3. Testing (42.3% match)

# Discover error handling patterns
dev explore pattern "error handling" --threshold 0.3

# Results:
# 1. Handle Errors Gracefully (39.3% match)
# 2. createErrorResponse (35.9% match)
```

### Pro Tips

```bash
# JSON output for scripting
dev search "coordinator" --json | jq '.[].metadata.path' | sort -u

# Lower threshold for exploration
dev search "architectural patterns" --threshold 0.25 --limit 10

# Keep index up to date
dev update

# Clean and re-index if needed
dev clean --force
dev index . --force
```

## License

MIT

