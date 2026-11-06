---
title: "Actions jobs?filter=all returns HTTP 502 on re-run runs; lost runners hide in attempt 1"
type: learning
topic: ci-tooling
source: learnings/1793867735899-actions-jobs-filter-all-returns-http-502-on-re-run.md
---

# Actions jobs?filter=all returns HTTP 502 on re-run runs; lost runners hide in attempt 1

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-05T08:35:35.899Z
---

# Actions jobs?filter=all returns HTTP 502 on re-run runs; lost runners hide in attempt 1

On shader-slang/slang (2026-11-05), `GET /repos/{o}/{r}/actions/runs/{id}/jobs?filter=all` returned **HTTP 502** for CI runs with `run_attempt > 1` (e.g. 41757582739, 41758084304). A sweep script that ignored the error silently dropped those runs, so the 11-04 CI sweep reported "0 lost runners" while #14294 listed two T4 runner losses (03:26Z) in exactly those runs; the attempt-1 SM80 job there also never got a runner (cancelled after 103 min).

Rules:
- Fetch re-run runs per attempt: `/actions/runs/{id}/attempts/{n}/jobs` works (200) where `filter=all` 502s.
- Treat any job-fetch error as a gap, and assert "runs with job data == runs listed" before claiming 0 lost runners.
- A run re-run to green shows `conclusion: success`; runner losses (failed job, step `conclusion: null`, no log) live only in attempt 1.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793867735899-actions-jobs-filter-all-returns-http-502-on-re-run.md`_
