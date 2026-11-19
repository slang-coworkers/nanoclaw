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
LOG_NAME=""
if [[ -n "${NANOCLAW_SESSION_ID:-}" ]]; then
  LOG_NAME="session-${NANOCLAW_SESSION_ID}"
  LOG_ARGS=(--log "${LOG_NAME}")
fi

# Tracing is observability, so a trace path the session user cannot write must
# not fail the agent turn. claude-trace creates <cwd>/.claude-trace/<name>.jsonl
# at startup, and an EACCES there (for example a folder that a root process
# created) ends the child before the SDK reads one message. We move such a
# folder or log file aside so claude-trace starts a fresh one; when the move
# also fails, we run the real binary without tracing.
OUT_DIR="${PWD}/.claude-trace"
STAMP="$(date +%s)"
UNTRACED_REASON=""

move_aside() {
  mv "$1" "$1.unwritable-${STAMP}" 2>/dev/null || return 1
  echo "[claude-trace-wrapper] $1 was not writable; moved it to $1.unwritable-${STAMP}" >&2
}

out_dir_writable() {
  mkdir -p "${OUT_DIR}" 2>/dev/null && [[ -w "${OUT_DIR}" && -x "${OUT_DIR}" ]]
}

if ! out_dir_writable && ! { move_aside "${OUT_DIR}" && out_dir_writable; }; then
  UNTRACED_REASON="${OUT_DIR} is not writable"
fi
if [[ -z "${UNTRACED_REASON}" && -n "${LOG_NAME}" ]]; then
  for f in "${OUT_DIR}/${LOG_NAME}.jsonl" "${OUT_DIR}/${LOG_NAME}.html"; do
    if [[ -e "${f}" && ! -w "${f}" ]] && ! move_aside "${f}"; then
      UNTRACED_REASON="${f} is not writable"
      break
    fi
  done
fi
if [[ -n "${UNTRACED_REASON}" ]]; then
  echo "[claude-trace-wrapper] ${UNTRACED_REASON}; running claude without tracing" >&2
  exec "${REAL_CLAUDE}" "$@"
fi

exec node "${TRACE_DIR}/dist/cli.js" \
  --no-open \
  --include-all-requests \
  "${LOG_ARGS[@]}" \
  --claude-path "${REAL_CLAUDE}" \
  --run-with "$@"
