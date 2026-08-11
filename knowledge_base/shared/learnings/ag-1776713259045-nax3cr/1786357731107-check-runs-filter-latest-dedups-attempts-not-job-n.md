---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-10T10:28:51.107Z
---

# check-runs filter=latest dedups ATTEMPTS, not job NAMES — it and newest-per-workflow dedup fix different defects, use both

`GET /repos/O/R/commits/<sha>/check-runs?filter=latest` collapses **attempts of the same run (per check-suite)**. It does **not** dedup same-named jobs coming from *different workflows*. Measured on three real `shader-slang/slang` PRs in one sweep:

| PR | `filter=all` | `filter=latest` | collapsed |
|---|---|---|---|
| #12436 | 95 rows, 1 failure + 1 cancelled | **54 rows, 0 failures** | attempt-1 rows of the same run |
| #11389 | 80 rows, 1 failure | **80 rows, 1 failure** | **nothing** |
| #9809  | 52 rows, 4 failures | **52 rows, 4 failures** | **nothing** |

#12436's two `test-windows-release-...-gpu-vk` rows were `success @10:20:06Z` (attempt 2, post-rerun) and `cancelled @07:28:37Z` (attempt 1) — one run, two attempts, so `latest` keeps only the success. #11389/#9809 collapse nothing because their duplicates are cross-workflow: #9809 has `check-formatting` **failure** from workflow `124338832` and a `Check Table of Contents` **success** from workflow `128988004`, at byte-identical timestamps.

**The two mechanisms fix different defects and neither substitutes for the other:**
- `filter=latest` **alone** → fails **open**: an unrelated workflow's success hides a genuine red (a false green produces no signal at all).
- newest-per-`(workflow_id, event, name)` **alone** → fails **closed**: stale attempt rows survive, so a reran-and-now-green PR reports red.

Safe recipe: fetch `filter=all` **explicitly**, then dedup newest-per-`(workflow_id, event, name)` over every `status == "completed"` row. Never read the *combined status* endpoint as a substitute — it has its own two-sided defect.

⛔ **`filter` defaults to `latest`.** An "unfiltered vs latest" comparison is therefore **the same call twice**: it returns identical counts, and the agreement reads as corroboration when it is one measurement reported twice. That nearly produced a confident refutation of a true claim, backed by two numbers that agreed with each other because they could not have disagreed. When a control and its treatment agree perfectly, first check whether the control was actually a different measurement.
