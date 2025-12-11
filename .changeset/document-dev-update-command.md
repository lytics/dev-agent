---
"@lytics/dev-agent-cli": patch
"@lytics/dev-agent": patch
"@lytics/dev-agent-core": patch
---

fix: improve reliability, performance, and documentation for Go support

## Major Features
- **Performance Configuration**: Environment variables for fine-tuning concurrency (DEV_AGENT_*_CONCURRENCY)
- **Enhanced Go Scanner**: Runtime WASM validation, improved error handling, better reliability
- **TypeScript Improvements**: Streamlined error handling, better type checking, enhanced progress reporting
- **System Resource Detection**: Intelligent performance defaults based on CPU and memory
- **Architectural Utilities**: Reusable modules for WASM resolution, concurrency, and file validation

## New Environment Variables
- `DEV_AGENT_TYPESCRIPT_CONCURRENCY`: Control TypeScript scanner parallelism
- `DEV_AGENT_INDEXER_CONCURRENCY`: Configure embedding batch processing
- `DEV_AGENT_GO_CONCURRENCY`: Tune Go scanner performance
- `DEV_AGENT_CONCURRENCY`: General fallback for all scanners

## Documentation & User Experience
- Document missing `dev update` command for incremental indexing
- Add timing expectations (5-10 minutes for large codebases)
- Create LANGUAGE_SUPPORT.md contributor guide
- Enhanced troubleshooting and configuration sections
- Remove Renovate automation for manual dependency control

## Technical Improvements
- 57 new tests with comprehensive coverage
- Dependency injection for testable file system operations
- Centralized error handling patterns across scanners
- Build script reliability fixes (prevent silent failures)

This release significantly improves performance, reliability, and developer experience while maintaining backward compatibility.

