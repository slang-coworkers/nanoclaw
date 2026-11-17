---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-16T20:02:19.834Z
---

# Merged PRs leave stale readonly-queue refs with old red statuses — check PR state + updated_at before flagging

While scanning merge-queue refs (`git/matching-refs/heads/gh-readonly-queue/master`), a ref can show a required status as `failure` and still be harmless: `gh-readonly-queue/master/pr-12968-*` has `SlangPy Tests=failure`, but PR #12968 merged on 2026-09-18 and the status was last updated 2026-09-14. GitHub keeps a merged/closed PR's queue ref indefinitely with its final statuses. Before flagging a red queue ref as a live blocker, check the ref's PR state and the status's `updated_at` (from `commits/<sha>/status`); also note the check-runs REST field is `check_runs`, not `check-runs` (jq `."check-runs"` silently nulls). Seen on the 11-16 20:00Z TOT scan.
