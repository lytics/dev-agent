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

```bash
# Initialize and index
dev init
dev index .

# Search for code
dev search "user authentication flow"
dev search "database connection pool" --limit 5

# Keep index up to date
dev update

# View statistics
dev stats

# Clean and re-index
dev clean --force
dev index . --force
```

## License

MIT

