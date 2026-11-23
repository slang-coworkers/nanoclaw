---
type: reference
name: supervise-tick-helper-history
description: "Per-tick history of the /supervise-issues helper scripts (ticks ~300–382). NEW per-tick helper notes append here — never back into the runbook's step 2, which this narrative regrew to 17 KB (2026-11-20 split)."
metadata:
  node_type: memory
  type: reference
---

# Supervise-tick helper history

Split out of [[orchestrator/supervise-tick-runbook.md]] step 2 on 2026-11-20: the
"latest tick dir" parenthetical had accumulated one nested note per tick and regrew
the runbook past its 16 KB concept cap. The durable rules the narrative produced
(real-tick-number check, pre-state source, disp-overrides reset, harness timeout
rules) live in the runbook; this page keeps the tick-by-tick detail. **New entries
append a `## tick NNN` section at the END of this file**, not the runbook.

## tick 382 (2026-11-20 06:00 gate tick)

tick 382: the 04:00-04:17 session that pre-staged `tick381/` (helpers + fresh
lo-cache/prev-la built from tick380) turned out to BE tick 381 (tracker
`## Tick 381 — 04:30Z`, state saved 04:17), so the 06:00 gate tick started in that
pre-staged dir and had to `mv tick381 tick382` + rename/repoint
`supervisor-state.pre-tickNNN.json` and board274.py mid-tick — **before starting, check
`grep -n "^## Tick" reports/issue-chain-tracker.md | tail -1` for the real tick
number, not the dir name**; the one-tick-stale lo-cache (built from tick380 not
tick381) was harmless — refetch_lo/refetch_none reported fixed 0/failed 0 and
post-tick380 activity surfaced fresh. Both gate nudges (#14645/#14646) were the
maintainer-APPROVE false-positive class (`advisory:maintainer-driving`); #14645's
ci_failed was the wait-for-human-priority yield with `ci-retry-yielded-bot.yml`
re-queueing (workflow lives at `.github/workflows/ci-retry-yielded-bot.yml` — list
by that path, `retry-yielded-bot-ci.yml` matches nothing); auto-merge sweep found
auto-merge ARMED on 2 of our PRs (#14650 approved+BEHIND, #14540
master-merged+checks-green+review-dismissed) — both self-driving, no merge-master
dispatch owed; #14559 closed by jkwak-work's own PR #14561 (he filed+self-assigned;
parked-for-direction flow worked as designed; postmortem marked done, no learning).
Same helpers as tick 380/381, paths repointed.

## tick 380 (and tick 379)

tick 380 = tick379 helpers unchanged, paths repointed; gate nudge (#14617 maintainer
approval→merge) was the comment-edit false-positive class, plus a lo-cache miss on
brand-new #14652's 02:13 build outbound (see
[[orchestrator/supervise-tick-pull-pitfalls.md]]); both dispositioned `advisory:`,
final must_nudge 0; 🆕 #14653 journaled mid-tick via minimal chain record;
board274.py's pre-state path needed repointing to pre-tick380 (it hardcodes the
previous tick); `gh pr list --json` has NO `autoMerge` field — use `autoMergeRequest`.

## tick 357 — opencode harness change

