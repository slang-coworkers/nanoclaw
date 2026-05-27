#!/usr/bin/env bash
# Codex lifecycle hook bridge: mirror Codex hook payloads to the same
# dashboard ingest endpoint used by Claude Code hooks.
#
# Codex 0.124.0 fires SessionStart, UserPromptSubmit, PreToolUse,
# PostToolUse, and Stop. It does NOT emit:
#   - Notification (only relevant for permission prompts; bypassPermissions skips it)
#   - SubagentStart/Stop, PreCompact/PostCompact, SessionEnd,
#     PostToolUseFailure, StopFailure (don't exist in Codex 0.124.0)
#
# Known limitation: Codex strips `Process exited with code N` from the
# PostToolUse payload's tool_response, so the dashboard can't tell a
# failed Bash apart from a successful one. The full stdout/stderr
# is still in tool_response, just no machine-readable exit code.
# Tracked upstream — once exposed, derive PostToolUseFailure here.
set -euo pipefail

EVENT="${1:-${CODEX_HOOK_EVENT:-}}"
INPUT="$(cat || true)"

[ -n "${DASHBOARD_URL:-}" ] || exit 0
[ -n "$EVENT" ] || exit 0

RAW_JSON="$(printf '%s' "${INPUT:-{}}" | jq -c '. // {}' 2>/dev/null || true)"
if [ -z "$RAW_JSON" ]; then
  RAW_JSON='{}'
fi

PAYLOAD="$({
  jq -nc \
    --arg event "$EVENT" \
    --arg group "${NANOCLAW_GROUP_FOLDER:-}" \
    --arg session "${NANOCLAW_SESSION_THREAD_ID:-${NANOCLAW_SESSION_ID:-}}" \
    --arg nano_session "${NANOCLAW_SESSION_ID:-}" \
    --arg provider "codex" \
    --arg cwd "${PWD:-}" \
    --argjson input "$RAW_JSON" \
    '($input // {}) as $raw
     | {
         hook_event_name: $event,
         group: $group,
         session_id: ($raw.session_id // $raw.thread_id // $session),
         agent_type: $provider,
         cwd: ($raw.cwd // $cwd),
         tool_name: ($raw.tool_name // $raw.tool // $raw.tool_call.name // $raw.call.name // null),
         tool_use_id: ($raw.tool_call_id // $raw.tool_use_id // $raw.call_id // $raw.id // null),
         tool_input: ($raw.tool_input // $raw.input // $raw.tool_call.arguments // $raw.call.arguments // null),
         tool_result: ($raw.tool_result // $raw.tool_response // $raw.output // $raw.result // null),
         prompt: ($raw.prompt // $raw.user_prompt // $raw.input_text // null),
         extra: { provider: $provider, nano_session_id: $nano_session, codex_hook_payload: $raw }
       }' 2>/dev/null || jq -nc \
    --arg event "$EVENT" \
    --arg group "${NANOCLAW_GROUP_FOLDER:-}" \
    --arg session "${NANOCLAW_SESSION_THREAD_ID:-${NANOCLAW_SESSION_ID:-}}" \
    --arg provider "codex" \
    --arg raw "$INPUT" \
    '{hook_event_name:$event, group:$group, session_id:$session, agent_type:$provider, extra:{provider:$provider, raw_stdin:$raw}}'
})"

curl -sf --proxy '' \
  -X POST "$DASHBOARD_URL/api/hook-event" \
  -H 'Content-Type: application/json' \
  -H "X-Group-Folder: ${NANOCLAW_GROUP_FOLDER:-}" \
  -H "X-NanoClaw-Session-Id: ${NANOCLAW_SESSION_ID:-}" \
  --data-binary "$PAYLOAD" >/dev/null || true

printf '{}\n'
