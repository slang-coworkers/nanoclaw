---
type: reference
name: supervise-tick-helper-history
description: "Per-tick history of the /supervise-issues helper scripts (ticks ~300–401). NEW per-tick notes append a `## tick NNN` section at the END of this file — never back into the runbook's step 2. Durable pipeline gotchas go to the tick-pitfalls/ stage files, not here."
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
append a `## tick NNN` section at the END of this file**, not the runbook; a
pipeline gotcha discovered in a tick goes to the matching
[[orchestrator/tick-pitfalls/index.md]] stage file instead. Trimmed 2026-11-25
(regrown past 12 KB): gotchas from ticks 385–401 moved to the stage files, and
the pre-340 helper inventory was compressed.

## tick 401 (2026-11-24 09:00 full-pass tick)

tick401 = tick400 helpers unchanged, paths repointed, since= reset to
2026-11-23T20:00Z (tick400's start). Clean tick: 🆕 slang#14703 (triaged in
minutes), 4 🔼, must_nudge 0 = 0 sent; 22 escalates unchanged (retro-wave
family); cost_stopped 14589 unchanged, no repeat notice. slang#14415 archived
(maintainer close, "Thanks for confirming!" — no reply owed). 14691
re-dispositioned `stood-down` via disp-overrides after verifying the fixer's
20:14:23Z close-out comment + worktree disposal. Runbook's "latest tick dir"
pointer advanced tick398 → tick401. The `nohup … &` background-launch death bit
again before the pull (0-byte payload1, no pull.done — the tick-357 shape);
foreground re-run with a 900 s timeout finished in ~4 min. One chat-paste typo
("side side" in the #14166 State cell) corrected in the same delivery with a
one-line errata; tracker file was correct.

## tick 398 (2026-11-23 11:00 gate tick)

tick397 helpers unchanged, paths repointed, since= reset to 08:16. Gate nudge
flag (slang-14697) was a false positive of the documented side-finding shape —
#14697 is the #13262/#14696 chain's own bot filing (repro + root cause in body);
dispositioned `advisory` filed-only per filing policy, no triage fan-out. Final
must_nudge 0. Runbook's "latest tick dir" pointer advanced tick383 → tick398 (it
had gone stale at tick383).

## tick 396

botprs.py two-writers gotcha and the ghfeeds-vs-probe armed-PR count
(7 armed vs 3 from the one-off probe) →
[[orchestrator/tick-pitfalls/plumbing.md]] and
[[orchestrator/tick-pitfalls/github-api.md]].

## tick 386

