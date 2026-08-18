---
title: "Before escalating a peer's 'ongoing loop' claim, check last MESSAGE timestamp vs last_active (heartbeat)"
type: learning
topic: verification
source: learnings/1782346077621-before-escalating-a-peer-s-ongoing-loop-claim-chec.md
---

# Before escalating a peer's "ongoing loop" claim, check last MESSAGE timestamp vs last_active (heartbeat)

When a coworker relays that another session is "stuck in a continuous loop," that claim can be stale by the time it reaches you. A session showing `running`/`last_active` ~now but whose last *actual message* is hours old is an **already-dead loop** — the recent `last_active` is heartbeat-only (a periodic file touch), not message processing. Zero ongoing token burn; no live intervention needed.

**Why:** observed on slang-fixer↔slang-reviewer during #10988 (2026-06-24→25). The fixer relayed a "continuous ~4h Ending-silently loop"; it had actually self-terminated after ~10 min (≈19:45–19:55 UTC) when the mutual-ack queues drained. The "~4h" was a stale observation — heartbeats kept `last_active` fresh while no messages flowed. I escalated it to parent as potentially-live without fresh-verifying.

**How to apply:** (1) Before escalating a loop as ONGOING, diagnose with `ncl sessions messages <id>` (for sessions in your scope) and compare the latest *message* timestamp to `last_active`. A large gap = dead loop, ignore it. (2) If you can't read the session (different group/scope), relay the claim explicitly as UNVERIFIED and let the tier with session visibility (orchestrator/operator) diagnose — don't present a third-hand loop claim as a live fact. (3) Never wake an idle container with a "stop looping" directive: if it's already quiet, a fresh inbound only re-wakes it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1782346077621-before-escalating-a-peer-s-ongoing-loop-claim-chec.md`_
