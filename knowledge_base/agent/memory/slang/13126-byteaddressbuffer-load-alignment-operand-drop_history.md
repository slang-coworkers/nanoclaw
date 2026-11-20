---
type: chain
title: "slang#13126 ByteAddressBuffer.Load<S>() alignment-operand drop — history, draft PR #13130 → superseded by #14565 (11-18)"
description: "Settled history of #13126: triage 09-16, draft PR #13130 (round-3 APPROVE, a616bd3805), fixer merge 654c18a756, then five re-chases (10-20 → 11-04) all blocked on the falcor-ci human gate inside the waiting-runs throttle livelock; PARKED 11-04; superseded 11-18 by merged #14565; follow-up tracking issue #14583 filed by that chain (filed-only, no triage dispatched). Live state is in [[13126-byteaddressbuffer-load-alignment-operand-drop.md]]."
tags: [slang, byteaddressbuffer, specialization, ir, crash, history]
---

# slang#13126: history, draft PR #13130 → superseded

Split out of [[13126-byteaddressbuffer-load-alignment-operand-drop.md]] on
2026-11-20 to keep it under the 16k cap. **New dated entries go here, not into
the live record** — the live record holds current state only.

## Timeline (detail)

- 09-16 12:43Z issue_opened (Rexagon, external) → triager; 12:58Z [Triage] Bug/high/IR/P2. GO on Approach A.
- 09-16 16:59Z draft PR #13130 opened; regression bisected and labeled; the triager suggested P2→P1 (a
  project-board field, which we do not set).
- 10-17 17:18Z albertrodriguezclo (external) comment `6237446868`: the crash happens for any call that takes
  the struct as an argument, plus a layout table → routed to the triager (msg 19).
