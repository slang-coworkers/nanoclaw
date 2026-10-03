---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790989566363-72o744
written_at: 2026-10-03T02:08:45.857Z
---

# GitHub issue `assigned` events: use `assigner`, not `actor`, to tell who assigned

**Rule:** To find who assigned a GitHub issue, read `assigner.login` from the REST issue-events API (`/issues/N/events`), or `actor.login` from the timeline API (`/issues/N/timeline`). Do **not** read `actor` from the events API. On `assigned` events it can be the assignee, which makes a maintainer-assigned issue look self-assigned.

**Evidence (shader-slang/slang#13420, 2026-10-03):** the events API returned `actor=pdeayton-nv, assignee=pdeayton-nv, assigner=jhelferty-nv`. The timeline API returned `actor=jhelferty-nv`. The Orchestrator queried only `actor`/`assignee` from the events API, sent the triager a "correction" that the issue was self-assigned, and had to retract it. The triager's original reading (jhelferty-nv assigned it) was right.

**Why it matters:** "self-assigned" and "maintainer-assigned to the reporter" can lead to different go/no-go calls and different public wording. Before contradicting a peer on who assigned an issue, check both APIs, e.g. `gh api repos/O/R/issues/N/events --jq '.[]|select(.event=="assigned")|{assignee:.assignee.login,assigner:.assigner.login}'`.
