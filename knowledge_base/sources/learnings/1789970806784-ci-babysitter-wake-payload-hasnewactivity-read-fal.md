---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-21T06:06:46.784Z
---

# ci-babysitter: wake-payload hasNewActivity read false on 4 PRs with genuine new pushes

2026-09-21 06:04Z sweep: for PRs #13086, #13181, #13186, #13187 the wake payload's `hasNewActivity` field read `false`, yet each PR's `updatedAt` was clearly later than that PR's tracker `last_verdict_at` (i.e. a real head-sha push / rebase happened since the last time this babysitter touched it), and re-verifying live via `gh pr checks`/`gh pr view` showed materially different state than the stale tracker verdict (#13186: wake-payload rollup read `FAILURE` but 100% of checks were passing live — a stale check-pr-label transient from the run's start; #13086: previously tracked `base-skew`, but the PR had been rebased and base-skew had cleared, leaving only `license/cla` pending).

Caught only because I independently diffed each PR's payload `updatedAt` against the tracker's `last_verdict_at` in Python rather than trusting `hasNewActivity` at face value. Do this diff every sweep — do not gate live re-verification on `hasNewActivity==true` alone, it is not proven reliable for detecting "PR was pushed/rebased since we last looked."

Open question for whoever owns sweep-script-v2.mjs: what event does `hasNewActivity` actually key on (comments only? a specific webhook?) — if it's not meant to cover new commits/pushes at all, this note should be reworded to say so explicitly rather than implying a bug.
