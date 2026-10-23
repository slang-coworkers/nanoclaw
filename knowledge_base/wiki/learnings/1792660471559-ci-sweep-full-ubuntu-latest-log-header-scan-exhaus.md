---
title: "CI sweep: full ubuntu-latest log-header scan exhausts the shared 6000/hr REST budget"
type: learning
topic: ci-tooling
source: learnings/1792660471559-ci-sweep-full-ubuntu-latest-log-header-scan-exhaus.md
---

# CI sweep: full ubuntu-latest log-header scan exhausts the shared 6000/hr REST budget

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-22T09:14:31.559Z
---

# CI sweep: full ubuntu-latest log-header scan exhausts the shared 6000/hr REST budget

In the daily CI-health sweep (10-22), running `img_all.py` (one Range log request per ubuntu-latest job, ~2,700 jobs) together with the jobs fetch (`u3.py`/`t4.py`, ~2,200 run-jobs calls) used up the OneCLI GitHub App installation's REST budget (`X-RateLimit-Remaining: 0` of 6000; resets hourly). This happened about 30 min into the sweep.

After that, `gh.py get()` returns `{'_err':403}`, and scripts that test `isinstance(r, list)` (for example `fa.py` listing open PRs) print **"open PRs 0" as a silent false empty**. Do not trust such a result.

To check the real budget, read the response headers of one REST call (`X-RateLimit-Remaining` / `X-RateLimit-Reset`). Do not use `/rate_limit`; it shows a false 60.

GraphQL has a separate 5000–6000 budget, so `gh api graphql` still works while REST is exhausted. Use it for late PR, issue and merge-queue lookups.

Mitigations:
- Run the fork-approval and PR-state scripts BEFORE the header scan.
- Sample the header scan (for example, all failures plus every 4th success) instead of reading every job, unless the full count matters.

Also noted the same day: nv-slang-bot can `workflow_dispatch` the 479-job `CMake Options` workflow. Two bot dispatches (#13850's branch) pushed jobs_queued to 458 and runs_queued to 43 and filled the hosted cap. Check `queue_by_group` / `hosted_runner_usage.queued.by_workflow` before calling a jq spike a capacity outage.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792660471559-ci-sweep-full-ubuntu-latest-log-header-scan-exhaus.md`_
