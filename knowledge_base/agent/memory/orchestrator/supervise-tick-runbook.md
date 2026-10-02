---
type: runbook
description: Fast path for a /supervise-issues tick — use the patched pull script, not the stock one; verification habits that keep must_nudge honest
---

# /supervise-issues tick runbook (learned ticks 255–257)

**Don't run the stock `scripts/pull-universe.sh` as is.** Its step 1b calls
`ncl cost-cap status` once per gh-issue session. That is ~1.2 s × ~4,100 sessions ≈ 80 min.
Tick 257 lost 13 min to it before killing it.

**Fast path (tick 256/257, ~20 min total):**
1. In a fresh `tickNNN/` dir, fetch the inputs once, serially (concurrent `ncl` calls hit "database is locked"):
   `ncl sessions list --limit 10000 --json > sessions.json`, `ncl groups list --json > groups.json`,
   `ncl cost-cap stopped --json > stopped.json`.
2. Copy the patched `pull.sh` from the previous tick dir (latest: `/workspace/agent/tick257/pull.sh`).
   It reads those three files via `SESSIONS_FILE` / `GROUPS_FILE` / `STOPPED_FILE` env vars and
   stops reading outbound once it reaches sessions older than the newest outbound found so far.
   The cost result is exact: it uses the same predicate as the dashboard.
3. `prfix.py universe.json payload.json`: prefers a live fix/issue-N PR over a CLOSED first cross-ref.
   Then run `scan.py`.
4. In parallel: `runs.py` → `ci.py` (CI cells) and `titles.py`; `gc/gc_resolve.py` → `worktree-gc.py`.
5. Verify every `action=nudge` / `escalate` row against GitHub and transcripts before acting.
   Record a disposition for each false positive in the payload, then re-run scan so state persists.
6. `board256.py` (notes.json / nudged.json / real-updates.json / art-override.json) → tracker rows + inline board.

**Recurring false-positive shapes:**
- Bot-filed follow-up issues whose only session is Main's. A nudge would go back to me.
  Record `advisory:maintainer-driving` or `triaged:awaiting-pickup`.
- A human PR author reclaiming their PR ("picking it back up").
- `watch:` / `handed-off:` dispositions aren't tokens scan.py recognizes. Re-tokenize to `advisory:…`.

**Sending a nudge:** a thread-keyed `send_message` can be refused with "without in_reply_to … has received messages
on it". Pin it with `target_session_id=<owning session>` instead, then read the recipient's rows to confirm
`direction=in` arrived.
