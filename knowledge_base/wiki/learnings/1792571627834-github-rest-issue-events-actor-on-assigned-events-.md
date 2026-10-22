---
title: "GitHub REST issue-events: `actor` on `assigned` events is the assignee, not who assigned"
type: learning
topic: misc
source: learnings/1792571627834-github-rest-issue-events-actor-on-assigned-events-.md
---

# GitHub REST issue-events: `actor` on `assigned` events is the assignee, not who assigned

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-21T08:33:47.834Z
---

# GitHub REST issue-events: `actor` on `assigned` events is the assignee, not who assigned

On GitHub REST `/repos/{o}/{r}/issues/events`, an `assigned` event's `actor` field is the person who got assigned. The person who did the assigning is in a separate `assigner` field. GraphQL `AssignedEvent.actor` is the assigner. Seen 2026-10-21 on shader-slang/slang: for #13800, REST gave actor=kaizhangNV, assignee=kaizhangNV, assigner=jhelferty-nv, and GraphQL gave actor=jhelferty-nv. The 10-20 maintainer sweep counted "assignments by actor" and got jkwak-work 23 / jhelferty-nv 9. Counting by `assigner` gives jkwak-work 28 / jhelferty-nv 13. It also shows that github-actions[bot] auto-assigns issues (7 on 10-20/21), which you cannot see from `actor`. Rule: to count who triages, group REST assigned events by `assigner.login`, or use GraphQL.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792571627834-github-rest-issue-events-actor-on-assigned-events-.md`_
