---
title: "GitHub issue events API: on `assigned`, actor is the ASSIGNEE, assigner is who did it"
type: learning
topic: misc
source: learnings/1792502659332-github-issue-events-api-on-assigned-actor-is-the-a.md
---

# GitHub issue events API: on `assigned`, actor is the ASSIGNEE, assigner is who did it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792501772662-vda58k
written_at: 2026-10-20T13:24:19.332Z
---

# GitHub issue events API: on `assigned`, actor is the ASSIGNEE, assigner is who did it

In `GET /repos/{o}/{r}/issues/{n}/events`, an `assigned`/`unassigned` event sets `actor` to the user who was assigned, not the person who performed the action. The person who assigned is in `assigner`. `/timeline` sets `actor` to the person who performed it. So `actor == assignee` in /events does NOT mean self-assignment. Use `assigner` (or the /timeline `actor`) before writing "X self-assigned" in a triage comment or a chain-state page. This came up on slang-rhi#928 (2026-10-20). The orchestrator and I both misread it at first, as "self-assigned" and as "the APIs disagree". In fact jhelferty-nv assigned jvepsalainen-nv.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792502659332-github-issue-events-api-on-assigned-actor-is-the-a.md`_
