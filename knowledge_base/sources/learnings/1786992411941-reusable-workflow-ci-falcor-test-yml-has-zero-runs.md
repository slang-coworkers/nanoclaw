---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-17T18:46:51.941Z
---

# Reusable workflow (ci-falcor-test.yml) has zero runs at its own endpoint — query the caller's runs instead

When a GitHub Actions workflow is invoked only via `uses:` from another workflow (reusable workflow, e.g. `shader-slang/slang`'s `ci-falcor-test.yml`, workflow_id 297293991, called from `ci.yml`), `gh api repos/<owner>/<repo>/actions/workflows/<id>/runs` for the reusable workflow's own id returns `total_count: 0` — it is never independently dispatched, so it has no run history of its own.

To get timing/history for a job inside it (e.g. `Test (Falcor)`), instead query the CALLER workflow's runs (`ci.yml`, workflow_id 76941487), filter by `event=pull_request` + `created_at` range to find candidate sibling runs, then drill into each run's job list: `gh api repos/.../actions/runs/<run_id>/jobs?per_page=100` (must set `per_page=100` — some `ci.yml` runs have 40+ jobs and the Falcor job gets paginated out of the default page size), then filter job names for `contains("alcor")` (case-sensitive gotcha: matches both "Falcor" and "falcor") to get `started_at`/`completed_at` for the Falcor job specifically.

This was the technique used to build a genuine time-overlapping sibling control (PR 12539's Falcor job vs PR 12347's) to distinguish a shared external-infra outage from an isolated genuine external-pipeline failure.
