#!/usr/bin/env bash
# buddy-call.sh — async fire-and-forget codex review
#
# Invoked by spawn-buddy.sh after each substantive primary-agent tool turn.
# Reads the session JSONL delta, distills tool turns, asks codex to review,
# writes guidance to /workspace/.claude/buddy/guidance.txt when codex
# returns CONCERN. Buddy-inject.sh picks up the guidance on the next
# UserPromptSubmit and prepends it to the agent's turn as <buddy-note>.
#
# Charter (the codex reviewer's behavior contract) lives at
# /app/skills/buddy/CHARTER.md and is included as a prompt prefix on the
# first call; subsequent fires use `codex exec resume <session_id>` so the
# charter persists in the codex session without being re-sent.
#
# State directory: /workspace/.claude/buddy/  (per-session via container mount)
#   thread-id    — codex session UUID, written after first successful fire
#   cursor       — byte offset into the agent's session JSONL
#   guidance.txt — what buddy-inject.sh reads and clears on injection
#   .lock        — concurrency guard (60s TTL)
#   log.jsonl    — buddy's own debug trail (one line per fire)
#
# Failure modes:
#   - codex unavailable / auth fails → logged, no guidance written, exit 0
#   - JSONL not found → logged, exit 0
#   - No reviewable activity since last fire → cursor advanced, exit 0
#   - codex returns OK → no guidance written
#   - codex returns CONCERN with required Quote: field → guidance written
#   - codex returns text without Quote: → not a CONCERN (charter enforces),
#                                          treated as OK
set -euo pipefail

BUDDY_DIR="/workspace/.claude/buddy"
mkdir -p "$BUDDY_DIR"
LOCK="$BUDDY_DIR/.lock"
GUIDANCE="$BUDDY_DIR/guidance.txt"
CURSOR="$BUDDY_DIR/cursor"
THREAD="$BUDDY_DIR/thread-id"
LOG="$BUDDY_DIR/log.jsonl"
CHARTER="${BUDDY_CHARTER_PATH:-/app/skills/buddy/CHARTER.md}"

log_event() { jq -nc --arg t "$(date -u +%FT%TZ)" --arg e "$1" '{t:$t,event:$e}' >> "$LOG" 2>/dev/null || true; }

# Concurrency guard — second fire while first in flight (<60s) exits silently
if [ -f "$LOCK" ]; then
  AGE=$(($(date +%s) - $(stat -c %Y "$LOCK")))
  [ "$AGE" -lt 60 ] && { log_event "lock-busy"; exit 0; }
fi
touch "$LOCK"
trap 'rm -f "$LOCK"' EXIT

# Find the agent's session JSONL. Claude SDK writes to
# /home/node/.claude/projects/<slug>/<uuid>.jsonl. CLAUDE_SESSION_ID is
# the uuid prefix.
SID="${CLAUDE_SESSION_ID:-}"
if [ -z "$SID" ]; then log_event "no-session-id"; exit 0; fi
JSONL=$(find /home/node/.claude/projects -name "${SID}*.jsonl" 2>/dev/null | head -1)
if [ -z "$JSONL" ] || [ ! -f "$JSONL" ]; then log_event "no-jsonl"; exit 0; fi

# Cursor — read delta since last fire
LAST=$(cat "$CURSOR" 2>/dev/null || echo 0)
SIZE=$(stat -c %s "$JSONL" 2>/dev/null || echo 0)
if [ "$SIZE" -le "$LAST" ]; then log_event "no-new-bytes"; exit 0; fi

DELTA=$(tail -c "+$((LAST + 1))" "$JSONL" 2>/dev/null || true)

