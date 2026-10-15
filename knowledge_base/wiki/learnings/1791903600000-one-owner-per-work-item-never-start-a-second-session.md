---
title: "One owner per work item: never start a second session to reset a budget"
type: learning
topic: agent-ops
source: learnings/1791903600000-one-owner-per-work-item-never-start-a-second-session.md
---

# One owner per work item: never start a second session to reset a budget

---
author_agent_group: operator
author_session: operator-2026-10-13
written_at: 2026-10-13T13:00:00.000Z
---

# One owner per work item: never start a second session to reset a budget

**Rule (operator, 2026-10-13).** A coworker session's cost cap and ceiling are the budget for its piece of work (one issue or PR). They are not a per-session allowance to reset. When the owning session is `escalated`, `stopped`, or posts "Reached maximum budget ($X)", escalate to a human with the session id, its spend and its ceiling. The human raises the ceiling on that same session (dashboard → session → raise ceiling). Never dispatch the same work on a new `thread_id` or sub-thread, whether to get a fresh budget or to get around a stuck session.

**Why.** Routing keys on `(agent-group, messaging-group, thread_id)`, so a new thread mints a second session at a full cap. That resets the budget to zero, throws away the working context (the new session re-spends to rebuild it), and splits ownership: PR webhooks keep routing to the old session. It happened on shader-slang/slang#12581, #12714 (twice) and #13406. On #13406 the fixer work cost about $615 across two sessions against a $300 ceiling, and the maintainer had to find the exhausted session by hand.

**The SDK stop is real.** "Reached maximum budget ($X)" means the session reached its actual ceiling. NanoClaw's own counter under-counted output tokens (fix in progress), so `ncl cost-cap status` read `escalated` while real spend had passed the ceiling. Treat that outbound as stopped and escalate. Do not route around it.

**Still true.** Verify cost state directly before any money decision: `ncl cost-cap status --session <sid>`, never a relayed number. Commit before a session can be reaped. Never reply to a closed session's message to resume it.

**Stuck sessions.** A wedged session (bouncing on every wake, or a GC'd provider conversation) is a recovery problem, not a budget one. Ask the operator to reset that session; never start a second session for the item. The router refuses a second session for an item that already has one (shipping with the one-owner change).

Supersedes: 1789146870261-correction-to-mint-a-fresh-coworker-session-dispat, 1789146576052-a-fixer-budget-stop-is-often-a-per-session-cap-not, 1789150203049-unblocking-a-budget-tapped-coworker-session-verify, 1791517893828-sdk-reached-maximum-budget-is-not-cost-cap-stopped, 1785467330065-stale-coworker-session-can-have-gc-d-provider-conv, 1787117195283-a-dark-agent-group-is-not-a-down-agent-group-disam (its remedy only; the idle-vs-broken check still holds).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791903600000-one-owner-per-work-item-never-start-a-second-session.md`_
