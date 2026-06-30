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

log_event() {
  jq -nc --arg t "$(date -u +%FT%TZ)" --arg e "$1" '{t:$t,event:$e}' >> "$LOG" 2>/dev/null || true
  post_dashboard_event "$1"
}

# Mirror buddy events to the dashboard's hook-event ingest so the overlay
# is observable in the timeline (init / resume / thread-saved / lock-busy /
# concern-written, etc.). Container-runner sets NANOCLAW_HOOK_URL when the
# dashboard is configured; empty value → silent no-op (dashboards don't
# exist on every install).
post_dashboard_event() {
  [ -z "${NANOCLAW_HOOK_URL:-}" ] && return 0
  local event="$1"
  local payload
  payload=$(jq -nc \
    --arg event "buddy.${event}" \
    --arg session "${NANOCLAW_SESSION_ID:-}" \
    --arg thread "${NANOCLAW_SESSION_THREAD_ID:-}" \
    --arg group "${NANOCLAW_GROUP_FOLDER:-}" \
    '{
      hook_event_name: $event,
      tool_name: "buddy",
      session_id: $session,
      thread_id: $thread,
      group: $group
    }' 2>/dev/null) || return 0
  curl -sf --proxy '' -X POST "$NANOCLAW_HOOK_URL" \
    -H 'Content-Type: application/json' \
    -H "X-Group-Folder: ${NANOCLAW_GROUP_FOLDER:-}" \
    -H "X-NanoClaw-Session-Id: ${NANOCLAW_SESSION_ID:-}" \
    -H "X-NanoClaw-Session-Thread-Id: ${NANOCLAW_SESSION_THREAD_ID:-}" \
    -d "$payload" >/dev/null 2>&1 || true
}

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

# SDK-flush race fix (#68): PostToolUse hooks fire BEFORE the Claude
# Agent SDK flushes the tool_use entry that triggered them. Without this
# wait, the FIRST buddy fire of a multi-tool burst reads JSONL while it's
# still mid-write — distill returns empty (no qualifying tool_use yet),
# cursor advances to the current size, and subsequent fires see "no-new-
# bytes" because the SDK still hasn't written. By the time the SDK
# catches up, no more PostToolUse fires happen (agent done) → that whole
# tool batch escapes buddy review.
#
# Wait for JSONL to grow past the recorded cursor, with a short timeout.
# If it doesn't grow, fall through — the regular "no-new-bytes" / "no-
# reviewable-tools" path will log it. Owner-of-lock is the only fire
# blocking; concurrent fires already exited via lock-busy above, so this
# wait does not stack.
WAIT_LAST=$(cat "$CURSOR" 2>/dev/null || echo 0)
WAIT_BUDGET="${BUDDY_FLUSH_WAIT_BUDGET_DECISECONDS:-30}"  # 30 × 100ms = 3s default
i=0
while [ $i -lt "$WAIT_BUDGET" ]; do
  CUR_SIZE=$(stat -c %s "$JSONL" 2>/dev/null || echo 0)
  [ "$CUR_SIZE" -gt "$WAIT_LAST" ] && break
  sleep 0.1
  i=$((i + 1))
done

# Cursor — read delta since last fire
LAST=$(cat "$CURSOR" 2>/dev/null || echo 0)
SIZE=$(stat -c %s "$JSONL" 2>/dev/null || echo 0)
if [ "$SIZE" -le "$LAST" ]; then log_event "no-new-bytes"; exit 0; fi

DELTA=$(tail -c "+$((LAST + 1))" "$JSONL" 2>/dev/null || true)

