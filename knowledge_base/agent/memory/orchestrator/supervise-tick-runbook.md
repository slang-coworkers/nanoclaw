---
type: runbook
description: Fast path for a /supervise-issues tick — read FIRST, before SKILL.md. Use the cached tickNNN/pull.sh (never the stock pull-universe.sh), the helper pipeline, and delivery/turn discipline. Pitfalls and degraded-tick procedures live in linked sibling pages (split 2026-10-13, again 2026-10-18).
---

# /supervise-issues tick runbook (learned ticks 255–290)

**This runbook overrides SKILL.md's "use `scripts/pull-universe.sh` (preferred)".** Never launch the stock
script: its step 1b calls `ncl cost-cap status` once per gh-issue session (~1.2–2 s × ~4,100 sessions ≈ 80 min–2.4 h),
and it has no outbound cache. Ticks 257, 272, 273 and 274 each lost 4–35 min by starting there (274 because this page
was only linked from the orchestrator index — hence the Core Memory pointer). A one-call `cost-cap stopped` patch
without the outbound cache (`tick274/pull-universe-fast.sh`) still took 53 min. The cached `tickNNN/pull.sh` takes ~4–6 min.
A clean tick runs ~20–30 min end to end.

Companion pages:
- [[orchestrator/supervise-tick-pull-pitfalls.md]] — pull/cache, state, CI-cell, GitHub-API and worktree-GC pitfalls.
- [[orchestrator/supervise-tick-degraded.md]] — probe first; what to do on a credential 401 or `ncl` congestion.
- [[orchestrator/supervise-tick-false-positives.md]] (rows scan flags that aren't real) and
  [[orchestrator/supervise-tick-blind-spots.md]] (real stalls scan misses).
- Delivery rule: [[project_supervise_tick_no_cc_discord.md]].

New tick lessons go into the matching sibling page (or update a step here) — never a new "Tick NNN notes" section,
which is what regrew this page to 15 KB by tick 290.

## Fast path

0. Probe GitHub and `ncl` health before pulling ([[orchestrator/supervise-tick-degraded.md]]).
1. New `tickNNN/` dir. Fetch inputs once, **serially** (concurrent `ncl` → "database is locked"):
   `ncl sessions list --limit 20000 --json > sessions.json` (tick 340: 9,968 rows, so `--limit 10000` is about to truncate — check the row count is below the limit), `ncl groups list --json > groups.json`,
   `ncl cost-cap stopped --json > stopped.json`.
2. Copy helpers (`*.py *.sh`, plus `escalate-list.json`, `art-override.json` AND `disp-overrides.json` + `notes.json` + `nudged.json` (reset to `[]` after copying) + `real-updates.json` (recompute, see step 7) — apply_disp.py **crashes** without disp-overrides.json, tick 375) from the latest tick dir (**latest: `/workspace/agent/tick377/`** — tick 377 = tick376 helpers unchanged, paths repointed; its 3 gate nudge rows (#10164/#14645/#14646) were all genuine — #14645/#14646 new triaged dispatches with no fixer outbound, #10164 tangent-vector approved option (2) on PR #14636 at 00:02:44Z (after the pull); auto-merge sweep found our armed #14628 BEHIND → fixer merge-master nudged; two hand-paste typos in the chat board needed an inline correction (keep pasting from split.py output, cell by cell); **the pointer here goes stale: confirm with `ls -d /workspace/agent/tick*/ | sort -V | tail -1` first**)    (tick 376 = tick375 helpers unchanged, paths repointed; its two gate flags (#10164/#14617 maintainer approvals) were both genuine nudge rows, and the 6b auto-merge sweep found two of OUR armed PRs stuck: #14636 BEHIND / #14621 DIRTY, both fixer-nudged to merge master; #13845 postmortem captured + supersede-closed our draft #13816; **the pointer here goes stale: confirm with `ls -d /workspace/agent/tick*/ | sort -V | tail -1` first**)    (tick 357 = tick356 helpers unchanged; in the opencode bash harness there is **no `run_in_background` param** — a `setsid nohup … & disown` bgall.sh died silently with the call's shell (no outer log, no runs.done), so run `bgall.sh` **foreground with an explicit ≥20-min `timeout`** (~8 min actual); carrying `disp-overrides.json` forward instead of resetting to {} is harmless — persisted state already carries the old values, apply_disp re-stamps only on change (rescan delta showed exactly the 2 new entries' effect); tick 350 found ticks 348–349 beyond the written "tick347"; tick 350 = tick 349 helpers unchanged, bg scripts repointed to the new dir; its `budget.py` since-window was re-dated to 2026-11-17; since tick 341 the **pre-tick state = the previous tick's FINAL saved state — with sibling Main sessions editing `memory/supervisor-state.json` mid-hour (tick 350: requeue dispositions at 03:54Z, 87 value diffs vs tick349's scan-out3), copy `memory/supervisor-state.json`, NOT the previous tick's `scan-out3.json` `state` key, and diff value fields to confirm which is fresher** (`state-final.json` is no longer written); tick347 = tick346 helpers unchanged; tick346/347 also confirmed: a Bash `run_in_background` call still hits the default 120 s timeout — pass an explicit `timeout` (e.g. 3600000) or the pull is killed mid-run (tell: `pull.done` absent + `payload1.json` 0 bytes) (tick340 = tick339 helpers unchanged; its `art-override.json` drops the closed #14259; tick339 = tick338 helpers unchanged; its `art-override.json` points #14259 at merged #14416 — check carried overrides against PR state, a merged PR still rendered as "draft #N" until fixed; tick338 = tick337 helpers plus `ghfeeds.sh`, which fetches the issue-comment, review-comment, auto-merge (8 pages × slang/rhi/slangpy) and closed-since feeds in one GitHub-only run during the pull — reset its `SINCE` and the closed date; feed `deliv.py` the union of `comments-since.txt` + `review-comments-since.txt`; a relaycheck `NOT-FOUND` can be a window miss, so read the target's first `in` row before calling a relay lost; tick337 = tick336 helpers unchanged; fetch `prmap.json` with `--limit 10000`, and page the auto-merge sweep by hand; tick336 = tick335 helpers; `deliv.py` login list adds `minco3`/`NikitaWeW`; `lastreq.py` only reads `prod-groups/<folder>/.claude-trace` — **Main's own traces are at `/workspace/agent/.claude-trace/`**, so it prints NO TRACE for `main:` sessions; read those directly; tick335 = tick334 helpers plus `split.py`, which splits `inline_rows.md` into msg2 (🆕/🔼 + carried up to ~14.5 KB) and msg3 (rest) with deep links stripped; tick334 = tick333 helpers unchanged; its `optable.md` is complete (8 rows) — tick333's lacked row 7, which had been added to `msg1.md` only, so diff the copied table against the last board's operator rows; tick333 = tick332 helpers unchanged; tick332 = tick331 helpers unchanged; `deliv.py` also reads `prmap.json` — fetch it with `ncl pr-mappings list --limit 10000 --json > prmap.json` after the pull (default is 200 rows), it is not copied; tick331 = tick330 helpers; `deliv.py` takes a wider maintainer/reporter login list and is fed `comments-since.txt` + the repo-wide `pulls/comments?since=` review-comment feed (`all-comments.txt`); `relaycheck.py` `T=` is a date to reset like `since=`; tick330 = tick329 helpers plus `relaycheck.py` and `deliv.py` — blind-spot shape 19, lost relays/webhooks; run both after the scan every tick; tick330 split 🔼 rows into msg2/msg3 when there are >25; tick329 = tick328 helpers unchanged; 3 board parts + the carried rows split in two when `rows-car.md` passes ~14 KB; tick328 = tick327 helpers unchanged; copy `notes.json` forward but reset `nudged.json`/`real-updates.json` to `[]`; tick327 tick326 helpers unchanged; tick327 split the board into `rows-n/new/upd/car.md` → msg1–4; tick326 = tick325 helpers plus `rl5xx.py` — blind-spot shape 18, gateway 5xx/429 deaths from each trace tail; reset its `since=` too; tick326 split the board into `rows-nudged/new/upd/carried.md` → msg1–4; tick325: same helpers as tick324; tick325 split the carried rows into `msg3a.md`/`msg3b.md` when `msg3s.md` passed 15 KB; tick324: same helpers as tick323; its `disp-overrides.json` is the tick-324 set, reset it; tick324 split the 🆕/🔼 rows further into `msg2a.md`/`msg2b.md` when `msg2.md` passed 15 KB); tick323 splits the board with `msg2.md` (🆕/🔼 rows) and `msg3s.md` (carried rows, State/Disposition cut at " — ") to stay under ~15 KB each; tick321 runs blind-spot shape 16 (reporter self-PRs, timeline cross-refs) by hand; its `board274.py` also inlines any row whose `notes.json` next-cell contains ⚠️, so a carried operator-blocked `same` row such as #14076 is not collapsed; tick316 added `lastreq.py <folder>:<sid> …` (last model-request time + stop reason from a coworker's `.claude-trace`, for "is it live?" checks); tick315 added `rl429.py` (blind-spot shape 14: sessions killed by a gateway 429 wave), and blind.py needs `prev-la-blind.json` = `{sid:last_active}` from the previous `sessions2.json`; it adds `chainrows.py <n1,n2,…> [rows] [width]` (every session on a chain, sub-threads included, with its newest rows — the fastest way to verify a flagged batch); tick311 added `runstop.py` (blind-spot shape 13: copy the previous tick's `sessions2.json` to `prev-sessions2.json` and run it after `blind.py`); its `board274.py` also promotes a `same` row listed in `real-updates.json` to 🔼, for session-only activity such as a fixer woken by a master merge; `gc_payload.py` there builds both GC payloads from `wt-resolved.json`; `moved.py` prints the newest row of every session that moved since last tick, which covers the `out`-promise shapes blind.py misses) and `sed` every `tickNNN` path. Also reset the hardcoded `since=` in `killed.py`/`budget.py`/`rl429.py` to the previous tick's start — it is a date, not a tick path, so the `sed` misses it. **Reset `disp-overrides.json` to `{}`** — the copy holds last tick's overrides, and `apply_disp.py` would silently re-apply them (tick 300).
   `board274.py` hardcodes `supervisor-state.pre-tickNNN.json`; repoint `titles.py` to payload5.json.
   Build `lo-cache.json` from the **previous `payload3.json`** (not payload1, so last tick's re-fetch fixes carry
   forward) and `prev-la.json` from the previous `sessions.json`. Run `pull.sh` with env
   `SESSIONS_FILE GROUPS_FILE STOPPED_FILE LO_CACHE PREV_LA` and args `--state supervisor-state.pre-tickNNN.json --include-closed > payload1.json 2> pull.err`
   (lo-cache = `{key:{ts,text,sess}}` from prev payload3 chains — **include EVERY chain, also `ts: null` ones (tick 375 recurrence: a null-filtered cache made the pull run ~2 s/chain, 440/2551 in 15 min before a timeout; the all-chains cache finishes in ~3 min)** — `ts`/`text`/`sess` come from each chain's `our_last_outbound`/`last_outbound_text`/**`sessions`** fields (a wrong field name gives empty `sess` and silently disables the cache); prev-la = `{sid:last_active}` from prev `sessions2.json`); it reuses `our_last_outbound`/`last_outbound_text` for any
   chain whose session set and per-session `last_active` are unchanged (typically ~15 of ~4,200 sessions change).
   Its cost result uses the dashboard's own predicate, so it is exact.
3. On payload1: `refetch_lo.py payload1.json payload1b.json` + `refetch_none.py payload1b.json payload1c.json`
   (retrying, 90 s timeout; both need the output arg), then normalize naive `YYYY-MM-DD HH:MM:SS` stamps to ISO `Z`.
4. `prfix.py payload1.json payload2.json` (live `fix/issue-N` PR over a CLOSED first cross-ref) →
   `botprs.py` + **`botbind.py payload2.json payload2b.json`** (bind via closingIssuesReferences; not optional — without
   it `dev/slangpy-fixer/*` and reused `fix/issue-<other>` branches read as fixer-owned with no PR) →
   `apply_disp.py payload2b.json payload3.json` (verified dispositions from `disp-overrides.json`; it must NOT create
   state keys for chains that have none, or new chains lose their 🆕 delta) → `scan.py`. With empty overrides,
   `payload5 = payload3` and `scan-out3 = scan-out1`; the renderer reads both names.
5. **After** step 4's scan (`ci.py` reads `scan-out3.json`), in parallel: `runs.py` → `ci.py` (CI cells) and
   `titles.py`; `gc_resolve.py` → `worktree-gc.py`. **Launch them with Bash `run_in_background: true`, not `( … ) &`
   inside a foreground call** — tick 282's `&`-detached runs died with that call's shell (~10 min lost). Verify
   `ci.done` + `ci.json` exist before rendering. scan.py and worktree-gc.py live at
   `/home/node/.claude/skills/supervise-issues/scripts/` (scan reads stdin: `scan.py < payload3.json`).
6. Re-list sessions just before the final scan (a chain can get its first session mid-tick, e.g. #13469/#13470).
   Verify **every** `action=nudge`/`escalate` row against GitHub and transcripts; record a disposition for each false
   positive (tokens scan.py recognizes are `advisory:…`; re-tokenize `watch:`/`handed-off:`), then re-run scan so state
   persists, and re-add every pre-tick key the scan omitted (closed chains drop out).
6b. **Auto-merge sweep (every tick):** list open PRs with `auto_merge` armed and check `mergeable_state` — an approved
   bot PR that's `dirty`/`behind` never merges and scan can't see it ([[orchestrator/supervise-tick-blind-spots.md]]
   shapes 7–8).
7. Render with `board274.py` (notes.json / nudged.json / real-updates.json / art-override.json). Write `notes.json` and
   `real-updates.json` for every 🔼 row after checking GitHub. **Compose the chat parts by splitting the RENDERED
   `inline_rows.md` (see `split.py`) — never retype rows by hand**: tick 357's hand-typed parts dropped 14 rendered rows
   and added 3 unrendered ones (accurate text, off-tracker), forcing a 3rd "correction" message to satisfy R7's
   verbatim rule. **The paste is the step (tick 362 recurrence): after `split.py`, read msg2.md/msg3.md and copy the
   file contents byte-for-byte into each `send_message` text — do not compose the message from memory of the rows or
   from notes.json; even "accurate" paraphrase drops rows (tick 362 msg 54063 lost 15 of 31 rows and was re-sent
   verbatim as msg 54065).** **End-of-tick guard (tick 349, 2026-11-17): after saving
   `memory/supervisor-state.json`, assert its `_meta.tick` equals the tick you just completed — tick 347 finished its
   board but never saved state (memory stayed at tick-346 keys until tick 349 caught the drift; a stale `_meta.tick`
   means the whole save step was skipped, not a partial write).** **`notes.json` carries forward, so first demote every
   untouched entry whose next-cell starts 🆕/🔼 to `•`** (each value is a `[status, next]` list, so test `v[1][:1]`; a `v.get(...)` check silently finds 0) — board274 inlines on that prefix, and tick 328 rendered 24
   "new" / 43 "updated" rows (really 14 / 21) until it did. Strip dashboard deep-links from the inline chat board to
   stay under ~16 KB; the tracker file keeps them.

## Delivery and turn discipline

- **Send the board mid-turn with `send_message(to="orchestrator-dashboard")`.** A final-response `<message>` block from
  the cron session came back `undelivered_message` (tick 272).
- **Never end the turn while the pull is running.** A cron session that yields has no follow-up turn (tick 259 never
  posted or wrote state; caught when `_meta.tick` was still stale). Wait in-turn with a foreground
  `until [ -f pull.done ]` loop (≤10 min per call). `gh` `sleep N; cmd` chains are blocked by the harness — just run the check.
- **Nudges:** a thread-keyed `send_message` can be refused ("without in_reply_to … has received messages on it"). Pin
  `target_session_id=<owning session>` first; if it is STILL refused naming unresponded inbound rows (`#<id>, #<id>`),
  resend with `in_reply_to=<the newest named row>` — that cleared it and routed correctly (tick 376, gh-issue-…-14617).
  Then confirm the `direction=in` landed — by `last_active` moving or by
  sorting rows on `timestamp`, since `ncl sessions messages --reverse` orders by seq (a fresh nudge took seq 10 below
  seq 17, tick 288). Re-read the issue's comments immediately before sending — a triager that posts after the pull
  reads as `silent` (the #13555 nudge landed 9 min after the triage comment; recurred tick 376: the #10164 fixer
  self-handled the maintainer approval at 19:06Z, 3 min before the 19:09Z nudge).
- When a closed chain still has a recurring resume trigger (e.g. `recheck-slang-<n>`), pause it.
- The board quotes `[Resolution]` from status text, which trips the codex-gate audit line; benign here.