- 10-17 18:26Z [Triage Resolution]: the PR head fixes every variant, and the fix needed no change. The
  generic and interface paths go through the same specialization.
  The fixer **merged origin/master instead of rebasing** to avoid a force-push (jhelferty-nv asked for
  merge-from-master over force-push on #12194). Main accepted that.
- 10-17 19:4xZ round-3 review APPROVE_WITH_NITS (0 bugs), nits in a616bd3805. A new shape was found: any struct
  >128 B with no array is also specialized (size rule in `isTypePreferrableToDeferLoad`). The triager reproduced
  a 144 B all-`uint4` crash on unfixed Release; it was added to the call-arg test. Affected set: >16 B with an
  array, OR any struct >128 B. Issue comment 6237522353 PATCHed.
- 10-17 19:57Z slang-reviewer final APPROVE @a616bd3805: #13126 tests 12/12, sweep 1662/1662; every alignment shape
  that passes the front end compiles on the head and crashes master (reviewer's claims, not re-run by Main). One >100-col nit was left on purpose.
  Main's 19:5xZ dashboard ask for a human CI re-run was wrong; corrected at 20:0xZ.

## "Waiting on" mechanics (as of the park; all moot after supersede)

- ~~CI re-run is automatic~~ **WRONG (found 10-20):** `retry-yielded-bot-ci.py` lists only `status=completed`
  workflow_dispatch runs with `--lookback-hours 16`. A run stuck `waiting` on the `falcor-ci` env gate is never
  completed, so it is never a candidate. 39063429240 sat `waiting` 70 h (44 skipped). ⇒ **A bot draft run that is
  `waiting` needs a fresh dispatch, not the hourly retry.**
- Human: a `ci-approvers` member approves the `falcor-ci` gate. Neither we nor the fixer can do this.
- Then green CI → ready-for-review → maintainer review (jhelferty-nv).
- Operator: the P2→P1 priority bump (project board).
- Re-check: one-shot task `rechase-13126-pr13130-0b68` at 11-04 18:00Z (`ncl tasks update` on the running series fails with "no live task matched", so each re-arm creates a new id).

## 10-20 18:0xZ re-chase

Still draft, head `a616bd3805`, 7 behind / 6 ahead, 0 human reviews, no human comments since 10-17 19:55Z. Operator
did not answer the two 10-17 asks (falcor-ci approval, P2→P1); not re-asked. Main asked the fixer (pinned session,
canonical thread) to merge origin/master (merge commit), dispatch a fresh draft CI run, and mark ready when green.
Dashboard told, with a correction of the auto-retry claim.

## 10-23 18:0xZ re-chase

The fixer acted on the 10-20 ask: merge commit `654c18a756` (10-20 18:03Z, parents a616bd3805 + 7251cc60b4) and
dispatch run `39471864134` (18:06Z). It repeated the old pattern: `wait-for-human-priority` + `check-ci` failed
(bot yield), 44 skipped, `falcor-build-approval-gate` `waiting` on env `falcor-ci` (reviewer: team `ci-approvers`,
`current_user_can_approve=false`). Now 44 behind / 7 ahead. Still draft, 0 reviews, no human comments on either side.
**Re-dispatching cannot help:** `ACTIVE_STATUSES` in `extras/ci/ci_priority_common.py:29` still contains `waiting`
on master, and `ci.yml` has 93 `waiting` runs (71 workflow_dispatch). The newest `ci-retry-yielded-bot` run
(39997925477) logs "CI is still active (99 run(s)); not rerunning bot CI." This is the known livelock in
[the throttle livelock note](../imported/feedback_a_status_set_broader_than_its_docstring_livelocks_the_throttle.md),
now repo-wide. Approving this run's gate alone does not restart the 44 skipped jobs, and the run is outside the 16 h
lookback. Case (f): dashboard told, re-armed `rechase-13126-pr13130-0731` (10-26 18:00Z). No fixer nudge.

## 10-26 18:0xZ re-chase

No change: still draft, head `654c18a756`, now 48 behind / 7 ahead (master got only 2 commits since 10-23 18:00Z). 0 reviews, no
human comments on #13126 or #13130 since 10-23 18:00Z, no operator answer on the dashboard. Run `39471864134` is still `waiting`
(2 failed, 44 skipped, 1 success, 1 waiting); `falcor-ci` reviewer `ci-approvers`, `current_user_can_approve=false`. The livelock
remains: `ACTIVE_STATUSES` (`ci_priority_common.py:29`) still includes `waiting`; `ci.yml` has 98 `waiting` runs; retry run
`40368651580` (10-26 17:26Z) still lists `waiting` bot runs as active. Case (f): dashboard told, re-armed
`rechase-13126-pr13130-1c93` (10-29 18:00Z). No fixer nudge.

## 10-29 18:0xZ re-chase

No change: still draft, head `654c18a756`, now 69 behind / 7 ahead. 0 reviews; no human comments on #13126 or #13130 since
10-26 18:00Z; no operator answer on the dashboard (bounded reads covered 10-26 18:00Z → 10-29 17:50Z). Run `39471864134` is still
`waiting` (2 failed, 44 skipped, 1 success, 1 waiting); `falcor-ci` reviewer `ci-approvers`, `current_user_can_approve=false`.
The livelock is worse: `ACTIVE_STATUSES` (`ci_priority_common.py:29`) still includes `waiting`, and `ci.yml` now has 140 `waiting`
runs (98 on 10-26). Case (f): dashboard told, re-armed `rechase-13126-pr13130-200d` (11-01 18:00Z). No fixer nudge. Dashboard
rows carry the body in `.text`, not `.content` — a filter on `content` silently matches nothing.

## 11-01 18:0xZ re-chase

No change: still draft, head `654c18a756`, now 90 behind / 7 ahead. 0 reviews; no human comments on #13126 or #13130 since
10-29 18:00Z; no operator answer on the dashboard (the bounded read covered 10-29 16:31Z → 11-01 18:01Z). Run `39471864134` is still
`waiting` (2 failed, 44 skipped, 1 success, 1 waiting); `falcor-ci` reviewer `ci-approvers`, `current_user_can_approve=false`.
`ACTIVE_STATUSES` (`ci_priority_common.py:29`) still includes `waiting`; `ci.yml` has 159 `waiting` runs (140 on 10-29). Related
fleet items in the dashboard (not Main's to act on here): a 10-30 proposal to cancel the bot's ~95 stale `workflow_dispatch` runs
(row 509493, marked undelivered), and gate runs on other PRs that hit the 30-day expiry (#13328, #13350). Case (f): dashboard told
(thread `gh-issue-shader-slang/slang-13126`), re-armed `rechase-13126-pr13130-0b68` (11-04 18:00Z). No fixer nudge.

## 11-04 18:0xZ re-chase — PARKED, no timer (final)

No change: still draft, head `654c18a756`, now 110 behind / 7 ahead. 0 reviews; no human comments on #13126 or #13130 since
11-01 18:00Z; no operator answer on the dashboard (bounded reads covered 11-01 18:04Z → 11-04 16:44Z). Run `39471864134` is still
`waiting` (2 failed, 44 skipped, 1 success, 1 waiting), the only run on the head; `falcor-ci` reviewer `ci-approvers`,
`current_user_can_approve=false`. `ACTIVE_STATUSES` (`ci_priority_common.py:29`) still includes `waiting`; `ci.yml` has 185 `waiting`
runs (159 on 11-01), so the fleet-wide stale-dispatch cancel has not happened. Case (f) with the 11-01 re-ask cap: final dashboard
line sent, `supervisor-state.json` entry marked `parked` (no timer), **not re-armed**. Would have reopened on: the gate-run expiry webhook
(~11-19 18:06Z, check goes red with no test failure → fresh dispatch then needed, after merging master), a human comment/review, a
`ci-approvers` action, or a new head/run. Operator decisions were still pending (not re-asked): falcor-ci gate approval; P2→P1.

## 11-18 supersede + follow-up

**11-18: SUPERSEDED — draft closing.** PR #14565 "Keep byte-address buffer loads at the call site" (merged 2026-11-18T08:03:39Z)
auto-closed #13126 as completed — a maintainer shipped the same fix class. Our draft #13130 close-as-superseded dispatched to
slang-triager (housekeeping-closes-2026-11-18), per the same-tick rule (#13966/#14076). The falcor-ci gate expiry (~11-19) and the
P2→P1 ask are moot. Chain terminal on close.

**11-18 08:33Z: follow-up tracking issue #14583 filed by the #14565 chain** (nv-slang-bot): "Restore ByteAddressBuffer load
sinking into specialized callees (removed by #14565)". Body carries the #13130 investigation (alignment operand in the
specialization key, offset-as-parameter alignment proof, intervening-write hazard). Its `issue_opened` webhook landed in Main's
session at 08:33Z; disposition per filing policy + Core Memory carve-out (bot-authored body with verification results =
Terminal filing): **filed-only, no triage dispatched, operator told; starting a fixer chain is the operator's call.** No
`👀` (self-noise on our own filing).
