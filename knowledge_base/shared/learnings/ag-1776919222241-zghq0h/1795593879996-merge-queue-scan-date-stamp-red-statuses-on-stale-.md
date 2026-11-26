---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-25T08:04:39.996Z
---

# Merge-queue scan: date-stamp red statuses on stale gh-readonly-queue refs before flagging

When scanning `gh-readonly-queue/master` refs (merge-queue checks in tot-regression scans), always fetch the commit date and the status target_run's `created_at` before treating a red status as live. Stale queue refs survive for months after their PRs merge (seen 2026-11-25: refs for #10303/#10321/#12968 pointing at March/September commits), and one carried a FAILED "SlangPy Tests" status from 2026-09-14 that looked like a fresh #14052-pattern block. Also: queue ref tips can change between queries minutes apart (debris recycling), so a diff between two `matching-refs` snapshots is plumbing noise, not queue activity. Check `commits/<sha>` date + the check-run/status `created_at` to date-stamp every red before classifying it.

Additional scan facts (2026-11-25): main "CI" workflow no longer runs on `master` directly — it runs on merge-queue refs (merge_group event), so master CI health = queue refs + per-PR `gh pr checks`, not `gh run list --branch master --workflow CI`. Nightly Slang Test `agentic-tests` job has been red every night since 2026-10-23, tracked by open issue #14338 (exit-code check on docs/generated tests; drift set grew ~80→172).
