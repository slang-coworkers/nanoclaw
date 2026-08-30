#!/usr/bin/env bash
# PreToolUse hook (matcher: mcp__nanoclaw__send_message): refuse marked
# chain handoff / delivery messages unless they carry an explicit in_reply_to
# tool arg. The text-output dispatcher has a sibling in-process check for
# <message ...> blocks (checkRoutingGate in poll-loop.ts).
#
# ALWAYS ON — not an overlay. This enforces a structural invariant ("a chain
# handoff must name the inbound it answers", the [MUST] in chain-reporting.md)
# and is self-scoping: it only fires on a chain delivery marker, which only
# chain coworkers ever emit. Nothing to select, nothing to opt into.
#
# Why in_reply_to alone (thread_id optional): in_reply_to resolves the inbound
# row → source_session_id → the exact edge, and the runtime auto-derives
# thread_id from it (applyInReplyToDefaults in mcp-tools/core.ts). Requiring
# both would reject the spec's canonical upstream report form
# (send_message(to="parent", in_reply_to=<id>, ...)).
#
# Soft-cap: after 3 denials on a session the gate yields (mirrors
# gate-critique-on-deliver.sh) so a step that genuinely can't satisfy the
# precondition can't thrash the agent's whole turn budget.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
[ "$TOOL" = "mcp__nanoclaw__send_message" ] || exit 0

TEXT=$(echo "$INPUT" | jq -r '.tool_input.text // ""')

# Delivery vocabulary: built-in defaults + ADDITIVE per-role extensions from
# .critique-delivery-markers (same file the critique gate + poll-loop union).
# Keeping all three enforcement points on one vocabulary is the prerequisite
# for ever moving a role marker into per-role YAML: without it, that move
# would silently regress this always-on routing gate for the role.
OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
# Built-in floor = general chain-protocol primitives only; role-specific
# names arrive via each role's delivery_markers YAML (.critique-delivery-markers).
MSG_MARKERS='Resolution|handoff'
MARKERS_FILE="$OVERLAY_DIR/.critique-delivery-markers"
if [ -f "$MARKERS_FILE" ]; then
  EXTRA_MSG=$(jq -r '(.message_markers // []) | map(select(type == "string" and test("^[A-Za-z0-9][A-Za-z0-9 _-]*$"))) | join("|")' "$MARKERS_FILE" 2>/dev/null || true)
  [ -n "$EXTRA_MSG" ] && MSG_MARKERS="$MSG_MARKERS|$EXTRA_MSG"
fi

# Anchored to line start (matches poll-loop's routing regex + the critique
# gate); herestring not `echo|grep` (SIGPIPE-safe under pipefail).
if ! grep -qE "^[[:space:]]*\[($MSG_MARKERS)\]" <<< "$TEXT"; then
  exit 0
fi

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"

IN_REPLY_TO=$(echo "$INPUT" | jq -r '.tool_input.in_reply_to // ""')
if [ -n "$IN_REPLY_TO" ]; then
  # A properly-linked handoff proves the agent CAN satisfy the gate — re-arm the
  # soft-cap (mirror of poll-loop resetGateDenials). Without this the counter
  # only ever climbs and, once capped, the gate yields for every later unlinked
  # handoff in the session.
  if [ -f "$STATE" ]; then
    jq 'del(.routing_gate_denials)' "$STATE" > "$STATE.tmp" 2>/dev/null && mv "$STATE.tmp" "$STATE" || rm -f "$STATE.tmp"
  fi
  exit 0
fi

DENIALS=$(jq -r '.routing_gate_denials // 0' "$STATE" 2>/dev/null || echo 0)
if [ "$DENIALS" -ge 3 ]; then
  cat >&2 << EOF2
[chain-routing-gate soft-fail] Allowing delivery despite missing in_reply_to.
The gate denied this session 3 times already; further denials would just
thrash. If the agent consistently can't link to an inbound, the workflow step
needs review.
EOF2
  exit 0
fi
mkdir -p "$(dirname "$STATE")" 2>/dev/null || true
jq '.routing_gate_denials = ((.routing_gate_denials // 0) + 1)' "$STATE" > "$STATE.tmp" 2>/dev/null && mv "$STATE.tmp" "$STATE" \
  || echo '{"routing_gate_denials":1}' > "$STATE" 2>/dev/null || true

cat >&2 << EOF2
CHAIN ROUTING REQUIRED before delivery/handoff message.

Your send_message text contains a chain delivery marker, but the tool call is
missing in_reply_to. Re-send naming the inbound you are answering:

  in_reply_to=<inbound message id you are answering>

thread_id is optional — the runtime derives it from in_reply_to. Do not
describe the routing in prose; set the field on the tool call.
EOF2
exit 2
