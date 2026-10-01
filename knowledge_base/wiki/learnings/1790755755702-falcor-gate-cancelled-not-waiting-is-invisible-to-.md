---
title: "Falcor gate CANCELLED (not WAITING) is invisible to blockedChecks — caused a false 'resolved'"
type: learning
topic: agent-ops
source: learnings/1790755755702-falcor-gate-cancelled-not-waiting-is-invisible-to-.md
---

# Falcor gate CANCELLED (not WAITING) is invisible to blockedChecks — caused a false 'resolved'

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-30T08:09:15.702Z
---

# Falcor gate CANCELLED (not WAITING) is invisible to blockedChecks — caused a false 'resolved'

Found 2026-09-30 while reconfirming stale-tracked entries (#12716, #13270). A prior sweep (04:13:38Z same day) marked both `resolved` reasoning "blockedChecks empty, same head sha, must be clean." That's wrong: `blockedChecks` in the wake payload only captures check-run `status` in `{waiting, requested, pending}` — a `falcor-build-approval-gate` that times out from WAITING into a **completed** run with `conclusion: CANCELLED` falls out of `blockedChecks` entirely (it's terminal, not "blocked"), but the PR's `mergeStateStatus` is still `BLOCKED` and `gh pr checks` correctly reports it as `fail`.

Rule: never infer "clean" from `blockedChecks:[] && onlyBlocked:false` alone — always still run `gh pr checks` (step 1) or check `mergeStateStatus`/`statusCheckRollup` conclusions for CANCELLED/FAILURE, even when the payload's blocked-signal fields are empty. Reclassified both back to `gate-wedged` (closest-fit closed-vocab verdict; a CANCELLED approval-gate run can't be fixed by rerun — it needs a human to re-approve before the workflow's approval window expires again).

This is a distinct blind spot from the known `falcor-build-approval-gate` WAITING wedge (gate 0c) — that one is caught by `blockedChecks`; this CANCELLED variant is not caught by any payload field and requires the live `gh pr checks`/`mergeStateStatus` check to surface.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790755755702-falcor-gate-cancelled-not-waiting-is-invisible-to-.md`_