tick 357 = tick356 helpers unchanged; in the opencode bash harness there is **no
`run_in_background` param** — a `setsid nohup … & disown` bgall.sh died silently with
the call's shell (no outer log, no runs.done), so run `bgall.sh` **foreground with an
explicit ≥20-min `timeout`** (~8 min actual); carrying `disp-overrides.json` forward
instead of resetting to {} is harmless — persisted state already carries the old
values, apply_disp re-stamps only on change (rescan delta showed exactly the 2 new
entries' effect).

## tick 350 — pre-state source rule established

tick 350 found ticks 348–349 beyond the written "tick347"; tick 350 = tick 349
helpers unchanged, bg scripts repointed to the new dir; its `budget.py` since-window
was re-dated to 2026-11-17; since tick 341 the **pre-tick state = the previous tick's
FINAL saved state — with sibling Main sessions editing `memory/supervisor-state.json`
mid-hour (tick 350: requeue dispositions at 03:54Z, 87 value diffs vs tick349's
scan-out3), copy `memory/supervisor-state.json`, NOT the previous tick's
`scan-out3.json` `state` key, and diff value fields to confirm which is fresher**
(`state-final.json` is no longer written).

## tick 347 / 346 — background-timeout confirmed

tick347 = tick346 helpers unchanged; tick346/347 also confirmed: a Bash
`run_in_background` call still hits the default 120 s timeout — pass an explicit
`timeout` (e.g. 3600000) or the pull is killed mid-run (tell: `pull.done` absent +
`payload1.json` 0 bytes).

## tick 340 → 324 — helper inventory

- tick340 = tick339 helpers unchanged; its `art-override.json` drops the closed #14259.
- tick339 = tick338 helpers unchanged; its `art-override.json` points #14259 at merged
  #14416 — check carried overrides against PR state, a merged PR still rendered as
  "draft #N" until fixed.
- tick338 = tick337 helpers plus `ghfeeds.sh`, which fetches the issue-comment,
  review-comment, auto-merge (8 pages × slang/rhi/slangpy) and closed-since feeds in
  one GitHub-only run during the pull — reset its `SINCE` and the closed date; feed
  `deliv.py` the union of `comments-since.txt` + `review-comments-since.txt`; a
  relaycheck `NOT-FOUND` can be a window miss, so read the target's first `in` row
  before calling a relay lost.
- tick337 = tick336 helpers unchanged; fetch `prmap.json` with `--limit 10000`, and
  page the auto-merge sweep by hand.
- tick336 = tick335 helpers; `deliv.py` login list adds `minco3`/`NikitaWeW`;
  `lastreq.py` only reads `prod-groups/<folder>/.claude-trace` — **Main's own traces
  are at `/workspace/agent/.claude-trace/`**, so it prints NO TRACE for `main:`
  sessions; read those directly.
- tick335 = tick334 helpers plus `split.py`, which splits `inline_rows.md` into msg2
  (🆕/🔼 + carried up to ~14.5 KB) and msg3 (rest) with deep links stripped.
- tick334 = tick333 helpers unchanged; its `optable.md` is complete (8 rows) —
  tick333's lacked row 7, which had been added to `msg1.md` only, so diff the copied
  table against the last board's operator rows.
- tick333 = tick332 helpers unchanged; tick332 = tick331 helpers unchanged; `deliv.py`
  also reads `prmap.json` — fetch it with `ncl pr-mappings list --limit 10000 --json >
  prmap.json` after the pull (default is 200 rows), it is not copied.
- tick331 = tick330 helpers; `deliv.py` takes a wider maintainer/reporter login list
  and is fed `comments-since.txt` + the repo-wide `pulls/comments?since=`
  review-comment feed (`all-comments.txt`); `relaycheck.py` `T=` is a date to reset
  like `since=`.
- tick330 = tick329 helpers plus `relaycheck.py` and `deliv.py` — blind-spot shape 19,
  lost relays/webhooks; run both after the scan every tick; tick330 split 🔼 rows into
  msg2/msg3 when there are >25.
- tick329 = tick328 helpers unchanged; 3 board parts + the carried rows split in two
  when `rows-car.md` passes ~14 KB.
- tick328 = tick327 helpers unchanged; copy `notes.json` forward but reset
  `nudged.json`/`real-updates.json` to `[]`.
- tick327 = tick326 helpers unchanged; tick327 split the board into
  `rows-n/new/upd/car.md` → msg1–4; tick326 = tick325 helpers plus `rl5xx.py` —
  blind-spot shape 18, gateway 5xx/429 deaths from each trace tail; reset its `since=`
  too; tick326 split the board into `rows-nudged/new/upd/carried.md` → msg1–4.
- tick325: same helpers as tick324; tick325 split the carried rows into
  `msg3a.md`/`msg3b.md` when `msg3s.md` passed 15 KB.
- tick324: same helpers as tick323; its `disp-overrides.json` is the tick-324 set,
  reset it; tick324 split the 🆕/🔼 rows further into `msg2a.md`/`msg2b.md` when
  `msg2.md` passed 15 KB.

## tick 323 → 300 — board splitting and early helpers

- tick323 splits the board with `msg2.md` (🆕/🔼 rows) and `msg3s.md` (carried rows,
  State/Disposition cut at " — ") to stay under ~15 KB each.
- tick321 runs blind-spot shape 16 (reporter self-PRs, timeline cross-refs) by hand;
  its `board274.py` also inlines any row whose `notes.json` next-cell contains ⚠️, so
  a carried operator-blocked `same` row such as #14076 is not collapsed.
- tick316 added `lastreq.py <folder>:<sid> …` (last model-request time + stop reason
  from a coworker's `.claude-trace`, for "is it live?" checks).
- tick315 added `rl429.py` (blind-spot shape 14: sessions killed by a gateway 429
  wave), and blind.py needs `prev-la-blind.json` = `{sid:last_active}` from the
  previous `sessions2.json`; it adds `chainrows.py <n1,n2,…> [rows] [width]` (every
  session on a chain, sub-threads included, with its newest rows — the fastest way to
  verify a flagged batch).
- tick311 added `runstop.py` (blind-spot shape 13: copy the previous tick's
  `sessions2.json` to `prev-sessions2.json` and run it after `blind.py`); its
  `board274.py` also promotes a `same` row listed in `real-updates.json` to 🔼, for
  session-only activity such as a fixer woken by a master merge; `gc_payload.py`
  there builds both GC payloads from `wt-resolved.json`; `moved.py` prints the newest
  row of every session that moved since last tick, which covers the `out`-promise
  shapes blind.py misses.
- tick 300: **Reset `disp-overrides.json` to `{}`** — the copy holds last tick's
  overrides, and `apply_disp.py` would silently re-apply them.

## tick 385 (2026-11-20 18:00 gate tick)

tick385 = tick384 helpers unchanged, paths repointed; gate nudge flag (slangpy-1079) was
a false positive — the triager had answered the maintainer re-check at 16:06Z, ~2 h
before the gate sampled; final must_nudge 0. Two pipeline gotchas: (1) payload3's
`chains` is a **dict keyed by thread_id**, not a list — a list-index guess yields a
0-chain lo-cache (silent; catch it by printing the count); (2) the notes.json demote
pass must end in `json.dump` — a demote that only mutates in memory is lost, and the
stale 🔼 markers resurface in the render (#10232/#13973 this tick, caught at review).
rhi-965 closed by skallweitNV's merged #979 — triage-only chain, postmortem stamped
done/no-learning into its `_archived` entry (#14559 precedent).

- **tick 386:** `deliv.py` who-filter gained `lujinwangnv` + `saipraveenb25` (lujinwangnv's 18:24Z #14474 comment was skipped by the sweep — delivery verified manually via the bot's 18:25Z timeline answer). `ghfeeds.sh` am-sweep cross-check is authoritative over `gh pr list --json autoMergeRequest` (the one-off query missed 5 of the 6 armed PRs).
