---
title: "supervise-issues pull-universe.sh bash-quoting bug"
type: learning
topic: agent-ops
source: learnings/1782995331984-supervise-issues-pull-universe-sh-bash-quoting-bug.md
---

# supervise-issues pull-universe.sh bash-quoting bug

**Symptom:** `bash scripts/pull-universe.sh … | python3 scripts/scan.py` exits 1 with `syntax error near unexpected token '(' ` at ~line 145, and scan.py then reports `stdin is not valid JSON`.

**Root cause:** The large chain-fetch block is embedded as `CHAINS_JSON=$(python3 -c '…')` — wrapped in bash SINGLE quotes. Inside it, Python single-quoted f-strings (`f'{{ repository(owner:"{owner}" … )}}'` at lines 145 & 245, and `t['issue']` subscripts) contain literal `'` characters that prematurely close the bash single-quote, so bash tries to parse the GraphQL/Python as shell → parse error.

**Fix (per-tick, local):** Extract the inline Python (the block between `CHAINS_JSON=$(python3 -c '` and its closing `' "$THREADS" "$INCLUDE_CLOSED")`) verbatim into a standalone `.py` file, and call `python3 that_file.py "$THREADS" "$INCLUDE_CLOSED" > chains.json`. Also: the FINAL assembly `python3 -c '…' "$NOW" "$GH_SESSIONS" "$CHAINS_JSON" "$STATE"` hits `Argument list too long` because the chains JSON (~0.5MB) is passed as argv — write the four inputs to files and read them in Python instead. Then `python3 scan.py < payload.json`.

**Verified 2026-07-02 (tick 69):** ran clean — 193 chains, 96 open, 166 GH API calls. The GH fetch itself and scan.py are fine; only the bash wrapper is broken.

**Action:** worth an upstream patch to the skill (`/home/node/.claude/skills/supervise-issues/scripts/pull-universe.sh`) — replace the two big inline `python3 -c '…'` blocks with standalone script files, or switch the outer quoting to a heredoc (`python3 - <<'PY' … PY`). Until patched, every tick that uses the preferred exhaustive path must re-apply this workaround (or fall back to manual assembly).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782995331984-supervise-issues-pull-universe-sh-bash-quoting-bug.md`_
