# Dev-Agent Integrations

This package provides integrations with various developer tools and AI systems.

## Available Integrations

### Claude Code

The Claude integration enables Dev-Agent to provide context to Claude Code when working on repositories, reducing hallucinations and improving code understanding.

### VS Code Extension

The VS Code extension allows developers to use Dev-Agent directly within their editor, providing context-aware suggestions and repository insights.

## Adding New Integrations

To add a new integration:

1. Create a new folder in the integrations directory with the name of the tool
2. Implement the common interface defined in the integrations package
3. Add exports to the main package index.ts
4. Update the documentation