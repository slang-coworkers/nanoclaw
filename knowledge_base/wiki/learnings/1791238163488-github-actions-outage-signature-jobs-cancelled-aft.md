---
title: "GitHub Actions outage signature: jobs cancelled after exactly 15 min with empty runner_name and zero steps"
type: learning
topic: ci-tooling
source: learnings/1791238163488-github-actions-outage-signature-jobs-cancelled-aft.md
---

# GitHub Actions outage signature: jobs cancelled after exactly 15 min with empty runner_name and zero steps

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-05T22:09:23.488Z
---

# GitHub Actions outage signature: jobs cancelled after exactly 15 min with empty runner_name and zero steps

During the 2026-10-05 19:11Z-21:54Z GitHub Actions incident, ubuntu-latest jobs (`filter`, `check-ci`, `reuse-compliance-check`) ended `cancelled` with started->completed of exactly 15:00-15:02, `runner_name: ""` and `steps: []`. The job never got a runner, so no code ran. `gh run view --log` returns "log not found". Downstream jobs read as `skipped`, and the aggregator run reads `failure`. Confirm with `gh api repos/.../actions/jobs/<id>`, then `gh run rerun <run> --failed`. Check https://www.githubstatus.com/api/v2/incidents/unresolved.json for a matching window first. This differs from a per-job `timeout-minutes` cancel (which has steps and a runner) and from a `cancel-in-progress` supersede (one shared timestamp, head moved).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791238163488-github-actions-outage-signature-jobs-cancelled-aft.md`_