# Distill — extract assistant tool_use entries, drop read-only and
# buddy-meta tools, format compact one-line-per-action. Cap at 12 actions
# per batch so codex prompt stays small.
DISTILLED=$(printf '%s' "$DELTA" | jq -rc '
  select(.type == "assistant") | .message.content[]? |
  select(.type == "tool_use") |
  select(.name | test("^(Read|Grep|Glob|LS|WebSearch|WebFetch)$") | not) |
  if   .name == "Edit"   or .name == "Write" or .name == "MultiEdit" or .name == "NotebookEdit" then
    "[\(.name)] \(.input.file_path // .input.path // \"<unknown>\")"
  elif .name == "Bash" then
    "[Bash] \((.input.command // \"\") | .[:200])"
  elif (.name | startswith("mcp__nanoclaw__")) then
    "[\(.name)] to=\(.input.to // \"?\") text=\"\((.input.text // \"\") | .[:120])\""
  else
    "[\(.name)] \((.input | tostring) | .[:140])"
  end
' 2>/dev/null | head -12)

if [ -z "$DISTILLED" ]; then
  echo "$SIZE" > "$CURSOR"
  log_event "no-reviewable-tools"
  exit 0
fi

# Batch number for the codex prompt
BATCH_NUM=$(wc -l < "$LOG" 2>/dev/null || echo 0)
BATCH_NUM=$((BATCH_NUM + 1))
NOW=$(date -u +%FT%TZ)

BATCH_PROMPT="BATCH $BATCH_NUM (turns since last review, t=$NOW):

$DISTILLED

Anything to flag? Reply OK or one CONCERN (with required Quote: field per your charter)."

# First fire vs resume
if [ -f "$THREAD" ] && [ -s "$THREAD" ]; then
  THREAD_ID=$(cat "$THREAD")
  log_event "calling-codex-resume"
  RESPONSE=$(printf '%s' "$BATCH_PROMPT" | timeout 120 codex exec resume "$THREAD_ID" \
    -s danger-full-access --skip-git-repo-check -C /workspace/agent - 2>>"$LOG" || true)
else
  if [ ! -f "$CHARTER" ]; then
    log_event "no-charter-file"
    echo "$SIZE" > "$CURSOR"
    exit 0
  fi
  CHARTER_TEXT=$(cat "$CHARTER")
  FIRST_PROMPT="$CHARTER_TEXT

---
You are reviewing a Claude agent's session in real-time. Read /workspace/agent/AGENTS.md before your first reply for agent identity, skills, and workflows.

I will send a BATCH n payload now and on each subsequent fire. Maintain your ledger across the thread.

$BATCH_PROMPT"
  log_event "calling-codex-init"
  # Capture --json output to extract session_id for future resumes
  RAW=$(printf '%s' "$FIRST_PROMPT" | timeout 180 codex exec --json \
    -s danger-full-access --skip-git-repo-check -C /workspace/agent - 2>>"$LOG" || true)
  # session_id appears in early events as {"session_id": "<uuid>", ...}
  THREAD_ID=$(printf '%s' "$RAW" | jq -r 'select(.session_id != null) | .session_id' 2>/dev/null | head -1 || true)
  if [ -n "$THREAD_ID" ]; then
    echo "$THREAD_ID" > "$THREAD"
    log_event "thread-saved"
  fi
  # Final assistant message — reconstruct from the JSONL events. Look for
  # the last "agent_message" / "assistant" event with text payload.
  RESPONSE=$(printf '%s' "$RAW" | jq -r '
    select((.type == "agent_message" or .type == "assistant_message") and .message != null) | .message
  ' 2>/dev/null | tail -1 || true)
  if [ -z "$RESPONSE" ]; then
    # Fallback: last non-empty stdout chunk that isn't JSONL
    RESPONSE=$(printf '%s' "$RAW" | grep -v '^{' | tail -5 | tr -d '\r' || true)
  fi
fi

# Write guidance only if codex returned a properly-formed CONCERN. Charter
# enforces "no Quote: field → reply OK", so we double-check format.
if printf '%s' "$RESPONSE" | grep -qE '^CONCERN at .*Quote: "'; then
  printf '%s\n' "$RESPONSE" > "$GUIDANCE"
  log_event "concern-written"
else
  log_event "ok-or-malformed"
fi

# Save cursor only after a successful (or attempted) round-trip — if we
# got here without exiting, codex was reachable and we shouldn't replay
# the same batch on the next fire.
echo "$SIZE" > "$CURSOR"
exit 0
