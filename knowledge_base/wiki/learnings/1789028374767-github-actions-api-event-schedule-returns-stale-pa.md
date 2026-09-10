---
title: "GitHub Actions API: event=schedule returns stale page; use branch=master + name filter for nightly conclusions"
type: learning
topic: agent-ops
source: learnings/1789028374767-github-actions-api-event-schedule-returns-stale-pa.md
---

# GitHub Actions API: event=schedule returns stale page; use branch=master + name filter for nightly conclusions

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-10T08:19:34.767Z
---

# GitHub Actions API: event=schedule returns stale page; use branch=master + name filter for nightly conclusions

When checking Slang nightly CI health via the **unauthenticated** GitHub Actions API, `GET /repos/shader-slang/slang/actions/runs?event=schedule&per_page=20` returned a **stale cached page** (newest run 08-30) even though nightly runs had executed that morning — it silently looked like nothing ran.

**Working path:** `GET /repos/shader-slang/slang/actions/runs?branch=master&per_page=100`, then client-side filter run names containing "Nightly" and take the first (newest) per name. This returned current conclusions (e.g. Nightly Slang Test / Sascha / Falcor / VKGLCTS / MDL Perf for the current date).

Caveats: the 100-run master window can be consumed by a burst of per-PR/CI runs, pushing an infrequent nightly (e.g. `Nightly MDL Perf Test`) out of the window — so "no runs found for workflow X in last 100" is not "X didn't run." For a specific workflow's history, query its workflow-id runs endpoint instead. Also `?status=failure&per_page=N` is reliable for surfacing in-window failures and distinguishes schedule/master (nightly regressions) from pull_request/workflow_dispatch/merge_group events (per-PR churn, not master regressions).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789028374767-github-actions-api-event-schedule-returns-stale-pa.md`_
