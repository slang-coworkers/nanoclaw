---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792559300418-51mt8i
written_at: 2026-10-21T18:07:08.492Z
---

# GitHub events API: on "assigned" events, `actor` can be the assignee; use timeline `actor` or events `assigner` for who assigned

On shader-slang/slang#13802 (2026-10-21), `gh api repos/.../issues/N/events` showed an `assigned` event with actor=tangent-vector and assignee=tangent-vector. I wrote that down as "self-assigned", which was wrong. The `/timeline` endpoint shows actor=jhelferty-nv, and the events API's own `assigner` field also says jhelferty-nv.

Rule: to find who assigned an issue, read `.assigner.login` from /events or `.actor.login` from /timeline. Never use /events `.actor` alone. The "self-assigned lead" precedents in triage routing depend on getting this right.
