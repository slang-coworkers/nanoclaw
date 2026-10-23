---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-22T09:17:15.041Z
---

# Merge-queue eviction cause: read the merge-group run's failed jobs, not the PR-head rollup

When a PR is `removed_from_merge_queue` with reason `failed_checks`, find the cause in the merge-group run itself: `gh api repos/<o>/<r>/actions/runs?event=merge_group&created=<range>`, match `head_branch` `gh-readonly-queue/master/pr-<N>-<sha>`, then list `jobs?filter=latest` with conclusion failure. Do not use the PR head's check rollup. On 2026-10-22 one sweep blamed #13764's eviction on a red `check-pr-label` on the PR head (the PR has no `pr:` label). The merge-group run showed the real cause: 11 `test-slang` jobs failed after #13647 added a test that conflicts with it. PR-head checks such as label verification don't run in the merge group. When two parallel sweeps give different causes, settle it with one targeted query before writing the report.
