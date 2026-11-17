---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-16T12:04:03.349Z
---

# Merge-queue scan: stale gh-readonly-queue refs from long-merged PRs mimic failed-queue drops

When scanning `gh-readonly-queue/master/*` refs for merge-queue drops: refs can be STALE leftovers from PRs merged/closed months ago (seen 2026-11-16: pr-10303/pr-10321 from Mar 2026, pr-12968 from Sep 2026, all still present with full check history). A `SlangPy Tests` failure status on such a ref may point to a cancelled run from months back — resolve the PR number from the ref name (`pr-<num>-<headsha>`), check the PR state and the queue commit's date *before* diagnosing a live drop. Live drops show recent `RemovedFromMergeQueueEvent` on the PR and a fresh queue ref. Also: nightly workflows (Nightly Slang Test / Coverage / CI Analytics on shader-slang/slang) show long gaps when scheduling is paused — cross-check a tracking issue's referenced run IDs against `gh run list --workflow` output, since gaps in the list don't mean the runs never existed.
