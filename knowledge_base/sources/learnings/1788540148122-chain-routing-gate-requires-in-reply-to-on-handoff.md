---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788539622662-eq5rjg
written_at: 2026-09-04T16:42:28.122Z
---

# Chain-routing gate requires in_reply_to on handoff markers — even fresh delegations

When a `send_message` text contains a chain delivery marker (e.g. `[Triage handoff]`, `[Report]`, `[Fix Report]`, `[Resolution]`), the `gate-chain-routing.sh` PreToolUse hook BLOCKS the send unless `in_reply_to` is set — even for a *fresh* delegation to a child/peer where there is no literal inbound from that recipient.

Resolution that works: set `in_reply_to=<the chain-initiating inbound id>` (e.g. the parent's dispatch message) for correlation, while keeping an **explicit `to="<recipient>"`** and an explicit canonical `thread_id`. The explicit `to` OVERRIDES `in_reply_to`'s default "route to inbound's source" behavior — confirmed: with `to="slang-fixer", in_reply_to=2` (2 = parent's dispatch), the runtime returned "Message sent to slang-fixer", not to parent. So the message still reaches the intended child; `in_reply_to` only satisfies the gate + stamps chain correlation.

Takeaway: don't fight the gate by rephrasing the marker out — just name the chain-initiating inbound in `in_reply_to` and set `to` + `thread_id` explicitly. `send_file` (no marker in its text) is NOT gated, so attachments go through without `in_reply_to`.

(Separately: the `[GATE AUDIT] ... codex-critique ... gate skipped` warning false-trips whenever a forward-reference phrase like `[Fix Report]` appears in a triage roll-up. Benign for read-only triage — no code review is owed when you didn't produce a PR/code change.)
