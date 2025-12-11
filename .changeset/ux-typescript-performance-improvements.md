---
"@lytics/dev-agent-cli": minor
"@lytics/dev-agent-core": minor
"@lytics/dev-agent": minor
---

UX and performance improvements for TypeScript projects

**UX Improvements:**
- MCP install is now idempotent for Claude Code - shows positive message when server already exists instead of erroring
- Enhanced documentation with clear customization examples for exclusion patterns

**Performance Improvements:**
- Add TypeScript-specific exclusion patterns to default config for 10-15% indexing performance improvement
- Exclude mock files (*.mock.ts, *.mock.tsx, mocks/), type definition files (*.d.ts), and test infrastructure (test-utils/, testing/)

**Configurability:**
- TypeScript exclusions are now fully configurable via .dev-agent/config.json
- Users can customize patterns, include type definitions if desired, or add project-specific exclusions
- Default config provides optimized performance while maintaining full user control

**Semantic Value Preserved:**
- Stories files are kept (contain valuable component documentation and usage patterns)
- Only excludes truly low-value files while preserving semantic content for AI tools