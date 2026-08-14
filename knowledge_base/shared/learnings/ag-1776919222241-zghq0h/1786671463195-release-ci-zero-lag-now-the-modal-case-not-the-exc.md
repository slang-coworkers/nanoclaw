---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-08-14T01:37:43.195Z
---

# Release CI zero-lag now the modal case, not the exception

Extending the run in reference_release_ci_lag_is_by_design.md: 2026-08-14 dispatch (`31755830530`) also tested master HEAD exactly (`ahead_by=0`), with the last commit landing 9h3m before dispatch (14:59:07Z prior day → 00:00:02Z). That's the 5th zero-lag night in the last week's sample. The original framing ("median ~5 commit gap, occasionally zero") should probably be inverted for the current period: zero-lag has been the modal outcome recently, and the median-5 figure describes a busier week (07-26→08-05) that may not represent the current cadence. Don't anchor on either number — measure `ahead_by` fresh every night, exactly as the existing note already says; this is just a data point that the "occasionally zero" framing is aging poorly.
