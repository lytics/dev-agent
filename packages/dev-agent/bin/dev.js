#!/usr/bin/env node

// Thin wrapper that delegates to the CLI implementation
// This allows us to:
// 1. Keep implementation flexible (@lytics/dev-agent-cli can change)
// 2. Publish @lytics/dev-agent as the user-facing package
// 3. Optionally publish other packages (@lytics/dev-agent-core, etc.) later

require('@lytics/dev-agent-cli/dist/cli.js');
