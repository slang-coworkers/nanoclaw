---
title: "Unblocking a budget-tapped coworker session: verify cost state directly, and use a NEW thread_id (not the same thread) to mint a fresh-budget session"
type: learning
topic: agent-ops
source: learnings/1789150203049-unblocking-a-budget-tapped-coworker-session-verify.md
---

# Unblocking a budget-tapped coworker session: verify cost state directly, and use a NEW thread_id (not the same thread) to mint a fresh-budget session

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787600646052-t604xq
written_at: 2026-09-11T18:10:03.049Z
---

# Unblocking a budget-tapped coworker session: verify cost state directly, and use a NEW thread_id (not the same thread) to mint a fresh-budget session

When a coworker reports it's "budget-blocked" mid-task, two orchestrator reflexes that were validated on shader-slang/slang#12714 (Sep 2026):

**1. Verify the session's cost state directly — don't act on a relayed ceiling/budget number.**
A triager relayed "session budget-blocked, ~$2.23 left, ceiling ~$6.77." Running `ncl cost-cap status --session <sid>` showed the truth: `status=escalated spent=$297.88 cap=$60 ceiling=$300 decision=continue`. The relayed ceiling was off by ~44× and the real story (a $300-ceiling session that had already burned $297.88 across ~2.5 weeks of reap/resume) implied the opposite action. Had I "raised from $6.77" I'd have found it already at $300. Always confirm with `ncl cost-cap status --session <sid>` before any set-ceiling/continue money decision.

**2. To get a FRESH-budget session, re-dispatch on a NEW thread_id — a fresh message on the SAME thread reuses the depleted session.**
Routing keys on `(agent-group, messaging-group, thread_id)`. A coworker tried twice to "re-dispatch as a fresh message" on the canonical GitHub thread `gh-issue-...-12714`; both routed straight back to the same escalated session because the thread_id was unchanged. Only dispatching with a brand-new `thread_id` (a sub-thread, e.g. `gh-issue-...-12714/round-up-flag`) minted a genuinely fresh session with the current group cap ($150) — clean budget, minimal context. This worked: the fresh session completed substantial work without cost-stopping.

**3. Prefer fresh-from-git over feeding a bloated long-lived session.**
The $297.88 session dragged ~2.5 weeks of context, making every turn expensive. Because the work was committed to a branch (durable), a fresh minimal-context session resuming from the commit was both cheaper per turn AND decoupled from the escalated session's budget. Declined the ceiling raise; routed to a fresh session instead. A single coworker session reaching ~2× the group's normal max via serial reap/resume is a cost-anomaly signal worth flagging to the operator.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789150203049-unblocking-a-budget-tapped-coworker-session-verify.md`_
