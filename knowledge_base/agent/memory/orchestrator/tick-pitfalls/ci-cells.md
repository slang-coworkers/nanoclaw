---
type: runbook
description: CI-cell pitfalls of the /supervise-issues tick — lazy mergeStateStatus, workflow_dispatch shadowing, purged runs, filter-only ✅, draft-bot zombie deadlock (ticks 278-376, re-measured 11-18).
---

CI-cell interpretation traps for the tick pipeline. Parent: [[orchestrator/supervise-tick-pull-pitfalls.md]].

- **`ci.py` merge=UNKNOWN is GitHub computing mergeStateStatus lazily**, not a change (tick 278: 207 rows flipped, ⤵️
  dropped). When the run id is unchanged, carry the prior cell and merge state.
- **`ci.py` can pick a yielded bot `workflow_dispatch` over the PR's own `pull_request` run** (#13880, ticks 312–313: cell ⏸️ from run 40725539917 while the PR rollup was 58 SUCCESS / 7 SKIPPED). For an approved PR whose cell is ⏸️/❌, read `gh pr view --json statusCheckRollup` and override the cell in `ci.json`.
- **A tracked CI run can 404** (GitHub purged runs created ~10-01T20:05Z→10-07T22:25Z; 30 open PR heads had 0 check
  suites as of 10-12). `ci.py` then falls back to an older cancelled run → `❌(recheck)`. Check the PR's
  `statusCheckRollup` is empty before treating it as a rebase-nudge case.
- **A ✅ cell can come from a filter-only dispatch** (#12749: 2 success + 48 skipped). Check the job breakdown before
  reading ✅ as "built and tested" (tick 290).
- **Draft bot-PR CI is deadlocked, not slow.** `ci-retry-yielded-bot` (the real name; `retry-yielded-bot-ci.yml`
  matches nothing) logged "CI is still active (83–107 runs)" on ~98 of 100 fires since 10-15, because ~88 runs sit
  `waiting` on `falcor-build-approval-gate`. A fixer holding its Fix Report "until the retry re-runs CI" waits forever,
  and scan reads it as `awaiting_human` (#13716). Any coworker claim that the retry will re-run a `waiting` run is
  false while the deadlock holds — correct it on the board. Classify the helper's decision lines
  (`gh run view <id> --log`) before trusting a ⏸️ yield to self-heal (ticks 288, 290). Re-measured
  11-18 00:14Z: "still active (**230** runs)"; the 11-17 base-refresh batch alone left ~10 fresh
  zombie `workflow_dispatch` runs (fix/issue-13534/-13800/-14292/-13348/-14430/-13833/-14524/
  -14518/-14557 + -13858). Disposition per #13126/#13864: the owning fixer **cancels** its zombie
  run — cancelled ⇒ `failed_only_because_priority_gate`=False ⇒ never re-picked, and one fewer
  guard-tripper for everyone. #13858's check loop (9 hourly re-checks waiting on the rerun,
  11-17/18) is the failure mode in action: terminate such loops with this fact, don't re-arm.
  **All 10 cancelled 11-18 (Main-verified; 0 waiting dispatch runs left)** — but every new bot
  draft-testing dispatch recreates one, so re-check on refresh batches. Sweep gotcha: a per-branch
  `gh run list --limit N` can be all newer `pull_request` runs while an older `waiting`
  `workflow_dispatch` run sits outside the window — filter on `event==workflow_dispatch` (bit the
  fixer's sweep 11-18; learning in shared/learnings/ag-1780667166439-vmjrwe/1794961760356-*).
