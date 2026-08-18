---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786998787240-iokice
written_at: 2026-08-17T21:03:30.246Z
---

# [approver/challenger-miss] A workflow_dispatch-only CI lane can be exercised AND red-on-arrival — separate "does it gate the PR" from "did the guarded work run and pass"

**Context:** slangpy#1112 added a new `tsan` job to `.github/workflows/sanitizers.yml`. Decision: ABSTAIN_POLICY(OPEN_GAP).

**Symptom / trap:** The prior slangpy#925 learning ("workflow_dispatch-only path ⇒ vacuous green, guarded work may be dead") primes you to conclude "not `pull_request`-triggered ⇒ dead flag / no coverage ⇒ OPEN_GAP for missing trigger-present control." That reasoning is only half right and can misfire in BOTH directions.

**Root cause:** Two independent questions get conflated:
1. *Does the new lane gate this PR?* — Here NO: the `sanitizers` workflow is `schedule` + `workflow_dispatch` only. So even a green run wouldn't be a merge gate, and a red run doesn't block the PR's own required checks.
2. *Did the guarded work actually execute and do its job?* — Here YES: a **manual `workflow_dispatch` on the PR head** ran both tsan legs; they built with `-DSGL_ENABLE_TSAN=ON`, ran the C++ suite, and TSan flagged a real data race (`test_lmdb_cache.cpp:42 in rng()`), failing with `halt_on_error=1`. So the trigger-present control is *satisfied* — this is NOT a dead flag.

**How to catch it:** For any new CI lane, run BOTH checks explicitly:
- `gh api "repos/{repo}/actions/runs?head_sha={sha}"` and read each run's `event` field — a `workflow_dispatch` run on the head means someone manually exercised it; a `pull_request` run means it gates. Don't infer coverage from check-run presence alone.
- Then pull the job's failing-step log (`gh api --allow-escape-sequences .../jobs/{id}/logs`) to see whether a failure is the tool *doing its job* (real finding) vs. broken wiring. A sanitizer lane that goes red by *detecting a genuine race* is the workflow working, not a PR defect — but it still means the lane lands red, which is its own OPEN_GAP-class concern (a maintainer must choose land-red-then-fix vs fix-first).

**Fix / rule:** "workflow_dispatch-only" ⇒ *not a PR gate*, but NOT automatically *no coverage*. Check for a manual dispatch run on the head before calling the trigger-present control missing. And a green revert-drill is not the only outcome to probe — a lane that is *red because the sanitizer found something real* is a distinct state: guarded work ran (good), lane is red-on-arrival (human call). Related: [[slangpy-925 workflow_dispatch vacuous green]].
