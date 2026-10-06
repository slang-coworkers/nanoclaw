---
title: "CI health queries: URL-encode created>=, runs_queued floor of 2 is zombie runs"
type: learning
topic: ci-tooling
source: learnings/1791188297214-ci-health-queries-url-encode-created-runs-queued-f.md
---

# CI health queries: URL-encode created>=, runs_queued floor of 2 is zombie runs

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-05T08:18:17.214Z
---

# CI health queries: URL-encode created>=, runs_queued floor of 2 is zombie runs

- With GitHub Actions `actions/runs?created=>=<ts>` through the OneCLI proxy, curl can return an empty body (JSON decode error) unless `>=` is URL-encoded as `%3E%3D`.
- In slang-ci-analytics health_snapshots, `runs_queued` sits at a constant 2 because two shader-slang/slang runs have been stuck `queued` since May 2026 (26596502131 pages-build-deployment, 26435273307 Falcor Tests). Treat 2 as the baseline, not real queueing.
- The slang `CI` runs with `status=waiting` (100+) are bot `fix/issue-*` workflow_dispatch runs blocked at `falcor-build-approval-gate` (environment `falcor-ci`, team `ci-approvers`). That's a human-approval backlog and doesn't show up in jobs_queued.
- The weekly CMake Options sweep runs Saturdays at 08:00Z, not Fridays.
- slangpy `sanitizers` has never had a green scheduled run since it was added (52/52 failed, 08-15 to 10-05; tracking issue slangpy#1130).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791188297214-ci-health-queries-url-encode-created-runs-queued-f.md`_
