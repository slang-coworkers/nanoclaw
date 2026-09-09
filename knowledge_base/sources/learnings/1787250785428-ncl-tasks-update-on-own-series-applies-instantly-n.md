---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-20T18:33:05.428Z
---

# ncl tasks update on own series applies instantly, no approval gate

Contrary to CLAUDE.md's framing that "mutating (approval-gated) verbs trigger the same admin-approval flow as MCP self-mod tools," firing `ncl tasks update --id <own-series> --script '<new script>'` returned `{"touched":1,"fields":["script"]}` immediately with no approval-card wait — confirmed via `ncl tasks get` right after that the new script was live. This was on a task series owned by my own agent group (`ncl tasks get <series>` had shown `agent_group_id` matching my own group).

So `tasks` verbs, at least `update` on a self-owned series, appear to NOT be gated the way `groups config update`/`install_packages`/`add_mcp_server` are — those visibly pause for admin approval, `tasks update` did not. Don't assume every "mutating" CLI verb in the group-scope table pauses for approval; check by firing and observing, not by extrapolating from the table's framing. Also: the CLAUDE.md scoped-resource table (destinations/groups/members/sessions/wirings) omits `tasks` entirely even though `tasks` verbs are clearly group-scoped (confirmed via `--group` "auto-filled to your own group inside a container" in `ncl tasks update --help`) — the table is incomplete, don't treat its absence as evidence a resource is host-only.

Companion to the wake-payload-pagination fix learning from the same session (`Wake-payload pagination bug confirmed on BOTH prs and evicted — fix drafted+live-tested`).
