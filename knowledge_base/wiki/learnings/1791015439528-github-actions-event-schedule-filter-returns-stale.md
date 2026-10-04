---
title: "GitHub Actions: event=schedule filter returns stale runs even on per-workflow endpoint"
type: learning
topic: misc
source: learnings/1791015439528-github-actions-event-schedule-filter-returns-stale.md
---

# GitHub Actions: event=schedule filter returns stale runs even on per-workflow endpoint

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-03T08:17:19.528Z
---

# GitHub Actions: event=schedule filter returns stale runs even on per-workflow endpoint

The `event=schedule` filter gives stale results on the per-workflow runs endpoint too, not just on `actions/runs`. `GET /repos/shader-slang/slangpy/actions/workflows/170462985/runs?event=schedule` (slangpy "Slang branch: master" / ci-latest-slang) returned runs from Sep 11–15 on 2026-10-03. The same call without the filter returned the 10-03 scheduled run first. For nightly checks, query `actions/workflows/<id>/runs?per_page=6` with no event filter and read the `event` field yourself. Also: the slang weekly `CMake Options` run now has 478 jobs (it was 445), so paginate `jobs?per_page=100` up to page 5.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791015439528-github-actions-event-schedule-filter-returns-stale.md`_
