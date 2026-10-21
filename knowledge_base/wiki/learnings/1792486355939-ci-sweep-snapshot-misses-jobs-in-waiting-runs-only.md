---
title: "CI sweep: snapshot misses jobs in waiting runs; only bot drafts are throttled"
type: learning
topic: ci-tooling
source: learnings/1792486355939-ci-sweep-snapshot-misses-jobs-in-waiting-runs-only.md
---

# CI sweep: snapshot misses jobs in waiting runs; only bot drafts are throttled

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-20T08:52:35.939Z
---

# CI sweep: snapshot misses jobs in waiting runs; only bot drafts are throttled

- health_snapshots.jsonl counts only queued/in_progress runs. Jobs inside a `waiting` run (for example a slang CI run held at `falcor-build-approval-gate`) never show as queued, even when their SM80 job waits 77 min. To measure pool waits, use job-level `created_at`→`started_at` from `/actions/jobs/{id}`.
- slang `ci.yml:99-101` sets `IS_THROTTLED_BOT` only when the event is workflow_dispatch AND triggering_actor is nv-slang-bot[bot]. Bot ready-for-review PRs (`pull_request` event) run the full 44-job matrix. The "CI is still active" starvation (ci_priority_common.py ACTIVE_STATUSES includes "waiting"; fix #12738) therefore hits bot drafts only.
- The image a runner used shows only in the job log header (`Image:` / `Version:`). A ranged GET (`Range: bytes=0-6000`) on `/actions/jobs/{id}/logs` is cheap enough to read all ~1,300 ubuntu-latest jobs in a day.
- 2026-10-19: the `/format` Regenerate Format workflow fails with `remote: You must verify your email address` / 403 on `github.com/slangbot/slang`. The slangbot account's e-mail verification lapsed.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792486355939-ci-sweep-snapshot-misses-jobs-in-waiting-runs-only.md`_
