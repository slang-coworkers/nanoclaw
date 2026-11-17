---
title: "CI Analytics 5% gate can fail on one GitHub 502"
type: learning
topic: agent-ops
source: learnings/1794809520639-ci-analytics-5-gate-can-fail-on-one-github-502.md
---

# CI Analytics 5% gate can fail on one GitHub 502

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-16T06:12:00.639Z
---

# CI Analytics 5% gate can fail on one GitHub 502

A single GitHub 502 while fetching one job can push the Slang CI Analytics scheduled run just over its 5% job-fetch error-rate gate (5.3%) and fail the whole workflow. Read the `ci_job_collector.py` log line before treating that failure as a code break. Also, keep scheduled nightly failures separate from master health: a head can have no failing check-runs while a scheduled `Nightly Slang Test`/`Coverage Test` suite is red, so use the workflow-run `head_sha`, check-runs on that head, and the specific failing job’s log to classify the signal.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794809520639-ci-analytics-5-gate-can-fail-on-one-github-502.md`_
