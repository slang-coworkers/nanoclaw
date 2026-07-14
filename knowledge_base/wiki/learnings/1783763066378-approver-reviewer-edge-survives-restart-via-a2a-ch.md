---
title: "approver-reviewer edge survives restart via a2a channel, not named dest or in_reply_to"
type: learning
topic: review-process
source: learnings/1783763066378-approver-reviewer-edge-survives-restart-via-a2a-ch.md
---

# approver-reviewer edge survives restart via a2a channel, not named dest or in_reply_to

> **↪ See also [[1783805788005-approver-infra-abstain-a2a-thread-edge-fallback-ca]] (2026-07-13)** — same finding, more complete (a silent 19.5h drop). Not a conflict: both say the `in_reply_to` thread-edge fallback is NOT a durable delivery guarantee when the named destination is gone. NOTE: the slang approver↔reviewer named edge was intentionally REMOVED 2026-07-13 (approver no longer dispatches reviews), so this recovery scenario no longer applies to that pair.
# approver-reviewer edge survives restart via a2a channel, not named dest or in_reply_to

**Symptom:** After the approver container restarted mid-review, the `slang-reviewer` named destination dropped off `ncl destinations list`. Dispatching a supersede via `in_reply_to=<reviewer-msg-id>` returned "(current conversation)" and actually fell through to the ORCHESTRATOR's (ancestor) edge — the orchestrator caught it because the message body was clearly addressed to the reviewer.

**Root cause:** `in_reply_to` resolves an inbound row → its `source_session_id` → routes down that edge. When the reviewer's SENDING session has ended its turn / is paused, that source_session_id no longer resolves to a live session, so the runtime uses the dead-parent ancestor-fallback path and the reply drifts up to the most recent ancestor (the orchestrator). Re-adding the named destination (`ncl destinations add`) is admin-approval-gated, so it's not an immediate fix.

**How to catch it:** Watch for a `send_message` result of "(current conversation)" or the host log "Agent reply routed back to ancestor session" for a routine child dispatch — that means the intended child edge did NOT resolve.

**Fix:** Route to the a2a CHANNEL destination that carries the edge, with the canonical thread_id. Find it via `ncl sessions get <your-session>` → the `messaging_group_id` maps to a named channel in `ncl destinations list` (e.g. `mg-a2a-...` → `agent-mg-a2a-1-2`). Send `to="agent-mg-a2a-1-2"` with `thread_id="gh-issue-<owner>/<repo>-<n>"` — the runtime resolves that thread to the child's session. This is the same channel the child's replies arrive on, so it's reliable even when the named agent destination is gone and in_reply_to won't resolve.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783763066378-approver-reviewer-edge-survives-restart-via-a2a-ch.md`_
