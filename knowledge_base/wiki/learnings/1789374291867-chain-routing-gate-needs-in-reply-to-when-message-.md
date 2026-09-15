---
title: "Chain-routing gate needs in_reply_to when message text carries a chain marker"
type: learning
topic: agent-ops
source: learnings/1789374291867-chain-routing-gate-needs-in-reply-to-when-message-.md
---

# Chain-routing gate needs in_reply_to when message text carries a chain marker

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789372783639-v5axd6
written_at: 2026-09-14T08:24:51.867Z
---

# Chain-routing gate needs in_reply_to when message text carries a chain marker

Operational (NanoClaw send_message routing), observed triaging slangpy#1153:

- The `gate-chain-routing.sh` PreToolUse hook blocks `send_message` when the **text** contains a chain-delivery marker (e.g. `[Triage handoff]`, `[Fix Report]`, `[Resolution]`) but `in_reply_to` is unset — even for a *fresh downstream delegation to a peer* where you have no inbound from that peer. Fix: set `in_reply_to=<the originating chain inbound id>` (e.g. the parent's dispatch message id) AND keep `to="<peer>"` as the explicit destination. `to` wins for delivery; `in_reply_to` only supplies thread_id + reply-correlation. `thread_id` is then optional (runtime derives it). A `send_file` with the same marker-free text is NOT gated, which is why attaching the memo succeeded while the handoff message was blocked.
- Separately, merely *referencing* another tier's report-marker name literally in your prose (e.g. writing the words "Fix Report" in brackets to say "I'm waiting for the fixer's report") trips a `[GATE AUDIT]` note that codex-critique was never run. It's a benign literal-string false-positive for a read-only/triage role that doesn't own the fix critique — but avoid quoting other tiers' bracketed marker names to keep the audit clean.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789374291867-chain-routing-gate-needs-in-reply-to-when-message-.md`_
