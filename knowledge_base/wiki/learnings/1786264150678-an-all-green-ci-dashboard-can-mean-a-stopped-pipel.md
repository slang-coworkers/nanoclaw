---
title: "An all-green CI dashboard can mean a stopped pipeline — cross-check throughput, not just queue depth"
type: learning
topic: agent-ops
source: learnings/1786264150678-an-all-green-ci-dashboard-can-mean-a-stopped-pipel.md
---

# An all-green CI dashboard can mean a stopped pipeline — cross-check throughput, not just queue depth

A CI health snapshot showing `jobs_queued: 0`, `runs_queued: 2`, all runner groups idle looks like health. On 2026-08-09 in shader-slang/slang it meant the **opposite**: the pipeline was frozen.

**What was actually true:** master had not advanced in >32h (tip `716ec597fc`, 08-07T23:26:18Z), **zero `merge_group` runs** existed in the window, and the single "running job" in the snapshot was the `CI Health` workflow *observing itself*. Queue depth is near-zero when nothing can enter the queue — identical reading to genuine idle.

**Root cause shape worth recognizing:** one GitHub **environment protection gate** wedged the whole estate. Run #30154 sat `status: waiting` ~19h with 38/39 jobs done, holdout `test-falcor`, blocked on env `falcor-ci` awaiting the `ci-approvers` team (`pending_deployments` → `current_user_can_approve: false`). A retry workflow fired hourly and *succeeded*, requeued bot CI, hit the still-held gate, and yielded again — a **self-sustaining yield/retry loop**. One approve-or-cancel clears it.

**Second trap in the same incident:** the repo showed 11 "failed runs," which reads as redness. 9 of them had exactly 2 failed jobs (`wait-for-human-priority` + the `check-ci` roll-up) and **37 skipped** — deliberate policy-gate exits logging `priority-gate-yielded`. **No compile, test, or emit job ran in any of them.** Counting throttle exits as failures overstates redness; worse, it hides that real test jobs produced *no* observations (a runner-correlation investigation stalled at n=4 because the job was `skipped`, not passing).

**How to apply:**
- Before calling a green snapshot "healthy," ask *did work flow?* — check whether the default branch advanced and whether merge-queue/merge_group runs occurred in the window. Idle-because-nothing-queued and idle-because-blocked are indistinguishable from queue metrics alone.
- Check `GET /actions/runs/{id}/pending_deployments` on any long-`waiting` run; environment gates don't surface as failures.
- Classify each failed run by *which jobs* failed. A run whose only failures are gate/roll-up jobs with the rest skipped is a policy exit, not a regression.
- A denominator of zero is **undefined, not 0%** — don't report a rate for a window where nothing ran.

Related family: a progress report is not a result; absence requires corroboration. Same failure direction — a clean-looking signal that actually means "not observed."

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786264150678-an-all-green-ci-dashboard-can-mean-a-stopped-pipel.md`_
