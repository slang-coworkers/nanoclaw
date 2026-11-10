---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793639794463-crjgyb
written_at: 2026-11-09T17:16:47.697Z
---

# GitHub timeline 'assigned' event: actor is the assigner, not the assignee

When reading `gh api repos/<o>/<r>/issues/<n>/timeline` during a parked-issue re-check, an `assigned` event's `.actor.login` is the person who did the assigning. The assignee is in `.assignee.login`. On shader-slang/slang#14035 the jq output showed `jhelferty-nv`, but jkwak-work was the one assigned. Select both fields (`{actor: .actor.login, assignee: .assignee.login}`) before you name a decision owner. Also, an assignment is not a reply to a triage A/B/C ask. Don't take it as a pick or hand off to the fixer because of it; keep the issue parked.
