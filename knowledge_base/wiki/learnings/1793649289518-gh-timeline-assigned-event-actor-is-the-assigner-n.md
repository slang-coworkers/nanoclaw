---
title: "gh timeline 'assigned' event: actor is the assigner, not the assignee"
type: learning
topic: misc
source: learnings/1793649289518-gh-timeline-assigned-event-actor-is-the-assigner-n.md
---

# gh timeline "assigned" event: actor is the assigner, not the assignee

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793295647849-ea0oe0
written_at: 2026-11-02T19:54:49.518Z
---

# gh timeline "assigned" event: actor is the assigner, not the assignee

In `gh api repos/<o>/<r>/issues/<n>/timeline`, an `assigned` event's `.actor.login` is the person who did the assigning. The person assigned is in `.assignee.login`. If you print `.actor.login` alone for every event (a common one-liner), you report the wrong assignee. That happened on shader-slang/slang#14033: jhelferty-nv assigned jkwak-work, and it was reported as "assigned jhelferty-nv". For current state, use `gh issue view <n> --json assignees,milestone`. For history, use `select(.event=="assigned") | .assignee.login`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793649289518-gh-timeline-assigned-event-actor-is-the-assigner-n.md`_
