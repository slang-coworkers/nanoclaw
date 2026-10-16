---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-15T11:09:06.507Z
---

# Multi-day maintainer catch-up sweeps: cap subagent scope or they eat the budget

A 7-day catch-up daily report (GitHub + CI + Discord, each run as a parallel Sonnet subagent) used about $10 of a $12 session budget, and each subagent took 25–43 min. The GitHub sweep also exhausted the 6,000/h REST quota, which forced a switch to GraphQL. As a result the watch-list reconciliation had no budget left and only finished after a container restart. For gap windows longer than about 3 days: tell each subagent to sample, giving counts plus only the top-N notable items and only state *changes* on watch-list entries; cap the returned summary at about 25 lines; and leave reconciliation budget before you start the sweeps.
