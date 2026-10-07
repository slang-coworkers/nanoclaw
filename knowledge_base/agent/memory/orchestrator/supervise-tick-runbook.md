---
type: runbook
description: Fast path for a /supervise-issues tick — use the patched pull script, not the stock one; verification habits that keep must_nudge honest
---

# /supervise-issues tick runbook (learned ticks 255–260)

**Don't run the stock `scripts/pull-universe.sh` as is.** Its step 1b calls
`ncl cost-cap status` once per gh-issue session. That is ~1.2 s × ~4,100 sessions ≈ 80 min.
Tick 257 lost 13 min to it before killing it.

**Fast path (tick 256/257, ~20 min total):**
1. In a fresh `tickNNN/` dir, fetch the inputs once, serially (concurrent `ncl` calls hit "database is locked"):
   `ncl sessions list --limit 10000 --json > sessions.json`, `ncl groups list --json > groups.json`,
   `ncl cost-cap stopped --json > stopped.json`.
2. Copy the patched `pull.sh` + helpers from the previous tick dir (latest: `/workspace/agent/tick267/`; repoint `titles.py` to payload4.json and `sed` any `tickNNN` paths).
   It reads those three files via `SESSIONS_FILE` / `GROUPS_FILE` / `STOPPED_FILE` env vars and
   stops reading outbound once it reaches sessions older than the newest outbound found so far.
   The cost result is exact: it uses the same predicate as the dashboard.
3. `prfix.py payload1.json payload2.json` (live fix/issue-N PR over a CLOSED first cross-ref), then
   `botprs.py` + `botbind.py payload2.json payload2b.json` (bind via closingIssuesReferences), then
   `apply_disp.py payload2b.json payload3.json` (this tick's verified dispositions from
   `disp-overrides.json`), then `scan.py`. `apply_disp.py` must NOT create state keys for chains that
   have none, or brand-new chains lose their 🆕 delta.
4. In parallel: `runs.py` → `ci.py` (CI cells) and `titles.py`; `gc/gc_resolve.py` → `worktree-gc.py`.
5. Verify every `action=nudge` / `escalate` row against GitHub and transcripts before acting.
   Record a disposition for each false positive in the payload, then re-run scan so state persists.
6. `board256.py` (notes.json / nudged.json / real-updates.json / art-override.json) → tracker rows + inline board.

**Recurring false-positive shapes:**
- Bot-filed follow-up issues whose only session is Main's. A nudge would go back to me.
  Record `advisory:maintainer-driving` or `triaged:awaiting-pickup`.
- A human PR author reclaiming their PR ("picking it back up").
- `watch:` / `handed-off:` dispositions aren't tokens scan.py recognizes. Re-tokenize to `advisory:…`.

**Recurring REAL shape (tick 264):** a round-2 `[Fix Review Request]` lands in a slang-reviewer session whose
container then stops without processing it. scan.py flags the chain `awaiting_us` against the *fixer*, but the
stalled tier is the reviewer. Check the reviewer session's newest row: an unanswered `in` after its last `out`
means nudge **slang-reviewer** (pinned `target_session_id`), not the fixer.

**Sending a nudge:** a thread-keyed `send_message` can be refused with "without in_reply_to … has received messages
on it". Pin it with `target_session_id=<owning session>` instead, then read the recipient's rows to confirm
`direction=in` arrived.

**Never end the turn while the pull is still running.** Tick 259 (2026-10-03 00:00Z) said "I'll continue when
the monitor fires" and ended its turn. A cron session that yields has no follow-up turn, so it never posted
a board or wrote state. Wait for the pull inside the turn instead (a foreground `until [ -f pull.done ]` loop,
≤10 min per call). Tick 260 caught it because `_meta.tick` was still 258 and the 00:00Z tick dir had no
`board-msg.md`.

**pull.sh drops last-outbound (tick 267, 2026-10-07):** `ncl sessions messages` was fast again (~1.5 s), but pull.sh still returned `our_last_outbound=None` for 31 of the 53 open chains it re-fetched. 72 more carried a stale `None` in the cache. Run `tick267/refetch_lo.py` and `refetch_none.py` (retrying, 90 s timeout) on payload1 before prfix, then fix naive `YYYY-MM-DD HH:MM:SS` stamps to ISO `Z`. Also re-list sessions just before the final scan: a chain can get its first session mid-tick (#13469/#13470).

**Scan blind spot (tick 267):** a PR-bearing chain where a human `@bot` asks for work, the bot posts "On it", and then the owning container stops. The bot spoke last, so scan.py says `awaiting_human`. Detector: the owning session's newest row is an `in` webhook with no `out` after it, and the PR head hasn't moved. That was #12875: a 9 h stall, and the fixer had lost context.

**Slow `ncl sessions messages` (tick 266, 2026-10-06):** each call took ~30 s, and some hit the 30 s ncl timeout, so the stock outbound pass would take hours. Fix: in `tick266/pull.sh`, `LO_CACHE` and `PREV_LA` env vars reuse the previous tick's `our_last_outbound` and `last_outbound_text` for any chain whose session set and per-session `last_active` are unchanged. Build `lo-cache.json` from the previous `payload1.json` and `prev-la.json` from the previous `sessions.json`. Only about 15 of 4,234 sessions changed between ticks, so the pull took 6 min. Also filter `wt-dirs.txt` to drop submodule `.git` files (gitdir containing `/modules/`, e.g. slangpy `data`/`samples`).
