---
name: feedback_filter_latest_returns_two_suites_per_sha
description: "check-runs?filter=latest returns check-runs from EVERY check-suite at one sha, so a stale failed suite outlives a LATER green one — same job name, same sha, opposite conclusions. A real signature is not proof the run is the LIVE verdict. The single load-bearing rule: take the suite with the newest check_suite/run created_at; every timestamp that advances on a re-run (started_at, completed_at, updated_at, run_started_at) inverts."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

# `filter=latest` returns every suite at a sha — reconcile currency on `created_at`

**Found by slang-ci-babysitter 2026-08-04; Main-reproduced end-to-end on slang#12186.**

## The trap
`GET /repos/{o}/{r}/commits/{sha}/check-runs?filter=latest` returns check-runs from **every
check-suite at that sha** — not "the latest suite". On #12186 (head `65338dbe`) `test-falcor / Test
(Falcor)` appeared twice: `failure` and `success`.

| suite | event | created_at | conclusion |
|---|---|---|---|
| `83678547333` | `pull_request` | 22:17:34Z | skipped (path-filter no-op at PR open) |
| `83679936584` | `workflow_dispatch` (retry-yielded-bot-ci) | 22:25:39Z | **failure** |
| `83685090805` | `pull_request` | **22:56:30Z** | **success** ← live verdict |

The babysitter had a genuine, correctly classified #12145 Falcor signature and was one step from
`gh run rerun` on an already-green PR. ⭐ **Classification and currency are independent checks:** ask
*is this failure real?* **and** *is this run the live verdict for this sha?*

## The rule (and why every other timestamp is wrong)
Re-verified at #12186's head — the stale suite kept being re-run, so:

| field | stale dispatch (failure) | winning pull_request (success) | picks |
|---|---|---|---|
| check-run `started_at` | 02:12:53Z | 23:22:28Z | ❌ red |
| check-run `completed_at` | 03:10:33Z | 00:19:03Z | ❌ red |
| run/suite `updated_at` | 03:10:33Z | 00:19:04Z | ❌ red |
| run `run_started_at` | 01:47:10Z | 22:56:30Z | ❌ red |
| **run/suite `created_at`** | 22:25:39Z | **22:56:30Z** | ✅ green |

⭐⭐ **Mechanism, not blocklist: every timestamp that advances on a re-run inverts.** `created_at` is
pinned to the triggering event and never rewritten. For a field not listed, ask "does a re-run move
it?". `run_started_at` is the sneaky one: it equals `created_at` on attempt 1 and diverges only from
attempt 2 — so it tests clean on exactly the population where currency doesn't matter.

**Recipe — one call joins suite id + event + created_at** (`/check-suites/<id>` has **no `event`
field**; `head_branch` is just the branch):
```bash
gh api "repos/{o}/{r}/actions/runs?head_sha=<sha>&per_page=50" \
  --jq '.workflow_runs[]|select(.name=="CI")|"suite=\(.check_suite_id) event=\(.event) created=\(.created_at) conclusion=\(.conclusion)"'
```
Group check-runs by `check_suite.id`; the verdict is the suite with the newest `created_at` and a
real conclusion.

**Rule structure, in order of weight:**
1. **`created_at` is the single load-bearing rule** — resolves both variants below.
2. **Prefer the `pull_request` event** — a tiebreaker for the dispatch variant only; it cannot
   discriminate same-event duplicates.
3. **Real-conclusion filter** (`{success, failure, timed_out}`; `skipped`/`null` aren't verdicts) —
   **defensive, not load-bearing**: across all 75 PRs (63 with 1 CI suite, 6 with 2, 4 with 3 —
   #12186/#12208/#12269/#12304) the `skipped` suite was always the oldest. I had reasoned that hazard
   into the recipe; the babysitter measured it absent. Keep the guard (silent failure mode, zero
   cost) but don't rank it as the fix.

## Variants
- **Dispatch variant:** `pull_request skipped → workflow_dispatch → pull_request real`, the shape of
  all four triple-suite PRs. Systemic cause worth surfacing to a maintainer: `retry-yielded-bot-ci`'s
  re-dispatch leaves permanently red check-runs on bot PR heads.
- **Same-event variant (author-hygiene loop):** `Verify PR Labels` fails → author adds the label →
  gate re-runs green → the failed suite persists in `filter=latest` forever. #11373, #10885, #11087,
  #11964 — every suite `event=pull_request`, all carry `pr: non-breaking` today.
- **Fleet-wide, not CI-only:** at #12186's head eight workflows were doubled (CI:3, PR
  Maintenance:4, and 2 each for SlangPy Trigger Test, Check Formatting, Check GitHub Actions
  Workflows, Claude PR Review, REUSE Compliance, Verify PR Labels). Any gate read via `filter=latest`
  — formatting, labels, policy — is exposed.

## Don't over-correct: some reds are genuine
- #12182's `check-formatting` red was **real**: exactly one suite, no supersession.
- **Label gates cut both ways — check the PR's CURRENT labels.** #11223/#11234/#11081/#9809 had zero
  labels and #10787 only `[Testing]` (genuine, author-actionable), versus the four phantoms above
  carrying `pr: non-breaking`. Byte-identical red checks, opposite verdicts.
- Net: 6 of 29 red PRs carried at least one phantom — a minority, so blanket dismissal and blanket
  trust are both miscalibrated. ⭐ **The reconciliation IS the work; assuming either direction is the
  error.** And measurement adjudicates both ways: it deleted my imagined guard and also promoted the
  `created_at` rule, which had been reasoned too.

## Third-order harm: phantoms top every "what broke most recently" ranking
The #12186 phantom's check-run completed 03:10:32Z — the newest failing check across all 74 PRs and
newer than the 02:00Z sweep that had recorded the PR green, so it looked like a fresh regression. Any
recency-ordered red list must be computed over `created_at`-winning suites only, or it surfaces
phantoms first — exactly the PRs most likely to be actioned.

**Cheap detector (babysitter's):** per PR, flag `pull_request:success` co-existing with
`workflow_dispatch:failure`; for same-event pairs, compare suite `created_at`.

## Related
[[feedback_check_runs_omit_legacy_commit_statuses]] (completeness: check-runs misses commit
statuses — the sibling half split out of this file) ·
[[feedback_gh_pr_checks_dedups_runs_rollup_does_not]] ·
[[feedback_gh_paginate_401s_on_page2_use_explicit_pages]] (silent caps) ·
[[feedback_rerun_partial_cancel_is_not_a_new_signature]] (`actor` pinned to the original initiator;
use `triggering_actor` on `attempts/N`) · [[feedback_use_declared_timeout_not_estimated_threshold]].
