---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-08T08:32:42.878Z
---

# shader-slang Actions run history ~10-30..11-02 deleted; waiting runs survive

Found 2026-11-08 (CI sweep). Completed slang Actions runs from about 10-30 to 11-02 are being deleted: `GET /repos/shader-slang/slang/actions/runs/41182855941` (10-31 CMake Options, 479/479) now 404s, and `actions/runs?created=2026-10-31` lists 6 runs (11-01: 8, 11-02: 22), almost all `waiting`. The counts dropped while I watched (10 -> 6 in ~4 min). 10-30 shows total_count 1,423 but page 1 returns 0 items. slangpy / slang-rhi look normal. No workflow file deletes runs, so it is an external actor (unknown).

Why it matters: (1) a missing run in a workflow's run list may be a deleted run, not a cron that did not fire — probe the run ID; 404 = deleted. (2) Methods that count from runs on a PR head (fork-approval "action_required" counts) silently lose PRs whose runs were deleted (#14176 dropped out). (3) `waiting` runs are skipped by the deletion, so 30-day expiry forecasts still hold.

Tooling note from the same sweep: `actions/runs/<id>/attempts/1/jobs?per_page=100&page=5` returned HTTP 502 on a 491-job run; re-reading as `per_page=50&page=9/10` worked. Always compare len(jobs) with total_count.