deliv.py who-filter gained `lujinwangnv` + `saipraveenb25` (lujinwangnv's 18:24Z
#14474 comment was skipped by the sweep — delivery verified manually via the
bot's 18:25Z timeline answer); ghfeeds am-sweep authoritative over the one-off
`gh pr list --json autoMergeRequest` probe (missed 5 of the 6 armed PRs) →
[[orchestrator/tick-pitfalls/plumbing.md]], [[orchestrator/tick-pitfalls/github-api.md]].

## tick 385 (2026-11-20 18:00 gate tick)

tick385 = tick384 helpers unchanged, paths repointed. Gate nudge flag
(slangpy-1079) was a false positive — the triager had answered the maintainer
re-check at 16:06Z, ~2 h before the gate sampled; final must_nudge 0. The
payload3-dict and notes.json-demote gotchas →
[[orchestrator/tick-pitfalls/pull-cache.md]], [[orchestrator/tick-pitfalls/state-merge.md]].
rhi-965 closed by skallweitNV's merged #979 — triage-only chain, postmortem
stamped done/no-learning into its `_archived` entry (#14559 precedent).

## tick 382 (2026-11-20 06:00 gate tick)

The 04:00-04:17 pre-staging session turned out to BE tick 381, so the gate tick
started in a pre-staged dir and had to `mv tick381 tick382` + repoint
`supervisor-state.pre-tickNNN.json` and board274.py mid-tick — **check the
tracker for the real tick number, not the dir name** (rule lives in the
runbook). The one-tick-stale lo-cache was harmless (refetch fixed 0/failed 0).
Gate nudges (#14645/#14646) were the maintainer-APPROVE false-positive class;
#14645's ci_failed was the wait-for-human-priority yield re-queued by
`.github/workflows/ci-retry-yielded-bot.yml` (list by that path;
`retry-yielded-bot-ci.yml` matches nothing). Auto-merge sweep found auto-merge
ARMED on 2 of our PRs (#14650 approved+BEHIND, #14540
master-merged+checks-green+review-dismissed) — both self-driving, no
merge-master dispatch owed. #14559 closed by jkwak-work's own PR #14561
(he filed+self-assigned; parked-for-direction flow worked as designed;
postmortem done, no learning).

## tick 380 (and tick 379)

tick380 = tick379 helpers unchanged, paths repointed; board274.py pre-state path
repointed (it hardcodes the previous tick). #14617 gate nudge = comment-edit
false-positive class; lo-cache miss on brand-new #14652's 02:13 build outbound
([[orchestrator/tick-pitfalls/state-merge.md]]); 🆕 #14653 journaled mid-tick
via minimal chain record. `gh pr list --json` has NO `autoMerge` field — use
`autoMergeRequest`.

## tick 357 — opencode harness change

No `run_in_background` param in the opencode bash harness; a `setsid nohup … &
disown` bgall.sh died silently with the call's shell — run bgall.sh foreground
with an explicit ≥20-min timeout (~8 min actual). Carrying `disp-overrides.json`
forward instead of resetting to {} is harmless — persisted state already
carries the old values, apply_disp re-stamps only on change (rescan delta
showed exactly the 2 new entries' effect). → [[orchestrator/tick-pitfalls/plumbing.md]]

## tick 350 — pre-state source rule established

Since tick 341 the pre-tick state = the previous tick's FINAL saved state —
with sibling Main sessions editing `memory/supervisor-state.json` mid-hour
(tick 350: requeue dispositions at 03:54Z, 87 value diffs vs tick349's
scan-out3), copy `memory/supervisor-state.json`, NOT the previous tick's
`scan-out3.json` `state` key, and diff value fields to confirm which is fresher
(`state-final.json` no longer written). Its budget.py since-window was re-dated
to 2026-11-17.

## tick 347 / 346 — background-timeout confirmed

A Bash `run_in_background` call still hits the default 120 s timeout — pass an
explicit `timeout` or the pull is killed mid-run (tell: `pull.done` absent +
`payload1.json` 0 bytes). → [[orchestrator/tick-pitfalls/plumbing.md]]

## ticks 324–340 — helper inventory (compressed 2026-11-25)

Each tick's helpers = the previous tick's with paths repointed. Additions:
tick338 `ghfeeds.sh` (one GitHub-only run fetching the issue-comment,
review-comment, auto-merge and closed-since feeds — reset its `SINCE` and the
closed date; feed deliv.py the union of `comments-since.txt` +
`review-comments-since.txt`; a relaycheck NOT-FOUND can be a window miss — read
the target's first `in` row before calling a relay lost); tick335 `split.py`
(inline_rows → msg2/msg3, deep links stripped); tick331 `deliv.py` with a wider
maintainer/reporter login list + the repo-wide review-comment feed; tick330
`relaycheck.py` + `deliv.py` (blind-spot shape 19, run both after the scan every
tick); tick316 `lastreq.py <folder>:<sid>` (reads
`prod-groups/<folder>/.claude-trace` — **Main's own traces are at
`/workspace/agent/.claude-trace/`**, so it prints NO TRACE for `main:`
sessions); tick315 `rl429.py` (reset its since=) + `chainrows.py`; tick311
`runstop.py` + `moved.py` (covers the out-promise shapes blind.py misses);
tick326 `rl5xx.py`. `art-override.json` per tick: drop closed entries and check
carried overrides against live PR state (tick340 dropped closed #14259; tick339
pointed #14259 at merged #14416 — a merged PR still rendered as "draft #N" until
fixed). Copy `notes.json` forward but reset `nudged.json`/`real-updates.json`
to `[]` (tick328); fetch `prmap.json` fresh with `--limit 10000` — it is not
copied (tick333/337). Split a board message part whenever it passes ~14.5-15 KB
(ticks 323/324/325/329/335).

## ticks 300–323 — early helpers

tick300 established the disp-overrides reset rule (runbook). Board msg2/msg3
splitting began tick323; tick321's board274.py inlines any row whose notes.json
next-cell contains ⚠️ so a carried operator-blocked `same` row is not collapsed.

## tick 405 (2026-11-25 20:00 gate tick)

tick405 = tick404 helpers unchanged, paths repointed, since= reset to
2026-11-25T10:00Z, ghfeeds SINCE/awk re-dated to the same. Gate nudge flags
(slang-14212, rhi-986) both verified false positives: 14212 self-resolved
pre-tick (kaizhangNV's 19:59Z merge-conflict ask answered 20:00–20:01Z,
master merged clean); rhi-986 dispositioned `active:human-debate` (jhelferty-nv's
placement question addressed to @skallweitNV, owning session had evaluated
18:13Z) → re-scan must_nudge 1→0, 0 nudges sent. 4 🆕: 14722 (fix chain, PR
#14725), 14726 (bot-filed side-find of #14611, `advisory:follow-up-backlog`
per filing policy), 5892 (recheck answered), rhi-989 (round-2 cycle, fixer
iterating CI on PR #990). 22 escalates / cost_stopped 14589 unchanged. 14693 +
14703 closed+archived. Runbook "latest tick dir" pointer advanced tick401 →
tick405.

## tick 407 (2026-11-26 10:00 gate full-pass tick)

tick407 = tick406 helpers unchanged, paths repointed, since= reset to
2026-11-25T22:00Z (tick406's start), ghfeeds SINCE/awk re-dated to the same,
relaycheck.py T= re-dated (it was still 2026-11-23 — tick406 had missed it).
Clean cached tick (~15 min): 🆕 slang#14730 (human-filed 08:33Z, triaged 08:40Z,
fix chain self-driving with APPROVE_WITH_NITS patch), 4 🔼 (14611 maintainer
re-approval, 5870 fold-and-run, 14474 pinned resume nudge, slangpy-1223 profiler
flake). Gate's 10 nudge flags all cooldown-class; must_nudge 0, 0 nudges sent;
22 escalates unchanged (retro-wave family). Auto-merge sweep: 6 armed PRs, all
human-authored. GC 871 GB free (35.1%), REAP 7. Runbook "latest tick dir"
pointer advanced tick405 → tick407 — **tick406 never advanced it or appended a
history entry** (its session ended without the bookkeeping; harmless — tick407
copied tick406's helpers directly).

## tick 409 (2026-11-27 01:00 full-pass tick)

tick409 = tick408 helpers unchanged, paths repointed, since= reset to
2026-11-26T12:00Z (tick408's start), ghfeeds SINCE/awk re-dated, relaycheck.py T=
re-dated, closed-since search re-dated (tick408 had missed it — it still read
>=2026-11-25T10:00Z). **tick408 never appended a history entry** (session ended
without bookkeeping, same shape as tick406; harmless — helpers copied forward
cleanly). Clean cached tick (~20 min): 3 🆕 (14731 bot-filed GLSL-types follow-up,
14732 human feature ask, 14734 fix chain PR #14735), 4 🔼 (14359 CI re-dispatched,
14730 patch-review held branch, 9203 new draft PR #14733, slangpy-1223 tracker
outbound). must_nudge 0; 1 CI-rebase nudge sent (rhi-989 PR #990 newly BEHIND,
pinned …-vfgn30, landed in). 22 escalates unchanged (retro-wave). PR #14710
MERGED → #14707/#11357 archived; #14634 closed by human PR #14635 → postmortem
learning filed (rule: bot-filed infra issue + small harness fix → file the PR,
don't wait for maintainer tiebreak). Auto-merge sweep: 6 armed, all human. GC
869 GB free (35.0%), REAP 7, coverage fresh. Runbook "latest tick dir" pointer
advanced tick407 → tick409.

## tick 410 (2026-11-27 12:00 gate tick)

tick410 = tick409 helpers unchanged, paths repointed, since= reset to
2026-11-27T01:00Z (tick409's start), ghfeeds SINCE/awk re-dated, relaycheck.py T=
re-dated, disp-overrides reset to {}. Clean cached tick (~20 min): gate nudge flag
(slang-14737) verified false positive — maintainer umbrella dispositioned 10:29Z,
re-tokenized `advisory:maintainer-driving` via disp-overrides; must_nudge 0, 0
nudges sent. 3 🆕 (14737 dispositioned umbrella, 14738 szihs fix chain self-driving,
14739 albertrodriguezclo fresh dispatch — first session appeared MID-TICK at
12:10Z, caught by step-6 re-list + relaycheck, journaled via minimal payload2b
patch; its title had to be added to titles.json by hand). 1 🔼 rhi-989 CI green
(tick-409 merge-master nudge worked). 22 escalates / cost_stopped 14589 unchanged.
Auto-merge sweep: 6 armed, all human. GC 855 GB free (34.5%), REAP 7. Side-find:
PR #14675 run 44832584798 stuck `waiting` since 11-20 on
falcor-build-approval-gate (all other jobs green) — human-owned, board note only.
Deliv MISSING rhi#987/#975 = albertrodriguezclo on his own human PRs — not our
chains. Runbook "latest tick dir" pointer advanced tick409 → tick410.

## tick 411 (2026-11-27 13:00 gate escalate-flag tick)

tick411 = tick410 helpers unchanged, paths repointed, since= reset to
2026-11-27T12:00Z (tick410's start), ghfeeds SINCE/awk re-dated, relaycheck.py T=
re-dated, closed-since search re-dated, disp-overrides reset to {}. Note:
prev-la-blind.json absent in tick410 — rebuilt it from tick410/sessions.json
({id:last_active}) before running blind.py/moved.py. Clean cached tick (~20 min):
gate escalate flag (slang-14730) verified FALSE positive — fixer answered the
11-26 12:10Z nudge at 12:11Z ("parked by design": fix complete + peer-reviewed on
held branch fix/issue-14730, PR held pending maintainer answer to #8937-conflict
question posted on the issue 11-26 09:16Z, comment 7187704180, zero maintainer
replies ~25h later, inside the fixer's 2–3-business-day re-ping window) →
dispositioned advisory:maintainer-decision via disp-overrides; escalate back to
22 (retro-wave, all carry escalatedAt). must_nudge 0, 0 nudges sent. 0 🆕; 4 🔼
(10234 reporter new 8-bit shape verified vs draft #14640, 14730 disposition,
14738 draft PR #14740 + CI run in flight, 14739 fresh triage/root-cause). Auto-merge
sweep: 6 armed PRs, all human (GraphQL 502 blip mid-tick — REST fallback via
tick410's am-slang.txt worked). GC 846 GB free (34.1%), REAP 7, coverage fresh
(16 ok + 2 operator-paused). cost_stopped 14589 unchanged. Runbook "latest tick
dir" pointer advanced tick410 → tick411.

## tick 412 (2026-11-27 14:00 gate nudge tick)

tick412 = tick411 helpers unchanged, paths repointed, since= reset to
2026-11-27T13:00Z (tick411's start), disp-overrides reset to {}. Clean cached
tick (~12 min): gate nudge flag (slang-14739) verified FALSE positive — the
fixer pushed draft PR #14741 and the reviewer Fix Review Request landed at
14:07Z, after the 14:04 pull (tick-350 line-61 shape) → payload5 patched with
the fresh session + our_last_outbound + pr record, re-scan must_nudge 1→0, 0
nudges sent, reconciliation clean. 2 🔼 (14738 CI re-dispatched 46012545769
after the tick-411 run was cancelled; 14739 as above); 0 🆕. 22 retro-wave
escalates + cost_stopped 14589 unchanged. Auto-merge sweep: 1 armed
(slangpy#934, not ours). GC 845 GB free, coverage fresh (16 ok + 2
operator-paused). Runbook "latest tick dir" pointer advanced tick411 → tick412.

## tick 414 (2026-11-27 22:00 gate nudge tick)

tick414 = tick413 helpers unchanged, paths repointed, since= reset to
2026-11-27T16:00Z (tick413's start), ghfeeds SINCE/awk re-dated, relaycheck.py T=
re-dated, disp-overrides reset to {} (tick413's own since=/SINCE=/T= had been left
at tick-412 values — harmless: no killed/budget/rl429/ghfeeds/relaycheck output
was load-bearing this tick). Note: **tick 413 never appended a history entry**
(same shape as ticks 406/408; helpers copied forward cleanly, and its state
saved _meta.tick=413 correctly). Clean cached tick (~15 min): gate nudge flag
(slang-14745) verified FALSE positive — the "human spoke last" comment is the
automated pr-board-sync-assignment notice (github-actions 17:26Z, do-not-reply;
pull.sh bot_logins covers only nv-slang-bot, so coderabbitai/github-actions read
as human) → dispositioned advisory:awaiting-maintainer-merge, re-scan
must_nudge 1→0, 0 nudges sent, reconciliation clean. 1 CI-rebase nudge sent
(rhi-989 PR #990 ✅⤵️ BEHIND again — master moved 17:09Z after the 01:13Z
rebase; tick 413 had seen the same BEHIND cell and skipped the nudge — pinned
…-vfgn30, landed 22:12Z, nudgedAt recorded). 0 🆕; 6 real 🔼 (13200 maintainer
decline-verify upheld by fixer, 13747/13973/13982 ci_failed webhooks all
classified priority-yield/stale-replay no-action, 14739 PR-CI green via
pull_request_target 46034775896 while the 14:07Z workflow_dispatch run waits at
falcor-build-approval-gate, 14745 as above); slangpy-1223's 🔼 excluded from
real-updates (CI-babysitter sweeps churn the reused session, no chain change).
22 retro-wave escalates + cost_stopped 14589 unchanged. Auto-merge sweep: 1
armed (slangpy#934, human, not ours). GC 813 GB free (32.8%), REAP 8 / KEEP 114,
coverage fresh (16 ok + 2 operator-paused), no residue/gaps. Runbook "latest
tick dir" pointer advanced tick412 → tick414.
