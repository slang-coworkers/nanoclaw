---
title: "Heartbeat reports to orchestrator blocked by 678-row unresponded backlog on peer thread"
type: learning
topic: misc
source: learnings/1789645494994-heartbeat-reports-to-orchestrator-blocked-by-678-r.md
---

# Heartbeat reports to orchestrator blocked by 678-row unresponded backlog on peer thread

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-17T11:44:54.994Z
---

# Heartbeat reports to orchestrator blocked by 678-row unresponded backlog on peer thread

**Context:** Slang Discord Support heartbeat wake (2026-09-17 11:40 UTC). After saving the heartbeat report to `memory/latest-report.md`/`heartbeat-log.md`, tried `send_message(to="orchestrator")` to post the summary.

**What happened:** First attempt silently failed to deliver (system returned an `<undelivered_message>` notice asking to resend explicitly). Resend via `mcp__nanoclaw__send_message(to="orchestrator")` errored:

> Refusing to send to thread "discord-support-followup-sweep-20260707" without in_reply_to: 678 unresponded inbound rows exist on this peer thread (#30514, #22438, ... down to #12). Pass in_reply_to=<seq> explicitly.

The session's default outgoing thread_id auto-propagates to this peer thread, which has apparently accumulated 678 unanswered inbound rows over the life of this heartbeat session (5-min cadence heartbeats → ~56h of backlog). The routing layer refuses a bare send into a thread with that much unaddressed backlog rather than let it silently vanish.

**Why this matters / what NOT to do:** Do not guess an `in_reply_to` id from a huge unrelated backlog list just to force the send through — picking the wrong ancestor inbound mis-threads the reply (per the "route on edges, never guess" invariant). None of the listed ids in this error had an obvious, verifiable correspondence to "this wake's trigger message" — the task prompt that woke this session was delivered as a bare `<task>` block with no message id, so there was no legitimate id to reply to.

**What I did instead:** Routed the same status summary to the `slang-discord-support-dashboard` destination (a distinct, non-backlogged destination) and explicitly noted in that message that delivery to `orchestrator` failed for this reason, rather than silently dropping the notification or force-guessing a thread reply.

**Open question for whoever owns this pipeline:** why is `discord-support-followup-sweep-20260707` accumulating hundreds of unresponded inbound rows from a recurring heartbeat session — is the heartbeat's periodic trigger itself creating an inbound row each cycle that's never being explicitly replied-to/acked, and is that expected (files-as-deliverable, no chat reply needed) or a bug in how heartbeat wakes are wired? If expected, the routing layer's backlog-refusal threshold is going to keep tripping every wake once it crosses whatever row count triggers it — worth either raising the threshold, auto-acking heartbeat trigger rows, or having the heartbeat workflow stop trying to `send_message(to="orchestrator")` at all and rely purely on the memory files.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789645494994-heartbeat-reports-to-orchestrator-blocked-by-678-r.md`_
