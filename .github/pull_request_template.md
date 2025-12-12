## 📋 Description

<!-- Briefly describe what this PR does and why -->

## 🔗 Related Issues

<!-- Link to related GitHub issues -->
Closes #

## 🧪 Code Standards Checklist

<!-- Check all that apply - See docs/TYPESCRIPT_STANDARDS.md -->

- [ ] Pure functions extracted to `utils/` modules
- [ ] Utilities achieve 100% coverage (statements & functions)
- [ ] **No type assertions (`as`, `!`)** without validation
- [ ] **Runtime validation** for external data (Zod/type guards)
- [ ] **Result types** used instead of exceptions
- [ ] Modules organized by domain (not generic "utils")
- [ ] Each module < 300 lines, each class < 400 lines
- [ ] Constructor injection for dependencies
- [ ] Atomic commits with clear dependencies

**See:** [TypeScript Standards](../docs/TYPESCRIPT_STANDARDS.md)

## ✅ Testing

<!-- Describe testing approach -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Coverage meets targets:
  - Pure utilities: 100%
  - Integration: >80%
  - CLI/UI: >60%
- [ ] All tests passing locally

## 📊 Coverage

<!-- Paste coverage report for changed files -->

```
Before: X% statements, Y% branches, Z% functions
After:  X% statements, Y% branches, Z% functions
```

## 🏗️ Architecture

<!-- If refactoring, describe the structure -->

- [ ] Follows dependency order (foundation → dependent → integration)
- [ ] Barrel exports for clean imports
- [ ] Clear separation of pure/impure code

## 📝 Documentation

- [ ] Updated README if public API changed
- [ ] Added JSDoc for public functions
- [ ] Updated CHANGELOG (if applicable)

## 🚀 Deployment

- [ ] No breaking changes
- [ ] Backward compatible
- [ ] Database migrations (if applicable)

## 📸 Screenshots

<!-- If UI changes, add screenshots -->

---

**Commit Strategy:**
<!-- Did you follow granular commits? -->
- [ ] Atomic commits (each builds independently)
- [ ] Conventional commit messages
- [ ] Clear commit descriptions

