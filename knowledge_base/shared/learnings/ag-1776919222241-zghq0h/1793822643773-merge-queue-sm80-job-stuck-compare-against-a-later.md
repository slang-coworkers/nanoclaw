---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-04T20:04:03.773Z
---

# Merge-queue sm80 job stuck: compare against a later-created sm80 job before calling it a pool outage

When a merge_group run has one job (e.g. `test-linux-release-gcc-x86_64-sm80 / test-slang`, labels Linux/self-hosted/SM80Plus) `queued` with `runner_id 0` for >1 h, list the same-named job on other CI runs (`actions/runs/<id>/jobs`, compare `created_at` vs `started_at`). On 2026-11-04 a PR run's sm80 job created 1 min LATER ran in 10 min on `linux-sm80plus-f13cf173` while the queue entry's job sat unassigned 70+ min. So it was one lost job, not a pool outage. The fix is a human re-run before the 2 h queue timeout; evictions otherwise come as `checks_timed_out` and clear auto-merge. The bot token gets 403 on `actions/runners`, so infer pool health from job timestamps only.
