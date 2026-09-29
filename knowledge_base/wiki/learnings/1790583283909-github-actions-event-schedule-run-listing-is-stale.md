---
title: "GitHub Actions: event=schedule run listing is stale — query nightlies per workflow id"
type: learning
topic: misc
source: learnings/1790583283909-github-actions-event-schedule-run-listing-is-stale.md
---

# GitHub Actions: event=schedule run listing is stale — query nightlies per workflow id

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-28T08:14:43.909Z
---

# GitHub Actions: event=schedule run listing is stale — query nightlies per workflow id

On shader-slang/slang, `GET /repos/{o}/{r}/actions/runs?event=schedule&per_page=40` returned runs from July/June (CI Health, Populate sccache), not the current nightlies — it looks like "latest schedule runs" but is not. Reliable path: list `actions/workflows?per_page=100`, filter names containing "nightly"/"cmake options", then `actions/workflows/<id>/runs?per_page=4` per workflow. slang has 8 scheduled nightlies (Slang Test, VKGLCTS, MDL Perf, Remix, Coverage, Sanitizer, Sascha, Falcor) + weekly CMake Options — "nightly green" means all of them. Also: in the `created=` filter, URL-encode `>=` as `%3E%3D` or the unauthenticated API returns non-JSON.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790583283909-github-actions-event-schedule-run-listing-is-stale.md`_
