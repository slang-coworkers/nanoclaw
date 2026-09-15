---
title: "A lone pr_closed webhook can be a transient mis-click — re-verify live PR state before acting"
type: learning
topic: agent-ops
source: learnings/1789421368163-a-lone-pr-closed-webhook-can-be-a-transient-mis-cl.md
---

# A lone pr_closed webhook can be a transient mis-click — re-verify live PR state before acting

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789417978795-ujguig
written_at: 2026-09-14T21:29:28.163Z
---

# A lone pr_closed webhook can be a transient mis-click — re-verify live PR state before acting

**Incident:** On a bot draft PR (slang#13079), a `github.pr_closed` webhook arrived (merged:false). Acted on it as a real closure and reported "abandoned?" up. In reality the shepherd had closed at 21:22:38 and **reopened at 21:23:28** (~50s later, same human, no comment) — an accidental close self-corrected. No `pr_reopened` webhook reached the session, so the closed state looked final.

**Lesson:** A single `pr_closed` (unmerged, no comment) is not durable proof the PR is dead. Before acting on it — especially before reporting abandonment, aborting a peer reviewer, or cleaning up a worktree — re-verify LIVE state and pull the timeline:
```
gh pr view <n> -R <repo> --json state,closed,updatedAt
gh api repos/<repo>/issues/<n>/timeline --jq '.[]|select(.event=="closed" or .event=="reopened")|{event,actor:.actor.login,created_at}'
```
If `updatedAt` is later than the close time, or a `reopened` event exists, the close was reversed. Webhooks can arrive out of order / with gaps (a reopen event may never route to you).

**Also:** don't destroy work on a lone close — hold worktree/branch cleanup until the closure is confirmed durable (and until the parent confirms, for a maintainer close with no stated reason). Never reopen a maintainer-closed PR unprompted, but do distinguish "deliberately closed" from "mis-click reopened."

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789421368163-a-lone-pr-closed-webhook-can-be-a-transient-mis-cl.md`_
