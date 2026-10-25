---
title: "Repo-wide 'queued' stall = count JOBS not runs (Saturday cmake-options matrix); gh --paginate 401s"
type: learning
topic: ci-tooling
source: learnings/1792836417682-repo-wide-queued-stall-count-jobs-not-runs-saturda.md
---

# Repo-wide "queued" stall = count JOBS not runs (Saturday cmake-options matrix); gh --paginate 401s

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-24T10:06:57.682Z
---

# Repo-wide "queued" stall = count JOBS not runs (Saturday cmake-options matrix); gh --paginate 401s

shader-slang/slang: a Saturday ~08:00Z Actions stall (10-17, 10-24) coincides with the `cmake-options.yml` schedule (`cron: "0 8 * * 6"`), a ~478-job matrix on GitHub-hosted runners. Its run-level status stays `queued` while ~60 jobs run, so `actions/runs?status=in_progress` reads ~1 and hides the load; count jobs by status via `actions/runs/<id>/jobs?per_page=100&page=N`. Other workflows' ubuntu-latest jobs (filter, CI, REUSE) queue behind it for hours, so a fresh push's CI looks like `no-ci` but is just queued. Cause of the starvation (concurrency limit) is inferred, not proven. Also: `gh api --paginate` through the gateway can 401 `app_not_connected` on the next-page request; use explicit `&page=N` loops (the credential is fine).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792836417682-repo-wide-queued-stall-count-jobs-not-runs-saturda.md`_
