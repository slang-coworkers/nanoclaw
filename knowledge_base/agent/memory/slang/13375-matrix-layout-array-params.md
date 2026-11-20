---
type: chain
title: slang#13375 — matrix layout dropped on array-of-matrix parameters; draft PR #13384 parked on operator A/B
description: Draft PR #13384 (fix/issue-13375, head a4ebde63b6) parked since 10-14 on the operator's history-rewrite A/B decision; 11-16 ci_failed was a stale-backlog replay (deleted suite), triage closed
---

# slang#13375 → draft PR #13384 (also fixes #13390)

- **Owner:** slang-fixer session `sess-1790896752065-njpemm` (its session thread is
  `gh-issue-shader-slang/slang-13375`). Main-side chain session: `sess-1790881765830-saa1xb`
  (same thread). The #13396/#13400 record in this folder shares the same fixer session.
- **Fix:** draft PR #13384, branch `fix/issue-13375`, head `a4ebde63b6` (retargeted to master
  10-14, merged master in, no force-push). Local verification green at head: 8 PR tests 14/14,
  types/ 75/75, broader run 4747/4747 (10-14 report).
- **Parked on operator A/B** (since 10-14, msg 186): (A) force-push clean single commit
  `db48b8589b` (branch `fix/issue-13375-clean`, identical tree `8559fc4f72`, no Claude trailers)
  to `fix/issue-13375` keeping PR #13384 + comments, or (B) push `-clean` as a new draft PR.
  Fixer holds: branch, `-clean`, and `wt-slang-13375` untouched until relayed an answer.
  Open maintainer questions from the PR body: label + the prototype/definition merge rule.
- **11-16 ci_failed triage — CLOSED (stale-backlog replay):** webhook 07:11Z for suite
  104737850431. Suite and run 38650557654 (the 10-14 CI run on this head) both **404 — deleted
  by GitHub retention ~Nov 13**; zero check runs on the head; sole status `license/cla: success`;
  no repo runs on any bot branch 06:00–09:00Z. A fresh failure/re-run is excluded by construction
  (nothing existed to fail). No requeue (target run deleted). I verified the 404s and the empty
  check-runs myself with authenticated reads. Any operator A/B path triggers fresh CI anyway.
  Fixer's close-out is its 12:04Z report; also persisted in the fixer's own fix-13375.md.
- **Lessons from this triage:** unauthenticated GitHub API reads gave false negatives
  (`actions/runs?head_sha=` total_count 0 while a run demonstrably existed — proved from the
  chain's own fix log; the React checks page "no jobs" equally unreliable). Under the 11-16
  credential outage (04:41–~12:00Z), the container-IP unauth quota also exhausted. Don't trust
  unauth reads for CI classification.
- **Cost:** fixer session njpemm was cost-escalated 11-16 ($257.11 spent of $300.00 ceiling).
  A large future turn on this chain may need an operator ceiling decision before dispatch.
- **11-16 ops trail:** outage bounces (07:17/07:29) were transient host errors; resolved by a
  pinned Main nudge plus one-shot recheck task `recheck-13384-ci-a4ebd-0dd6` (12:00Z, fired clean,
  completed) that handed authenticated findings to the owner session.
