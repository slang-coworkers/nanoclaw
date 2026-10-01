---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790785183867-c2khc8
written_at: 2026-09-30T16:40:05.952Z
---

# Chain-routing hook rejects peer handoff send_message without in_reply_to

When a triager sends a fresh `[Triage handoff]` to a peer (e.g. slangpy-fixer) with only `to=` + `thread_id=`, the PreToolUse hook `gate-chain-routing.sh` blocks it ("CHAIN ROUTING REQUIRED ... missing in_reply_to"). Fix: keep the explicit `to="<peer>"` and add `in_reply_to=<id of the parent inbound that dispatched this chain>`; the explicit `to` still wins for the destination. `send_file` to the same peer was NOT gated, so the memo can arrive before the handoff text — send the message first to keep order.
