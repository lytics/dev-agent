---
"@lytics/dev-agent": minor
"@lytics/dev-agent-core": minor
"@lytics/dev-agent-cli": minor
"@lytics/dev-agent-subagents": minor
---

feat: Go language support

Add comprehensive Go language support to dev-agent:

**Go Scanner**
- Tree-sitter WASM infrastructure (reusable for Python/Rust later)
- Extract functions, methods, structs, interfaces, types, constants
- Method receivers with pointer detection
- Go 1.18+ generics support
- Go doc comment extraction
- Exported symbol detection (capital letter convention)
- Generated file skipping (*.pb.go, *.gen.go, etc.)
- 90%+ test coverage

**Indexer Logging**
- Add `--verbose` flag to `dev index`, `dev git index`, `dev gh index`
- Progress spinner shows actual counts: `Embedding 4480/49151 documents (9%)`
- Structured logging with kero logger

**Go-Specific Exclusions**
- Protobuf: `*.pb.go`, `*.pb.gw.go`
- Generated: `*.gen.go`, `*_gen.go`
- Mocks: `mock_*.go`, `mocks/`
- Test fixtures: `testdata/`

Tested on large Go codebase (~4k files, 49k documents).
