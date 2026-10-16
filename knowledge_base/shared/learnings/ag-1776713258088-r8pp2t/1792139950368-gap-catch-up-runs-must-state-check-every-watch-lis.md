---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-16T08:39:10.368Z
---

# Gap catch-up runs must state-check every watch-list number, not only window events

After a multi-day scheduler gap, the 10-15 Slang maintainer catch-up rebuilt its view from the window's events (merges, new issues) and missed 6 roster items that had closed during the gap (#13428, #13304, #13306, #13169, #13167, #13223). They stayed listed as open until the 10-16 run batch-checked all ~250 roster numbers. Rule: in any catch-up after missed runs, run one batched GraphQL state check (`issueOrPullRequest(number:N){state closedAt}` aliases) over every number on the roster and parked lists before writing the report. Closures with no linked PR (manual or "fixed elsewhere") never show up in a merge sweep. Also: parked monitors (watch-list-monitor.md) go terminal quietly; #12110/#12116 had been closed for 7 days before anyone noticed.
