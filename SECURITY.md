# Security Policy

## Supported Versions

Currently, only the latest version of dev-agent receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of dev-agent seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do Not Open a Public Issue**

Please do not create a public GitHub issue for security vulnerabilities. This helps protect users who haven't yet updated to a patched version.

### 2. **Report Privately**

Send a detailed report to the project maintainers via:
- **GitHub Security Advisories**: Use the "Report a vulnerability" button in the Security tab
- **Direct Contact**: Open a private discussion in the repository

### 3. **Include in Your Report**

- **Description**: Clear description of the vulnerability
- **Impact**: Potential impact and severity
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Environment**: Version, OS, Node.js version, etc.
- **Proof of Concept**: If available (code snippets, screenshots)
- **Suggested Fix**: If you have recommendations

### Example Report Format

```
## Vulnerability Description
[Brief description of the vulnerability]

## Impact
[What can an attacker do? What data is at risk?]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [And so on...]

## Environment
- dev-agent version: 0.1.0
- Node.js version: 22.0.0
- Operating System: macOS 14.0

## Proof of Concept
[Code snippet or screenshot]

## Suggested Fix
[If you have any suggestions]
```

## Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial Assessment**: Within 7 days
- **Status Updates**: Every 7 days until resolved
- **Fix Release**: Depends on severity (critical issues within 7 days)

## Security Best Practices

When using dev-agent, we recommend:

### For Users

1. **Keep Updated**: Always use the latest version
2. **Review Permissions**: Understand what file access is granted
3. **Environment Variables**: Don't expose sensitive data in `.dev-agent/config.json`
4. **Repository Access**: dev-agent reads your codebase - ensure it's running in trusted environments
5. **MCP Configuration**: Secure your `~/.cursor/mcp.json` file with appropriate permissions

### For Contributors

1. **Dependencies**: Keep dependencies up to date
2. **Code Review**: All code changes require review before merge
3. **Input Validation**: Validate all user inputs and API responses
4. **Sensitive Data**: Never log sensitive information
5. **Tests**: Include security tests for new features

## Known Security Considerations

### File System Access

dev-agent requires read access to your repository files for indexing. It:
- ✅ **Respects `.gitignore`** - Won't index ignored files
- ✅ **Local Only** - All data stays on your machine
- ✅ **No Network Calls** - Embeddings run locally
- ❌ **Write Access** - Does NOT write to your codebase (read-only)

### MCP Server

The MCP server:
- Runs locally via STDIO transport
- No network exposure by default
- Controlled by your IDE (Cursor/Claude)
- Respects OS-level file permissions

### Data Storage

- **Vector Indexes**: Stored in `~/.dev-agent/indexes/`
- **Configuration**: Stored in `~/.dev-agent/config.json`
- **No Telemetry**: We don't collect usage data
- **No Cloud**: Everything stays local

## Security Features

### Current Protections

- ✅ **Input Validation**: All MCP tool inputs validated
- ✅ **Rate Limiting**: Per-tool request limits (100 req/min)
- ✅ **Error Handling**: Graceful error handling without exposing internals
- ✅ **Sandboxed Execution**: MCP server runs with limited permissions
- ✅ **Type Safety**: TypeScript strict mode enabled
- ✅ **Memory Bounds**: Circular buffers prevent memory exhaustion

### Planned Enhancements

- [ ] Configurable rate limits
- [ ] Audit logging for MCP operations
- [ ] Index encryption at rest
- [ ] Signed releases with checksums

## Responsible Disclosure

We appreciate responsible disclosure of security vulnerabilities. Security researchers who report valid vulnerabilities will be:

- **Acknowledged**: In release notes (with permission)
- **Credited**: In SECURITY.md
- **Updated**: On fix timeline and resolution

## Security Updates

Security updates are released as:
- **Patch versions** (0.1.x) for low-severity issues
- **Minor versions** (0.x.0) for medium-severity issues requiring breaking changes
- **Immediate hotfix** for critical vulnerabilities

Subscribe to releases on GitHub to get notified of security updates.

## Questions?

If you have questions about security but haven't found a vulnerability, feel free to open a discussion in the repository.

---

**Last Updated**: 2025-11-26  
**Policy Version**: 1.0

