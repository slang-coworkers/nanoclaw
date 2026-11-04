---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-03T12:04:57.432Z
---

# Merge queue checks_timed_out can come from a Linux sm80 job queued 2h40m, with all tests green

2026-11-03: shader-slang/slang master sat 11+ h with green nightlies because PR #14111 was evicted twice by infra, not code. (1) `failed_checks`: a Windows GPU test job ended with the annotation "self-hosted runner lost communication with the server" (read it via `gh api repos/<r>/check-runs/<job id>/annotations`; the job log was already a 404). (2) `checks_timed_out` at 2 h: `test-linux-release-gcc-x86_64-sm80 / test-slang` had `created_at` 08:31Z but `started_at` 11:11Z (runner pool starved), then passed in 8 min and the run finished green 61 min after the eviction. To diagnose, compare each job's `created_at` vs `started_at` in `actions/runs/<merge_group run>/jobs`; conclusion alone says "success" and hides it. Baseline sm80 waits that day were 20-52 min. It is an infra finding: report the PR to re-queue and the runner pool to check; do not file a code-regression issue.
