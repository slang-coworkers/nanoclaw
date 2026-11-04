#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash|Write|Edit|MultiEdit|mcp__github__<review tools>):
# a posted review stays under REVIEW_LENGTH_CAP_CHARS characters of review text
# (default 4,000: summary or body plus every inline comment). A length rule in the
# prompt does not change how much a reviewer writes; a refusal at posting time does.
#
# Symmetric opt-in like gate-eval-sandbox.sh: the hook only fires for groups whose
# overlays include `review-length`. The composer materializes
# /workspace/agent/.overlay-review-length from that overlay's MARKER; the host may
# pass REVIEW_LENGTH_GATE_ACTIVE=1/0 instead. REVIEW_LENGTH_GATE=0 disables.
#
# The measuring lives in lib/review_length.py (it shares the command parsing of
# lib/pr_description.py); this wrapper decides activation and skips tool calls
# that cannot post or write a review, so python starts only when there is text
# to count. Stdin: hook JSON. Exit 0 = allow, exit 2 = deny with one line on
# stderr. Writes only its running total for the pending-review flow, under
# REVIEW_LENGTH_STATE_DIR (default: the marker directory).
set -uo pipefail

[ "${REVIEW_LENGTH_GATE:-1}" = "0" ] && exit 0

OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
if [ -n "${REVIEW_LENGTH_GATE_ACTIVE:-}" ]; then
  [ "$REVIEW_LENGTH_GATE_ACTIVE" = "1" ] || exit 0
else
  [ -f "$OVERLAY_DIR/.overlay-review-length" ] || exit 0
fi

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)

case "$TOOL" in
  Bash)
    CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || true)
    # Only `gh pr review|comment`, `gh api` and a write of answer.json can carry review text.
    grep -qE '(^|[^[:alnum:]_.-])gh[[:space:]]+(pr[[:space:]]+(review|comment)|api)([[:space:]]|$)|answer\.json' <<< "$CMD" || exit 0
    ;;
  Write|Edit|MultiEdit)
    FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)
    case "$FILE" in */answer.json|answer.json) ;; *) exit 0 ;; esac
    ;;
  mcp__github__*) ;;
  *) exit 0 ;;
esac

command -v python3 >/dev/null 2>&1 || exit 0
printf '%s' "$INPUT" | REVIEW_LENGTH_STATE_DIR="${REVIEW_LENGTH_STATE_DIR:-$OVERLAY_DIR}" \
  python3 "$(dirname "${BASH_SOURCE[0]}")/lib/review_length.py"
