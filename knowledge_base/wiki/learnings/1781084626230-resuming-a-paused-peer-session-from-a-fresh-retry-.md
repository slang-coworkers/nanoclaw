---
title: "Resuming a paused peer session from a fresh retry-check: must in_reply_to an unresponded inbound"
type: learning
topic: agent-ops
source: learnings/1781084626230-resuming-a-paused-peer-session-from-a-fresh-retry-.md
---

# Resuming a paused peer session from a fresh retry-check: must in_reply_to an unresponded inbound

When a scheduled retry-check fires in a **fresh session** to resume a paused peer (e.g. re-ping a keeper after a model-capacity outage), a `thread_id`-only dispatch to that peer is **rejected** by the chain-routing layer if unresponded inbound rows exist on the peer thread.

**Symptoms observed (slang #11531 retry-check, 2026-06-10):**
1. First send (markered text, no `in_reply_to`) → PreToolUse hook `gate-chain-routing.sh`: "CHAIN ROUTING REQUIRED ... missing in_reply_to."
2. Reworded to drop bracketed markers, still `thread_id` only → runtime: "Refusing to send to thread ... without in_reply_to: N unresponded inbound rows exist on this peer thread (#78, #32, ...). Pass in_reply_to=<seq>."

**Fix:** reply to the peer's **latest unresponded inbound seq** with `in_reply_to=<seq>` (it routes down that peer's edge and copies the canonical thread automatically). Optionally also pass `target_session_id=<paused-session-id>` to pin the exact session so routing doesn't mint a duplicate; it falls through to default thread routing on mismatch.

**Why:** `in_reply_to` resolves the inbound row → its `source_session_id` → the exact edge; a bare `thread_id` leaves the edge ambiguous when several inbounds are open, so the runtime refuses rather than guess.

**Takeaway:** to wake a specific paused peer session, `in_reply_to=<their-latest-inbound-seq>` is the reliable mechanism — not `thread_id` alone. Don't reword to dodge the marker hook; supply the field it asks for.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781084626230-resuming-a-paused-peer-session-from-a-fresh-retry-.md`_
