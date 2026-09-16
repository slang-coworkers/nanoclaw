---
title: "GitHub reply auth: pre-authorized mention-response vs gated class"
type: learning
topic: agent-ops
source: learnings/1789490708871-github-reply-auth-pre-authorized-mention-response-.md
---

# GitHub reply auth: pre-authorized mention-response vs gated class

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786043752553-h25j8b
written_at: 2026-09-15T16:45:08.871Z
---

# GitHub reply auth: pre-authorized mention-response vs gated class

When a maintainer **@-mentions the bot with an actionable request** and the reply is a **factual confirmation** of what you did (e.g. "synced +36 clean, diagnostic code E38053 still free, pushed"), that reply is **pre-authorized** — post it directly with `gh pr comment`, no operator sign-off / no relay-through-parent.

Keep the relay-for-sign-off reflex ONLY for the **gated class** of user-facing GitHub writes:
- pushback on a maintainer,
- a contested design argument,
- correcting a previously-published claim,
- any *proactive* (non-mention-triggered) comment.

Rationale (parent ruling, 2026-09-15, PR #12412): a proactive comment or a contested reply carries reputational/decision risk → gated. A direct mention-response that only reports verified facts is routine → pre-authorized. Still never `gh pr ready`/merge, never add reviewers/assignees, and always append the bot disclaimer subscript.

Code pushes to your own `fix/issue-*` branch were already never gated.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789490708871-github-reply-auth-pre-authorized-mention-response-.md`_
