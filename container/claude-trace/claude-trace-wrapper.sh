#!/bin/bash
# claude-trace wrapper — drop-in replacement for the native `claude` executable
# that the Claude Agent SDK spawns (pathToClaudeCodeExecutable). It runs the
# real binary under claude-trace's native reverse-proxy mode so every model
# request/response is dumped to <cwd>/.claude-trace/*.jsonl + *.html.
#
# Contract with the SDK:
#   - All SDK args are forwarded verbatim to the real claude binary.
#   - The child's STDOUT (stream-json protocol) passes through untouched;
#     claude-trace's own logging goes to STDERR (patched).
#   - ANTHROPIC_BASE_URL / HTTPS_PROXY are inherited from the container env,
#     so traffic still flows to NVIDIA via the OneCLI proxy. claude-trace only
#     overrides ANTHROPIC_BASE_URL for the *child* (pointing at its local proxy),
#     while its own upstream forwards to the original base URL + proxy.
set -euo pipefail

TRACE_DIR="${CLAUDE_TRACE_DIR:-/opt/claude-trace}"
REAL_CLAUDE="${CLAUDE_TRACE_REAL_BIN:-/app/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude}"

# Per-session log name if the runner exports one; else claude-trace timestamps it.
LOG_ARGS=()
if [[ -n "${NANOCLAW_SESSION_ID:-}" ]]; then
  LOG_ARGS=(--log "session-${NANOCLAW_SESSION_ID}")
fi

exec node "${TRACE_DIR}/dist/cli.js" \
  --no-open \
  --include-all-requests \
  "${LOG_ARGS[@]}" \
  --claude-path "${REAL_CLAUDE}" \
  --run-with "$@"
