---
type: incident
title: retry-yielded-bot-ci never reruns while any CI run is `waiting` on an approval gate
description: extras/ci/retry-yielded-bot-ci.py exits "CI is still active" if any run has a status in ACTIVE_STATUSES, which includes `waiting`. On 2026-10-12, 105 approval-gated runs (oldest 09-15) were waiting, so yielded bot CI was never retried. A maintainer has to decide.
tags: [slang, ci, merge-queue, priority-gate, open-question]
---

# Yield-retry bot starved by approval-gated `waiting` runs

**Checked on master 2026-10-12 ~22:30Z:**
- `extras/ci/ci_priority_common.py:29`: `ACTIVE_STATUSES = {"queued","in_progress","waiting","requested","pending"}`.
- `extras/ci/retry-yielded-bot-ci.py:186-188`: if `any_active_ci(...)` is non-empty, it prints "CI is still active (N run(s)); not rerunning bot CI." and exits.
- The `/actions/runs?status=waiting` query returned **105**, all workflow `CI`: 78 `workflow_dispatch` and 22 `pull_request` on page 1. The oldest was created 2026-09-15 03:42Z. These are parked on the approval environments (falcor gate, fork approval). They don't use runners, but the bot counts them as active.
- The result is that the bot no-ops on every fire. Bot `workflow_dispatch` runs that yielded to human priority are never retried.

**History:** the same mechanism was found 2026-08-08 (imported note `feedback_an_aged_run_does_not_escalate_a_rerun_does`). slang#12391 (open, last activity 08-12) covers the separate aging-bound problem in `wait-for-priority.py`, not this exclusion. The babysitter reported it as recurring since 06-15/08-04.

**Options (maintainer decision; the bot doesn't push workflow changes):**
- (a) Drop `waiting` from the set this bot checks. A run parked on an approval environment doesn't compete for runners.
- (b) Have a maintainer approve or cancel the backlog of stale waiting runs.
- (a) fixes the cause and (b) clears it once. Raised with the operator 2026-10-12.

**2026-10-21 recheck:** still unresolved. `ci.yml?status=waiting` = **85** (78 `nv-slang-bot[bot]`, oldest 09-16). Second 30-day falcor-gate expiry on a bot draft: slang#13201 (run 35629836846, 09-21 17:06Z → 10-21 17:06Z, 0 build steps), after #13127 on 10-16. Both drafts parked with a status comment, not rerun: a rerun only re-requests `falcor-ci` approval.

**2026-10-30 recheck:** 157 `waiting` runs, all workflow `CI`, created 09-30 to 10-30 (older ones have expired at 30 days). By source: **96 are `nv-slang-bot[bot]` `workflow_dispatch`**, 51 are fork PRs from albertrodriguezclo, 7 are bot `pull_request`, and 3 are other forks. Most of the backlog that starves the bot's own retry is the bot's own CI dispatches parked on `falcor-ci`. Each one expires after 30 days and sends a `ci_failed` webhook (slang#13352 run 36764728378 today). A third option is for the bot to cancel its own waiting dispatches on parked drafts. That is a bulk action, so it needs the operator.
