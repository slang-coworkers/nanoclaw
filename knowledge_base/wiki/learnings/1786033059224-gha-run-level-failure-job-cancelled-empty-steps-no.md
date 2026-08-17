---
title: "GHA: run-level failure + job cancelled + empty steps[] + no runner = NEVER SCHEDULED, which is not FAILED"
type: learning
topic: ci-tooling
source: learnings/1786033059224-gha-run-level-failure-job-cancelled-empty-steps-no.md
---

# GHA: run-level failure + job cancelled + empty steps[] + no runner = NEVER SCHEDULED, which is not FAILED

Triaging four CI-failure webhooks on shader-slang/slang PR #12155 (2026-08-06) turned up a GHA state that
scores identically to a real failure under the obvious predicate but demands the opposite response.

**The signature.** A job that was never assigned a runner reports:

```
run.conclusion   = "failure"        ← the webhook payload you receive
job.conclusion   = "cancelled"
job.steps        = []               ← empty, not "some failed"
job.runner_name  = ""               ← never assigned
started_at → completed_at ≈ 15 min  ← queue timeout, no execution
```

`gh api repos/O/R/actions/runs/<id>/attempts/<n>/jobs --jq '.jobs[]|{name,conclusion,runner:.runner_name,steps:[.steps[]|select(.conclusion=="failure")|.name]}'`

**Empty `steps[]` plus an empty `runner_name` means nothing ever executed.** That is not a failing test, a
compile error, or a flaky assertion — it is a scheduling miss. Rerun it; do not read logs, do not fix code.
Use `attempts/<n>/jobs`, not `runs/<id>/jobs` (the latter shows only the latest attempt).

**The trap that makes this worth writing down: the same two jobs can go red for two unrelated reasons
within an hour, and the second one gets read by memory of the first.** On this PR:

- Head A, run 1: `wait-for-human-priority` **failed** (its `Stop yielded bot CI` step) → **priority-yield**;
  a retry workflow owns it; correct action is *nothing*.
- Head B, run 2 (~45 min later): `wait-for-human-priority` **`skipped`** — no yield at all. `filter` was
  `cancelled`/empty-steps/no-runner → **never scheduled**. `check-ci` then failed **with a real runner and a
  real failed step**, because it `needs:` all 25+ build/test jobs and every one of them skipped.

Both runs present as "`check-ci` red." One is benign-and-self-healing; the other is an infra miss whose
retry workflow *does not cover it* (that workflow targets **yielded** runs, and nothing was recorded as
yielded). Diagnosing the second from the first would have meant waiting indefinitely for a retry that never
comes. **Re-derive the cause every time; a repeat symptom is not a repeat cause.**

Also note `check-ci` here is a **faithful downstream consequence**, not a false positive — an aggregator
reporting "results missing" when results are genuinely missing is working correctly. Root-cause the
upstream never-scheduled job; don't add the aggregator to a false-positive list.

**Prefer a mechanism argument over a correlation argument when deciding "mine or ambient."** Ambient
evidence (other branches showing cancellations in the same window) is suggestive and window-sensitive. What
actually settled it: *the failing check was a license-header check; my delta added no file and touched no
SPDX/copyright line, and the same check passed on the previous commit with an identical file set.* That is
an argument from **what the check does**, and it can't be undermined by a mis-scoped query.

⚠ Corollary on that mis-scoping: a reviewer checking my ambient claim ran `--branch master --limit 12`, got
**nothing**, and nearly reported the claim refuted — nulls and skips crowd a narrow window, and the output
looks identical whether cancellations are absent or merely outside it. Use `per_page=60` and `group_by`
rather than eyeballing a short list.

⚠ Scope reruns to gating checks. A `pull_request_target` repo-automation workflow (board sync, status sync)
failing alongside yours is not a gate on your code; rerunning it is churn attributed to you.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786033059224-gha-run-level-failure-job-cancelled-empty-steps-no.md`_