# Distill — extract assistant tool_use entries, drop read-only and
# buddy-meta tools, format compact one-line-per-action. Cap at 12 actions
# per batch so codex prompt stays small.
# NB: filter is in a SINGLE-quoted bash heredoc, so backslashes pass to jq
# verbatim. At expression level (inside `\(...)` interpolation) we MUST use
# bare `"..."` for string literals — `\"...\"` is a jq compile error there.
# `\"` is only valid inside a jq STRING body to escape a literal `"` (e.g.
# `text=\"...\"` below interpolates with literal-quote wrapping). The earlier
# version had `\"<unknown>\"`, `\"\"`, `\"?\"` at expression level which made
# jq exit 3 on every fire — set -euo pipefail then killed the script before
# any log_event call, so spawn-buddy's nohup'd child died silently.
DISTILLED=$(printf '%s' "$DELTA" | jq -rc '
  select(.type == "assistant") | .message.content[]? |
  select(.type == "tool_use") |
  select(.name | test("^(Read|Grep|Glob|LS|WebSearch|WebFetch)$") | not) |
  if   .name == "Edit"   or .name == "Write" or .name == "MultiEdit" or .name == "NotebookEdit" then
    "[\(.name)] \(.input.file_path // .input.path // "<unknown>")"
  elif .name == "Bash" then
    "[Bash] \((.input.command // "") | .[:200])"
  elif (.name | startswith("mcp__nanoclaw__")) then
    "[\(.name)] to=\(.input.to // "?") text=\"\((.input.text // "") | .[:120])\""
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

# First fire vs resume.
#
# Resume failure recovery (container-restart resilience): the thread-id
# file persists across container restarts on the per-session /workspace
# mount, but the codex session it references is stored in
# /home/node/.codex/sessions/ which is NOT preserved (only .claude-shared
# is). So after a container restart, `codex exec resume <stale-id>` will
# fail with empty/error output. We detect that, drop the stale thread-id,
# and fall through to first-fire init — preserving the cursor so we don't
# replay or skip batches.
# NB on codex --json event shape (codex 0.124+):
#   First event:    {"type":"thread.started","thread_id":"<uuid>"}
#   Agent reply:    {"type":"item.completed","item":{"type":"agent_message","text":"…"}}
#   Closing event:  {"type":"turn.completed","usage":{…}}
# Earlier versions emitted top-level `session_id` and a flat `agent_message`
# event. Both extraction paths are kept (new-shape first, old-shape fallback)
# to tolerate version skew across container rebuilds.
#
# `codex exec resume` no longer accepts `-s` (sandbox) or `-C` (cwd) — the
# resumed session inherits both from its persisted state. Passing `-s` makes
# resume error out with `unexpected argument '-s' found`. Use `-c sandbox_mode=...`
# (config-key form) instead, which is accepted by both `codex exec` and
# `codex exec resume` and matches how the codex MCP server is wired in
# container-runner.ts.
CODEX_FLAGS="-c sandbox_mode=danger-full-access --skip-git-repo-check"

extract_thread_id() {
  jq -r '. | (.thread_id // .session_id // empty) | select(. != "")' 2>/dev/null | head -1 || true
}
extract_response() {
  # Prefer item.completed/agent_message (codex 0.124+); fall back to old
  # top-level agent_message/assistant_message events if seen.
  jq -r '
    if (.type == "item.completed" and .item.type == "agent_message") then .item.text
    elif ((.type == "agent_message" or .type == "assistant_message") and .message != null) then .message
    else empty end
  ' 2>/dev/null | tail -1 || true
}

RESUME_FAILED=false
if [ -f "$THREAD" ] && [ -s "$THREAD" ]; then
  THREAD_ID=$(cat "$THREAD")
  log_event "calling-codex-resume"
  RAW=$(printf '%s' "$BATCH_PROMPT" | timeout 120 codex exec resume "$THREAD_ID" \
    $CODEX_FLAGS --json - 2>>"$LOG" || true)
  RESPONSE=$(printf '%s' "$RAW" | extract_response)
  # Empty response on resume → session likely gone (container restart, or
  # codex pruned old session). Codex writes "session not found" to stderr,
  # but the simplest reliable signal is empty extracted text despite a
  # successful exit shape (`|| true` masked any non-zero).
  if [ -z "$(printf '%s' "$RESPONSE" | tr -d '[:space:]')" ]; then
    log_event "resume-empty-fallback-init"
    rm -f "$THREAD"
    RESUME_FAILED=true
  fi
fi
if [ "$RESUME_FAILED" = "true" ] || [ ! -f "$THREAD" ] || [ ! -s "$THREAD" ]; then
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
  RAW=$(printf '%s' "$FIRST_PROMPT" | timeout 180 codex exec \
    $CODEX_FLAGS -C /workspace/agent --json - 2>>"$LOG" || true)
  THREAD_ID=$(printf '%s' "$RAW" | extract_thread_id)
  if [ -n "$THREAD_ID" ]; then
    echo "$THREAD_ID" > "$THREAD"
    log_event "thread-saved"
  fi
  RESPONSE=$(printf '%s' "$RAW" | extract_response)
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
