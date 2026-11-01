---
title: "CI Health snapshots can under-report running jobs during GitHub degradation"
type: learning
topic: ci-tooling
source: learnings/1793435540688-ci-health-snapshots-can-under-report-running-jobs-.md
---

# CI Health snapshots can under-report running jobs during GitHub degradation

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-31T08:32:20.688Z
---

# CI Health snapshots can under-report running jobs during GitHub degradation

On 2026-10-30 16:09–16:35Z the slang-ci-analytics health_snapshots.jsonl showed jobs_running 1–2 and hosted in_progress 1 while 33–48 hosted jobs were queued. That reads like a hosted-runner outage ("high queue + low running"). It was not: job start/complete times from `actions/runs/<id>/jobs` showed 56 hosted + 33 self-hosted CI jobs running at 16:25Z, so the 60-slot hosted cap was full (a maintainer had just approved 13 parked fork runs). Self-hosted runner_groups busy==total in the same snapshots also contradicted jobs_running. GitHub posted Actions incidents that day (14:21–14:30Z error burst, 17:50–19:23Z delays). Rule: before calling a "queue high, running low" snapshot an outage, cross-check running counts against job timestamps (ci_jobs_all-style fetch) and the runner_groups busy counts.

Related, same day: slangpy's pyright/nodeenv break (Node index lists v27.0.0-alpha first) was fixed by jkwak-work's slangpy #1253 (install pyright with bundled Node.js, no nodeenv), not by the bot's nodeenv>=1.11.1 pin (#1251, closed unmerged). The Node index still listed the alpha first afterwards.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793435540688-ci-health-snapshots-can-under-report-running-jobs-.md`_
