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
2. Copy the patched `pull.sh` + helpers from the previous tick dir (latest: `/workspace/agent/tick273/`; repoint `titles.py` to payload4.json and `sed` any `tickNNN` paths).
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

**Go straight to the cached pull (tick 268, 2026-10-07):** the stock skill `pull-universe.sh` has no outbound cache and passed 600 s without finishing, while the cached `tickNNN/pull.sh` (env `SESSIONS_FILE GROUPS_FILE STOPPED_FILE LO_CACHE PREV_LA`) finished in about 6 min. Build `lo-cache.json` from the previous `payload3.json`, not payload1, so that last tick's re-fetch fixes carry forward. scan.py's `silent` flags on bot-filed follow-ups with 0 comments are usually false positives: check the assignee (assigned to a human → `advisory:maintainer-driving`) and any gated dispatch task before nudging.

**pull.sh drops last-outbound (tick 267, 2026-10-07):** `ncl sessions messages` was fast again (~1.5 s), but pull.sh still returned `our_last_outbound=None` for 31 of the 53 open chains it re-fetched. 72 more carried a stale `None` in the cache. Run `tick267/refetch_lo.py` and `refetch_none.py` (retrying, 90 s timeout) on payload1 before prfix, then fix naive `YYYY-MM-DD HH:MM:SS` stamps to ISO `Z`. Also re-list sessions just before the final scan: a chain can get its first session mid-tick (#13469/#13470).

**Scan blind spot (tick 267):** a PR-bearing chain where a human `@bot` asks for work, the bot posts "On it", and then the owning container stops. The bot spoke last, so scan.py says `awaiting_human`. Detector: the owning session's newest row is an `in` webhook with no `out` after it, and the PR head hasn't moved. That was #12875: a 9 h stall, and the fixer had lost context.

**Slow `ncl sessions messages` (tick 266, 2026-10-06):** each call took ~30 s, and some hit the 30 s ncl timeout, so the stock outbound pass would take hours. Fix: in `tick266/pull.sh`, `LO_CACHE` and `PREV_LA` env vars reuse the previous tick's `our_last_outbound` and `last_outbound_text` for any chain whose session set and per-session `last_active` are unchanged. Build `lo-cache.json` from the previous `payload1.json` and `prev-la.json` from the previous `sessions.json`. Only about 15 of 4,234 sessions changed between ticks, so the pull took 6 min. Also filter `wt-dirs.txt` to drop submodule `.git` files (gitdir containing `/modules/`, e.g. slangpy `data`/`samples`).

**refetch_lo.py must compare SORTED session lists (tick 269, 2026-10-08):** the copied `refetch_lo.py` compared `lo[t]['sess']` (pull order) to `sorted(ss)`, so 503 unchanged chains looked changed. It re-fetched 530 chains instead of 27 and hit the 590 s timeout. Fixed in `tick269/refetch_lo.py` (`sorted(lo[t]['sess'] or [])`). Also: scan's `delta=updated` counts last-outbound stamps that the cache refresh moved backwards in time (59 raw → 20 real). Filter real updates by activity after the previous pull's start time (`real-why.json`). False-positive shape: brand-new chains whose fixer acked `[Ack — HELD]` while a maintainer self-assigned → `advisory:maintainer-driving`.

**Tick 270 (2026-10-08 12:00Z), about 50 min end to end:** the stock `pull-universe.sh` still produced no output after 10 min, so go straight to the cached `tickNNN/pull.sh`, which finished in 4 min. With `refetch_lo.py` sorted, only 19 chains needed a re-fetch and it finished instantly. Two false-positive shapes again:
- **Silent with zero activity by us, Main-only session:** a bot-filed follow-up that is unrouted by design. Record `advisory:unrouted-bot-filed`.
- **Human-last, a maintainer APPROVED and flipped ready:** no ask of the bot, so it is not owed a reply. Record `advisory:maintainer-driving`.

A triage that posts between the pull and the scan reads as `silent`. Re-check the issue's last comment before nudging. When a closed chain still has a recurring resume trigger (e.g. `recheck-slang-<n>`), pause it.

**pull.sh cache key must compare SORTED lists (tick 271, 2026-10-09):** `pull.sh:594` compared `_c["sess"]` (pull order, as stored in lo-cache from payload3) to `sorted(sess_ids)`. Nearly every chain missed the cache, so the pull hit its 1,500 s timeout at 1800/1876. Fixed in `tick271/pull.sh` (`sorted(_c["sess"] or [])`), and the rerun finished in about 5 min. This is the same bug as tick 269's `refetch_lo.py`. If a pull is still at <50% after 5 min, check the cache hit rate before waiting it out. The board quotes `[Resolution]` from status text, which trips the codex-gate audit line. That's benign for the supervisor board.

**Read this runbook before the first command (tick 272, 2026-10-09 12:00Z).** Tick 272 started the stock `pull-universe.sh` and lost about 4 min before switching to `tick271/pull.sh`. Once switched, it ran end to end in about 30 min with no cache bug. The cost-notice target is the PR the stopped reviewer was reviewing, which can differ from the chain's own PR: the #13489 chain's PR is #13502, but its reviewer was working on #13514. Read the stopped session's newest inbound `[Fix Review Request]` to find it. The final `<message>` board was not delivered from the cron session ("undelivered_message"). Send the board with `send_message(to="orchestrator-dashboard")` mid-turn instead of relying on the final-response block.

**Tick 273 (2026-10-10 00:00Z), ~75 min; it lost 12 min to the stock pull AGAIN.** The task prompt says "follow SKILL.md", and SKILL.md says "use `scripts/pull-universe.sh` (preferred)". **This runbook overrides that. Never launch the stock script; go straight to `tickNNN/pull.sh`**, which took about 5 min. Lessons from this tick:
- **`needs_cost_notice` false re-arm:** scan sets it whenever `delta != same`. A PR merge or a moved activity stamp on a chain that is still cost-stopped re-arms it even though it's the same pending episode. Check `ncl cost-cap escalations --group <folder>` for the same `pending` row and a live `costNoticeUrl` in state; if both hold, don't re-post.
- **Nudge race:** a triager that posts after the pull reads as `silent`. Re-read the issue's comments immediately before sending. The #13555 nudge landed 9 min after the triage comment.
- **The board renderer is `tick273/board273.py`** (board260 with the paths repointed). Strip the dashboard deep-links from the inline chat board to keep it under ~16 KB; the tracker file keeps them.
