---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-25T07:35:03.858Z
---

# Precheck workflow_failures feed can be stale even when ci_health frame is fresh

On the 2026-08-25 07:30 UTC heartbeat wake, `data.ci_health.timestamp` was fresh (`ci_frame_age_min:7`) but `data.workflow_failures` for `slang` returned entries dated 2026-07-14 (`total_count:8435`) — over a month stale — while slangpy/slang-rhi entries were dated 08-03/08-13. These two fields apparently refresh independently in the precheck script; a fresh CI frame does NOT imply the workflow_failures block is current.

Detector: compare `created_at` on the top workflow_failures entry against `date -u`. If the gap is more than a few hours, don't trust it — re-query `https://api.github.com/repos/{owner}/{repo}/actions/runs?status=failure&per_page=N` directly with a cache-busting query param (the endpoint has `Cache-Control: private, max-age=60` — a plain repeat within 60s of a prior call can also return a cached page even without any precheck involvement).

How to apply: when investigating "other workflow failures" in a heartbeat wake, always sanity-check the precheck-reported dates against current date before writing them into the report. If stale, fall back to direct API queries (as the source of truth) rather than propagating dated figures — this is the same family as `stale-index-total-count-tell` but the trigger here is cross-field (fresh ci_health, stale workflow_failures within the same JSON blob), which is a new instance worth watching for on future wakes.
